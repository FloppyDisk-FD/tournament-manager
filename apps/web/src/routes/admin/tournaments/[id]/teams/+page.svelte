<script lang="ts">
	import { api } from '$lib/api/client';
	import { success, error } from '$lib/stores/toast.svelte';

	interface TournamentTeam {
		id: string;
		name: string;
		logo_emoji?: string | null;
		logo_url?: string | null;
		seed?: number | null;
		status?: string | null;
		players?: unknown[];
	}

	interface GlobalTeam {
		id: string;
		name: string;
		logoEmoji?: string | null;
		logo_emoji?: string | null;
		logoUrl?: string | null;
		logo_url?: string | null;
		players?: unknown[];
	}

	let { data } = $props();
	let teams = $state<TournamentTeam[]>(data.teams ?? []);

	// 快速创建
	let newName = $state('');
	let newEmoji = $state('🏆');
	let newLogoUrl = $state('');
	let adding = $state(false);

	// 批量添加
	let batchNames = $state('');
	let showBatch = $state(false);

	// 从队伍库导入
	let showLibrary = $state(false);
	let globalTeams = $state<GlobalTeam[]>([]);
	let libraryLoading = $state(false);
	let selectedIds = $state<string[]>([]);
	let importing = $state(false);

	const t = $derived(data.tournament);
	const joinedIds = $derived(new Set(teams.map((tm) => tm.id)));

	// 用 $effect 在浏览器端打开面板时自动加载队伍库（带已加载标记避免重复请求）
	let libraryLoaded = $state(false);
	$effect(() => {
		if (showLibrary && !libraryLoaded && !libraryLoading) {
			loadLibrary();
		}
	});

	async function loadLibrary() {
		libraryLoading = true;
		try {
			const list = await api.get<GlobalTeam[]>('/teams');
			globalTeams = Array.isArray(list) ? list : [];
			libraryLoaded = true;
		} catch (e: any) {
			error(e.message ?? '加载队伍库失败');
		} finally {
			libraryLoading = false;
		}
	}

	function toggleSelect(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	async function addTeam() {
		if (!newName.trim()) {
			error('队名不能为空');
			return;
		}
		adding = true;
		try {
			const created = await api.post<any>(`/tournaments/${t.id}/teams`, {
				name: newName.trim(),
				logo_emoji: newEmoji.trim() || undefined,
				logo_url: newLogoUrl.trim() || undefined,
			});
			teams = [
				...teams,
				{
					id: created.id,
					name: created.name,
					logo_emoji: created.logoEmoji ?? created.logo_emoji ?? newEmoji.trim(),
					logo_url: created.logoUrl ?? created.logo_url ?? (newLogoUrl.trim() || null),
					seed: teams.length + 1,
					status: created.status ?? 'active',
					players: [],
				},
			];
			newName = '';
			newEmoji = '🏆';
			newLogoUrl = '';
			success('队伍已添加');
		} catch (e: any) {
			error(e.message ?? '添加失败');
		} finally {
			adding = false;
		}
	}

	async function addBatch() {
		const names = batchNames
			.split('\n')
			.map((n) => n.trim())
			.filter(Boolean);
		if (names.length === 0) {
			error('请输入至少一个队伍名称');
			return;
		}
		adding = true;
		try {
			const inserted = await api.post<any[]>(`/tournaments/${t.id}/teams/batch`, { names });
			const base = teams.length;
			teams = [
				...teams,
				...inserted.map((tm, i) => ({
					id: tm.id,
					name: tm.name,
					logo_emoji: tm.logoEmoji ?? tm.logo_emoji ?? null,
					logo_url: tm.logoUrl ?? tm.logo_url ?? null,
					seed: base + i + 1,
					status: tm.status ?? 'active',
					players: [],
				})),
			];
			batchNames = '';
			showBatch = false;
			success(`已添加 ${names.length} 支队伍`);
		} catch (e: any) {
			error(e.message ?? '批量添加失败');
		} finally {
			adding = false;
		}
	}

	async function removeTeam(teamId: string) {
		if (!confirm('确定移除此队伍？')) return;
		try {
			await api.del(`/tournaments/${t.id}/teams/${teamId}`);
			teams = teams.filter((tm) => tm.id !== teamId);
			success('队伍已移除');
		} catch (e: any) {
			error(e.message ?? '移除失败');
		}
	}

	async function importSelected() {
		if (selectedIds.length === 0) {
			error('请先选择队伍');
			return;
		}
		importing = true;
		try {
			const res = await api.post<{ message: string; added: number; skipped?: string[] }>(
				`/tournaments/${t.id}/teams/import`,
				{ team_ids: [...selectedIds] },
			);
			const base = teams.length;
			const toAdd = globalTeams
				.filter((gt) => selectedIds.includes(gt.id) && !joinedIds.has(gt.id))
				.map((gt, i) => ({
					id: gt.id,
					name: gt.name,
					logo_emoji: gt.logoEmoji ?? gt.logo_emoji ?? null,
					logo_url: gt.logoUrl ?? gt.logo_url ?? null,
					seed: base + i + 1,
					status: 'active' as const,
					players: gt.players ?? [],
				}));
			teams = [...teams, ...toAdd];
			selectedIds = [];
			// 如果有被跳过的队伍（已删除的旧 ID），刷新全局队伍列表
			if (res.skipped && res.skipped.length > 0) {
				await loadLibrary();
				success(`已加入 ${res.added} 支队伍，${res.skipped.length} 支已失效被跳过`);
			} else {
				success(res.added > 0 ? `已加入 ${res.added} 支队伍` : res.message ?? '无新增队伍');
			}
		} catch (e: any) {
			error(e.message ?? '导入失败');
		} finally {
			importing = false;
		}
	}
</script>

<div>
	<div class="mb-6">
		<a
			href="/admin/tournaments/{t.id}"
			class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150"
		>
			← 返回赛事
		</a>
	</div>
	<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black mb-6">队伍管理 — {t.name}</h1>

	{#if t.status === 'draft'}
		<div class="mb-6 space-y-3">
			<!-- 快速创建：emoji + 队名 + Logo URL + 按钮 -->
			<div class="flex flex-col md:flex-row gap-0 border border-black bg-white">
				<input
					type="text"
					maxlength="10"
					bind:value={newEmoji}
					placeholder="🏆"
					onkeydown={(e) => e.key === 'Enter' && addTeam()}
					class="w-full md:w-20 border-b md:border-b-0 md:border-r border-black px-3 py-2 text-sm text-center font-sans bg-white focus:outline-none rounded-none"
				/>
				<input
					type="text"
					bind:value={newName}
					placeholder="队伍名称"
					onkeydown={(e) => e.key === 'Enter' && addTeam()}
					class="w-full md:flex-1 border-b md:border-b-0 md:border-r border-black px-3 py-2 text-sm font-sans bg-white focus:outline-none rounded-none"
				/>
				<input
					type="text"
					bind:value={newLogoUrl}
					placeholder="Logo URL（可选）"
					onkeydown={(e) => e.key === 'Enter' && addTeam()}
					class="w-full md:flex-1 border-b md:border-b-0 md:border-r border-black px-3 py-2 text-sm font-sans bg-white focus:outline-none rounded-none"
				/>
				<button
					onclick={addTeam}
					disabled={adding}
					class="w-full md:w-auto border-b md:border-b-0 md:border-r border-black bg-black text-white px-4 py-2 text-sm rounded-none font-sans font-bold transition-opacity duration-150 active:opacity-70 disabled:opacity-50 whitespace-nowrap"
				>
					添加 →
				</button>
				<button
					onclick={() => (showBatch = !showBatch)}
					class="w-full md:w-auto bg-white text-black px-4 py-2 text-sm rounded-none font-sans font-bold transition-opacity duration-150 active:opacity-70 whitespace-nowrap"
				>
					{showBatch ? '取消' : '批量添加'}
				</button>
			</div>

			{#if showBatch}
				<div>
					<textarea
						bind:value={batchNames}
						rows="5"
						placeholder="每行一个队伍名称"
						class="w-full rounded-none border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none"
					></textarea>
					<button
						onclick={addBatch}
						disabled={adding}
						class="mt-2 rounded-none font-sans font-bold border border-black bg-black text-white px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
					>
						批量添加 →
					</button>
				</div>
			{/if}

			<!-- 从队伍库导入（展开式面板） -->
			<div>
				<button
					onclick={() => (showLibrary = !showLibrary)}
					class="rounded-none font-sans font-bold border border-black bg-white text-black px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70"
				>
					{showLibrary ? '收起队伍库' : '从队伍库添加 →'}
				</button>
			</div>

			{#if showLibrary}
				<div class="rounded-none border border-black bg-white p-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="font-black text-base tracking-tight text-black">全局队伍库</h2>
						<div class="flex items-center gap-3">
							<span class="text-xs font-bold text-neutral-500">
								已选 {selectedIds.length} / {globalTeams.length}
							</span>
							<button
								type="button"
								onclick={() => { libraryLoaded = false; loadLibrary(); }}
								class="text-xs font-bold text-black border border-black px-2 py-0.5 hover:bg-neutral-100 transition-colors duration-150"
							>↻ 刷新</button>
						</div>
					</div>

					{#if libraryLoading}
						<div class="text-center py-8 text-sm text-neutral-500 font-bold">加载中…</div>
					{:else if globalTeams.length === 0}
						<div class="text-center py-8 text-sm text-neutral-500 font-bold">
							队伍库为空
							<br/>
							<a href="/admin/teams" class="text-black border-b border-black font-bold mt-2 inline-block">去队伍库添加 →</a>
						</div>
					{:else}
						<div class="border border-black max-h-96 overflow-y-auto">
							{#each globalTeams as gt (gt.id)}
								{@const joined = joinedIds.has(gt.id)}
								<label
									class="flex items-center gap-3 px-3 py-2 border-b border-black/20 last:border-b-0 transition-colors duration-150 {joined
										? 'bg-neutral-100 opacity-60 cursor-not-allowed'
										: 'hover:bg-neutral-50 cursor-pointer'}"
								>
									<input
										type="checkbox"
										checked={selectedIds.includes(gt.id)}
										disabled={joined}
										onchange={() => toggleSelect(gt.id)}
										class="accent-black"
									/>
									<span class="text-xl w-8 text-center">{gt.logoEmoji ?? gt.logo_emoji ?? '🏆'}</span>
									<div class="flex-1 min-w-0">
										<div class="font-bold text-sm text-black truncate">{gt.name}</div>
										<div class="text-xs text-neutral-500 font-bold">{gt.players?.length ?? 0} 名选手</div>
									</div>
									{#if joined}
										<span class="text-xs font-bold text-neutral-500 border border-neutral-400 px-2 py-0.5">
											已加入
										</span>
									{/if}
								</label>
							{/each}
						</div>

						<div class="mt-3 flex flex-wrap items-center gap-2">
							<button
								onclick={importSelected}
								disabled={importing || selectedIds.length === 0}
								class="rounded-none font-sans font-bold border border-black bg-black text-white px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
							>
								{importing ? '加入中…' : '加入选中队伍 →'}
							</button>
							<button
								onclick={() => (selectedIds = [])}
								disabled={selectedIds.length === 0}
								class="rounded-none font-sans font-bold border border-black bg-white text-black px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
							>
								清除选择
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if teams.length > 0}
		<div class="border border-black overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-black text-white">
					<tr>
						<th class="text-left px-4 py-3 font-bold w-14">SEED</th>
						<th class="text-left px-4 py-3 font-bold w-14">LOGO</th>
						<th class="text-left px-4 py-3 font-bold">队名</th>
						<th class="text-left px-4 py-3 font-bold w-20">选手</th>
						<th class="text-left px-4 py-3 font-bold w-24">操作</th>
					</tr>
				</thead>
				<tbody>
					{#each teams as team, i (team.id)}
						<tr class="border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150">
							<td class="px-4 py-2 text-neutral-500 font-bold">{team.seed ?? i + 1}</td>
							<td class="px-4 py-2">
								{#if team.logo_url}
									<img src={team.logo_url} alt={team.name} class="w-6 h-6 object-contain" />
								{:else}
									<span class="text-xl">{team.logo_emoji || '🏆'}</span>
								{/if}
							</td>
							<td class="px-4 py-2 font-bold text-black">{team.name}</td>
							<td class="px-4 py-2 text-neutral-600 font-bold">{team.players?.length ?? 0}</td>
							<td class="px-4 py-2">
								{#if t.status === 'draft'}
									<button
										onclick={() => removeTeam(team.id)}
										class="font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150 text-sm"
									>
										移除 →
									</button>
								{:else}
									<span class="text-xs text-neutral-500 font-bold">已锁定</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="text-center py-12 text-sm text-neutral-500">暂无队伍</div>
	{/if}
</div>
