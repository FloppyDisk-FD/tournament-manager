<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight, Users } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PlayerEditCard from '$lib/components/PlayerEditCard.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	interface Player {
		player_name: string;
		player_role: string;
		game_id: string;
		avatar_url: string | null;
		is_captain: boolean;
	}

	interface Team {
		id?: string;
		name: string;
		logo_emoji: string;
		logo_url?: string;
		players: Player[];
	}

	let { data } = $props();
	let teams = $state<Team[]>(data.teams ?? []);

	// 创建表单状态
	let newName = $state('');
	let newEmoji = $state('🏆');
	let newLogoUrl = $state('');
	let creating = $state(false);
	let showCreate = $state(false);

	// 展开状态
	let expandedId = $state<string | null>(null);

	// 编辑状态（按队伍 id 索引）
	let editingId = $state<string | null>(null);
	let editDraft = $state<Team | null>(null);

	const emojiPresets = ['🔥', '🐉', '🦁', '⚔️', '🛡️', '⚡', '🎯', '🏆'];
	const roleMap: Record<string, string> = {
		member: '队员',
		captain: '队长',
		substitute: '替补',
		coach: '教练',
	};

	// 后端返回 camelCase，前端统一用 snake_case
	function normalizeTeam(t: any): Team {
		return {
			id: t.id,
			name: t.name,
			logo_emoji: t.logo_emoji ?? t.logoEmoji ?? '🏆',
			logo_url: t.logo_url ?? t.logoUrl ?? undefined,
			players: (t.players ?? []).map((p: any) => ({
				player_name: p.player_name ?? p.playerName ?? '',
				player_role: p.player_role ?? p.playerRole ?? 'member',
				game_id: p.game_id ?? p.gameId ?? '',
				avatar_url: p.avatar_url ?? p.avatarUrl ?? null,
				is_captain: p.is_captain ?? p.isCaptain ?? false,
			})),
		};
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function startEdit(team: any) {
		editingId = team.id ?? null;
		editDraft = normalizeTeam(team);
		expandedId = team.id ?? null;
	}

	function cancelEdit() {
		editingId = null;
		editDraft = null;
	}

	async function saveEdit(teamId: string) {
		if (!editDraft) return;
		if (!editDraft.name.trim()) {
			error('队名不能为空');
			return;
		}
		try {
			const updated = await api.put<Team>(`/teams/${teamId}`, {
				name: editDraft.name.trim(),
				logo_emoji: editDraft.logo_emoji,
				logo_url: editDraft.logo_url || undefined,
				players: editDraft.players,
			});
			teams = teams.map((t) => (t.id === teamId ? normalizeTeam(updated) : t));
			editingId = null;
			editDraft = null;
			success('队伍已更新');
		} catch (e: any) {
			error(e.message ?? '更新失败');
		}
	}

	async function deleteTeam(teamId: string) {
		if (!confirm('确定删除此队伍？此操作不可撤销。')) return;
		try {
			await api.del(`/teams/${teamId}`);
			teams = teams.filter((t) => t.id !== teamId);
			if (expandedId === teamId) expandedId = null;
			if (editingId === teamId) {
				editingId = null;
				editDraft = null;
			}
			success('队伍已删除');
		} catch (e: any) {
			error(e.message ?? '删除失败');
		}
	}

	async function createTeam() {
		if (!newName.trim()) {
			error('队名不能为空');
			return;
		}
		creating = true;
		try {
			const team = await api.post<Team>('/teams', {
				name: newName.trim(),
				logo_emoji: newEmoji || '🏆',
				logo_url: newLogoUrl.trim() || undefined,
				players: [],
			});
			teams = [...teams, normalizeTeam(team)];
			newName = '';
			newEmoji = '🏆';
			newLogoUrl = '';
			showCreate = false;
			success('队伍已创建');
		} catch (e: any) {
			error(e.message ?? '创建失败');
		} finally {
			creating = false;
		}
	}

	// 选手本地增删改（操作 editDraft）
	function addPlayer() {
		if (!editDraft) return;
		editDraft.players = [
			...editDraft.players,
			{
				player_name: '',
				player_role: 'member',
				game_id: '',
				avatar_url: null,
				is_captain: false,
			},
		];
	}

	function removePlayer(index: number) {
		if (!editDraft) return;
		editDraft.players = editDraft.players.filter((_, i) => i !== index);
	}

	function setCaptain(index: number) {
		if (!editDraft) return;
		editDraft.players = editDraft.players.map((p, i) => ({
			...p,
			is_captain: i === index,
		}));
	}
</script>

<div>
	<PageHeader title="队伍库管理">
		<Button onclick={() => (showCreate = !showCreate)} en="New Team">
			{showCreate ? '取消' : '新建队伍 →'}
		</Button>
	</PageHeader>

	{#if showCreate}
		<div class="rounded-none border border-black bg-white p-4 md:p-6 mb-6">
			<h2 class="font-black text-lg tracking-tight text-black mb-4">新建队伍</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-0 border border-black">
				<div class="border-b md:border-b-0 md:border-r border-black p-3">
					<label class="block text-xs font-bold text-neutral-600 mb-1">队名</label>
					<input
						type="text"
						bind:value={newName}
						placeholder="例如：火焰战队"
						class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
					/>
				</div>
				<div class="border-b md:border-b-0 md:border-r border-black p-3">
					<label class="block text-xs font-bold text-neutral-600 mb-1">Logo Emoji</label>
					<input
						type="text"
						maxlength="10"
						bind:value={newEmoji}
						placeholder="🏆"
						class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
					/>
					<div class="flex flex-wrap gap-1 mt-2">
						{#each emojiPresets as em}
							<button
								type="button"
								onclick={() => (newEmoji = em)}
								class="border border-black px-1.5 py-0.5 text-sm font-bold transition-colors duration-150 active:opacity-70 {newEmoji === em
									? 'bg-black text-white'
									: 'bg-white text-black hover:bg-neutral-100'}"
							>
								{em}
							</button>
						{/each}
					</div>
				</div>
				<div class="p-3">
					<label class="block text-xs font-bold text-neutral-600 mb-1">Logo URL（可选）</label>
					<input
						type="text"
						bind:value={newLogoUrl}
						placeholder="https://..."
						class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
					/>
				</div>
			</div>
			<div class="mt-4">
				<Button
				onclick={createTeam}
				disabled={creating}
				en="Create"
				class="rounded-none"
			>
				<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
				{creating ? '创建中…' : '创建队伍'}
			</Button>
			</div>
		</div>
	{/if}

	{#if teams.length === 0}
		<EmptyState icon={Users} title="暂无队伍" description="点击「新建队伍」开始" />
	{:else}
		<div class="space-y-0 border-t border-l border-black">
			{#each teams as team (team.id)}
				{@const isOpen = expandedId === team.id}
				{@const isEditing = editingId === team.id && editDraft}
				<div class="rounded-none border-r border-b border-black bg-white">
					<!-- 队伍行 -->
					<div class="flex items-center gap-3 p-3 md:p-4">
						<button
							type="button"
							onclick={() => toggleExpand(team.id!)}
							class="flex items-center gap-3 flex-1 text-left transition-opacity duration-150 active:opacity-70"
						>
							<span class="font-black text-2xl w-8 text-center">
							{#if team.logo_url}
								<img src={team.logo_url} alt={team.name} class="w-8 h-8 object-contain" />
							{:else}
								{team.logo_emoji || '🏆'}
							{/if}
						</span>
							<div class="flex-1 min-w-0">
								{#if isEditing}
									<input
										type="text"
										bind:value={editDraft!.name}
										class="rounded-none border border-black font-sans font-bold px-2 py-1 text-sm bg-white focus:outline-none w-full"
									/>
								{:else}
									<div class="font-black text-base md:text-lg text-black truncate">{team.name}</div>
								{/if}
								<div class="text-xs text-neutral-500 font-bold mt-0.5">
									{team.players?.length ?? 0} 名选手
								</div>
							</div>
							<span class="text-xs font-bold text-neutral-500">{isOpen ? '▲' : '▼'}</span>
						</button>

						{#if isEditing}
							<div class="flex gap-1">
								<Button
									onclick={() => saveEdit(team.id!)}
									en="Save"
									size="sm"
									class="rounded-none"
								>
									保存
								</Button>
								<button
									onclick={cancelEdit}
									class="rounded-none font-sans font-bold border border-black bg-white text-black px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70"
								>
									取消
								</button>
							</div>
						{:else}
							<div class="flex gap-1">
								<button
									onclick={() => startEdit(team)}
									class="rounded-none font-sans font-bold border border-black bg-white text-black px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70"
								>
									编辑
								</button>
								<button
									onclick={() => deleteTeam(team.id!)}
									class="rounded-none font-sans font-bold border border-black bg-white text-accent px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70"
								>
									删除
								</button>
							</div>
						{/if}
					</div>

					<!-- 展开内容 -->
					{#if isOpen}
						<div class="border-t border-black p-3 md:p-4 bg-neutral-50">
							{#if isEditing}
								<!-- 队伍信息 -->
								<div class="mb-4">
									<div class="flex items-center gap-2 mb-2">
										<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
										<span class="text-xs font-bold uppercase tracking-widest text-neutral-700">队伍信息</span>
									</div>
									<div class="space-y-3">
										<div>
											<label class="block text-xs font-bold text-neutral-600 mb-1">Logo Emoji</label>
											<input
												type="text"
												maxlength="10"
												bind:value={editDraft!.logo_emoji}
												class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
											/>
											<div class="flex flex-wrap gap-1 mt-2">
												{#each emojiPresets as em}
													<button
														type="button"
														onclick={() => (editDraft!.logo_emoji = em)}
														class="border border-black px-1.5 py-0.5 text-sm font-bold transition-colors duration-150 active:opacity-70 {editDraft!.logo_emoji === em
															? 'bg-black text-white'
															: 'bg-white text-black hover:bg-neutral-100'}"
													>
														{em}
													</button>
												{/each}
											</div>
										</div>
										<div>
											<label class="block text-xs font-bold text-neutral-600 mb-1">Logo URL（可选）</label>
											<input
												type="text"
												bind:value={editDraft!.logo_url}
												placeholder="https://..."
												class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
											/>
										</div>
									</div>
								</div>

								<!-- 选手管理 -->
								<div class="mb-4">
									<div class="flex items-center justify-between mb-2">
										<div class="flex items-center gap-2">
											<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
											<div class="text-xs font-bold uppercase tracking-widest text-neutral-700">选手管理</div>
											<span class="text-xs font-black tabular-nums text-neutral-400">{editDraft!.players.length} 名</span>
										</div>
										<Button
										type="button"
										onclick={addPlayer}
										en="Add Player"
										size="sm"
										class="rounded-none"
									>
										+ 添加选手
									</Button>
									</div>

									{#if editDraft!.players.length === 0}
										<div class="rounded-none border border-black bg-white p-6 text-center">
											<div class="text-2xl mb-2">👥</div>
											<p class="text-sm text-neutral-500 font-bold">暂无选手</p>
											<p class="text-xs text-neutral-400 mt-1">点击右上角「添加选手」录入第一位选手</p>
										</div>
									{:else}
										<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
											{#each editDraft!.players as p, i}
												<PlayerEditCard player={p} index={i} onSetCaptain={setCaptain} onRemovePlayer={removePlayer} />
											{/each}
										</div>
									{/if}
								</div>

								<!-- 底部操作 -->
								<div class="pt-4 border-t border-neutral-300 flex gap-2">
									<Button
									onclick={() => saveEdit(team.id!)}
									disabled={creating}
									en="Save"
									class="rounded-none"
								>
									保存修改 →
								</Button>
									<button
										onclick={cancelEdit}
										class="rounded-none font-sans font-bold border border-black bg-white text-black px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70"
									>
										取消
									</button>
								</div>
							{:else}
								<!-- 只读模式：选手列表 -->
								<div>
									<div class="flex items-center gap-2 mb-2">
									<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
									<span class="text-xs font-bold uppercase tracking-widest text-neutral-700">选手名单</span>
								</div>
									{#if team.players?.length > 0}
										<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
											{#each team.players as p, i}
												<div class="rounded-none border border-black bg-white p-3 flex items-center gap-3">
													<span class="text-xs font-black tabular-nums text-neutral-400 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
													<div class="shrink-0 w-12 h-12 border border-black bg-neutral-100 flex items-center justify-center overflow-hidden">
														{#if p.avatar_url}
															<img src={p.avatar_url} alt={p.player_name || '选手'} class="w-full h-full object-cover" width="48" height="48" />
														{:else}
															<span class="font-black text-lg text-neutral-400">{p.player_name?.charAt(0) || '?'}</span>
														{/if}
													</div>
													<div class="flex-1 min-w-0">
														<div class="font-bold text-sm text-black truncate flex items-center gap-1">
															{p.player_name || '未命名'}
															{#if p.is_captain}
																<span class="text-accent" title="队长">★</span>
															{/if}
														</div>
														<div class="text-xs text-neutral-500 font-bold mt-0.5">
															{roleMap[p.player_role] ?? p.player_role} · {p.game_id || '无 ID'}
														</div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="rounded-none border border-black bg-white p-3 text-center text-xs text-neutral-500 font-bold">
											暂无选手
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
