<script lang="ts">
	import { api } from '$lib/api/client';
	import { success, error } from '$lib/stores/toast.svelte';

	interface Player {
		player_name: string;
		player_role: string;
		game_id: string;
		avatar_emoji: string;
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
	const avatarPresets = ['🦸', '🥷', '🐺', '🦅', '👾', '🤖', '🐯', '👑'];

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function startEdit(team: Team) {
		editingId = team.id ?? null;
		editDraft = {
			...team,
			players: team.players.map((p) => ({ ...p })),
		};
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
			teams = teams.map((t) => (t.id === teamId ? { ...updated } : t));
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
			teams = [...teams, team];
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
				avatar_emoji: '🦸',
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
	<div class="flex items-center justify-between mb-6">
		<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">队伍库管理</h1>
		<button
			onclick={() => (showCreate = !showCreate)}
			class="border border-black bg-black text-white font-bold px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70"
		>
			{showCreate ? '取消' : '新建队伍 →'}
		</button>
	</div>

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
								class="border border-black bg-white px-1.5 py-0.5 text-sm font-bold transition-opacity duration-150 active:opacity-70"
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
				<button
					onclick={createTeam}
					disabled={creating}
					class="rounded-none font-sans font-bold border border-black bg-black text-white px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
				>
					{creating ? '创建中…' : '创建队伍 →'}
				</button>
			</div>
		</div>
	{/if}

	{#if teams.length === 0}
		<div class="rounded-none border border-black bg-white text-center py-12 text-sm text-neutral-500">
			暂无队伍，点击「新建队伍」开始
		</div>
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
							<span class="font-black text-2xl w-8 text-center">{team.logo_emoji || '🏆'}</span>
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
								<button
									onclick={() => saveEdit(team.id!)}
									class="rounded-none font-sans font-bold border border-black bg-black text-white px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70"
								>
									保存
								</button>
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
								<!-- 编辑模式：emoji / logo_url -->
								<div class="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black mb-4">
									<div class="border-b md:border-b-0 md:border-r border-black p-3">
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
													class="border border-black bg-white px-1.5 py-0.5 text-sm font-bold transition-opacity duration-150 active:opacity-70"
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
											bind:value={editDraft!.logo_url}
											placeholder="https://..."
											class="w-full rounded-none border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none"
										/>
									</div>
								</div>

								<!-- 选手管理 -->
								<div class="flex items-center justify-between mb-2">
									<h3 class="font-black text-sm tracking-tight text-black">选手管理</h3>
									<button
										type="button"
										onclick={addPlayer}
										class="rounded-none font-sans font-bold border border-black bg-black text-white px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70"
									>
										+ 添加选手
									</button>
								</div>

								{#if editDraft!.players.length === 0}
									<div class="rounded-none border border-black bg-white p-3 text-center text-xs text-neutral-500 font-bold">
										暂无选手
									</div>
								{:else}
									<div class="space-y-0 border-t border-l border-black">
										{#each editDraft!.players as p, i}
											<div class="rounded-none border-r border-b border-black bg-white p-2 grid grid-cols-12 gap-2 items-center">
												<div class="col-span-2 md:col-span-1">
													<input
														type="text"
														maxlength="10"
														bind:value={p.avatar_emoji}
														class="w-full rounded-none border border-black font-sans px-1 py-1 text-sm text-center bg-white focus:outline-none"
													/>
													<div class="hidden md:flex flex-wrap gap-0.5 mt-1">
														{#each avatarPresets.slice(0, 4) as av}
															<button
																type="button"
																onclick={() => (p.avatar_emoji = av)}
																class="border border-black bg-white px-1 text-xs transition-opacity duration-150 active:opacity-70"
															>
																{av}
															</button>
														{/each}
													</div>
												</div>
												<div class="col-span-5 md:col-span-4">
													<input
														type="text"
														bind:value={p.player_name}
														placeholder="选手名"
														class="w-full rounded-none border border-black font-sans px-2 py-1 text-sm bg-white focus:outline-none"
													/>
												</div>
												<div class="col-span-3 md:col-span-3">
													<select
														bind:value={p.player_role}
														class="w-full rounded-none border border-black font-sans px-1 py-1 text-sm bg-white focus:outline-none"
													>
														<option value="member">队员</option>
														<option value="captain">队长</option>
														<option value="substitute">替补</option>
														<option value="coach">教练</option>
													</select>
												</div>
												<div class="col-span-2 md:col-span-3">
													<input
														type="text"
														bind:value={p.game_id}
														placeholder="游戏 ID"
														class="w-full rounded-none border border-black font-sans px-2 py-1 text-sm bg-white focus:outline-none"
													/>
												</div>
												<div class="col-span-12 md:col-span-1 flex items-center gap-1 md:justify-end">
													<button
														type="button"
														onclick={() => setCaptain(i)}
														class="rounded-none font-sans font-bold border border-black bg-white px-2 py-1 text-xs transition-opacity duration-150 active:opacity-70"
														title="设为队长"
													>
														{p.is_captain ? '★' : '☆'}
													</button>
													<button
														type="button"
														onclick={() => removePlayer(i)}
														class="rounded-none font-sans font-bold border border-black bg-white text-accent px-2 py-1 text-xs transition-opacity duration-150 active:opacity-70"
														title="删除选手"
													>
														×
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<div class="mt-4 flex gap-2">
									<button
										onclick={() => saveEdit(team.id!)}
										disabled={creating}
										class="rounded-none font-sans font-bold border border-black bg-black text-white px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50"
									>
										保存修改 →
									</button>
									<button
										onclick={cancelEdit}
										class="rounded-none font-sans font-bold border border-black bg-white text-black px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70"
									>
										取消
									</button>
								</div>
							{:else}
								<!-- 只读模式：选手列表 -->
								{#if team.players?.length > 0}
									<div class="space-y-0 border-t border-l border-black">
										{#each team.players as p}
											<div class="rounded-none border-r border-b border-black bg-white p-2 flex items-center gap-3">
												<span class="font-black text-xl w-6 text-center">{p.avatar_emoji || '🦸'}</span>
												<div class="flex-1 min-w-0">
													<div class="font-bold text-sm text-black truncate">
														{p.player_name || '未命名'}
														{#if p.is_captain}
															<span class="text-accent ml-1" title="队长">★</span>
														{/if}
													</div>
													<div class="text-xs text-neutral-500 font-bold">
														{p.player_role} · {p.game_id || '无 ID'}
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
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
