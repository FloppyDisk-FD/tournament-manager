<script lang="ts">
	import { onMount } from 'svelte';
	import { Users, ClipboardList, Trophy } from 'lucide-svelte';
	import { api } from '$lib/api/client';
	import { getUser } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { REGISTRATION_STATUS_MAP, PLAYER_ROLE_MAP } from '$lib/constants/tournament';
	import { normalizePlayer } from '$lib/utils/normalize';
	import { success, error } from '$lib/stores/toast.svelte';

	let myTeams = $state<any[]>([]);
	let myRegs = $state<any[]>([]);
	let myTournaments = $state<any[]>([]);
	let loaded = $state(false);

	// 创建队伍
	let creatingTeam = $state(false);
	let newTeamName = $state('');
	let newTeamEmoji = $state('🏆');
	let newTeamLogoUrl = $state('');

	// 队员编辑
	let editTeamId = $state<string | null>(null);
	let editPlayers = $state<any[]>([]);
	let saving = $state(false);

	const canCreateTeam = $derived(getUser()?.role === 'admin' || getUser()?.role === 'team_manager');
	const userRole = $derived(getUser()?.role ?? '');
	const roleLabel = $derived(
		userRole === 'admin' ? '系统管理员' :
		userRole === 'tournament_manager' ? '赛事管理者' :
		userRole === 'team_manager' ? '队伍管理员' : '普通用户'
	);

	onMount(async () => {
		if (!getUser()) { loaded = true; return; }
		try {
			const [teams, regs, tourns] = await Promise.all([
				api.get<any[]>('/teams/my/teams'),
				api.get<any[]>('/registrations/mine'),
				api.get<any>('/tournaments?mine=1&limit=50'),
			]);
			myTeams = Array.isArray(teams) ? teams : [];
			myRegs = Array.isArray(regs) ? regs : [];
			myTournaments = Array.isArray(tourns?.items) ? tourns.items : [];
		} catch (e: any) {
			error(e.message || '加载失败');
		} finally {
			loaded = true;
		}
	});

	async function createTeam() {
		if (!newTeamName.trim()) { error('请输入队名'); return; }
		creatingTeam = true;
		try {
			const team = await api.post<any>('/teams', { name: newTeamName.trim(), logo_emoji: newTeamEmoji.trim() || undefined, logo_url: newTeamLogoUrl.trim() || undefined });
			myTeams = [...myTeams, { ...team, players: [] }];
			newTeamName = '';
			newTeamEmoji = '🏆';
			newTeamLogoUrl = '';
			success('队伍已创建');
		} catch (e: any) {
			error(e.message || '创建失败');
		} finally {
			creatingTeam = false;
		}
	}

	function toggleTeamEdit(teamId: string, players: any[]) {
		if (editTeamId === teamId) {
			editTeamId = null;
		} else {
			editTeamId = teamId;
			// normalize 成 snake_case：API 返回的 players 是 camelCase（playerName 等），
			// 编辑表单按 snake_case 绑定——不归一化会全空 → 保存时清空队员数据
			editPlayers = (players ?? []).map((p: any) => normalizePlayer(p));
		}
	}

	async function saveTeamPlayers(teamId: string) {
		saving = true;
		try {
			await api.put(`/teams/${teamId}`, {
				players: editPlayers.map((p: any) => ({
					player_name: p.player_name ?? '',
					player_role: p.player_role ?? 'member',
					game_id: p.game_id ?? '',
					avatar_url: p.avatar_url ?? '',
					is_captain: p.is_captain ?? false,
				})),
			});
			const idx = myTeams.findIndex((t) => t.id === teamId);
			if (idx >= 0) myTeams[idx] = { ...myTeams[idx], players: [...editPlayers] };
			editTeamId = null;
			success('队员已保存');
		} catch (e: any) {
			error(e.message || '保存失败');
		} finally {
			saving = false;
		}
	}
</script>

<div class="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 animate-enter">
	<div class="flex items-baseline justify-between mb-8 flex-wrap gap-2">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">我的后台</h1>
			<p class="text-sm text-neutral-600 mt-1 flex items-center gap-2 flex-wrap">
				<span>{getUser()?.username ?? '未登录'}</span>
				{#if userRole}
					<span class="text-[10px] font-black bg-black text-white px-1.5 py-0.5">{roleLabel}</span>
				{/if}
			</p>
		</div>
		<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Dashboard</span>
	</div>

	{#if !getUser()}
		<div class="border border-black bg-white text-center py-16">
			<p class="text-sm text-neutral-500 font-bold mb-3">请先登录</p>
			<a href="/login" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</a>
		</div>
	{:else if !loaded}
		<div class="space-y-3">
			<div class="skeleton h-16 w-full" aria-hidden="true"></div>
			<div class="skeleton h-16 w-full" aria-hidden="true"></div>
		</div>
	{:else}
		<!-- 我的队伍 -->
		<div class="mb-10">
			<div class="flex items-center gap-2 mb-3">
				<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
				<Users size={14} class="text-neutral-700" aria-hidden="true" />
				<span class="text-xs font-bold uppercase tracking-widest text-neutral-700">我的队伍</span>
			</div>
			{#if !canCreateTeam}
				<!-- 普通用户：无建队权限，引导浏览/报名 -->
				<div class="border border-black bg-white px-4 py-6 text-center">
					<p class="text-sm text-neutral-500 font-bold">成为「队伍管理员」后即可创建并管理队伍</p>
					<div class="mt-3 flex items-center justify-center gap-3 flex-wrap">
						<a href="/teams" class="text-sm font-black border border-black px-3 py-1.5 bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150">浏览队伍库</a>
						<a href="/" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去报名参赛 →</a>
					</div>
				</div>
			{:else}
				<div class="border border-black bg-white mb-3">
					<div class="flex flex-col md:flex-row gap-2 items-center p-3 border-b border-black">
						<Input bind:value={newTeamEmoji} class="w-16 text-center" placeholder="🏆" />
						<Input bind:value={newTeamName} placeholder="新队伍名称" class="flex-1" />
						<Input bind:value={newTeamLogoUrl} placeholder="队伍头像图片 URL（可选）" class="flex-1" />
						<Button onclick={createTeam} disabled={creatingTeam} en="Create" class="rounded-none shrink-0">
							{creatingTeam ? '创建中...' : '创建队伍'}
						</Button>
					</div>
					{#if newTeamLogoUrl}
						<div class="px-3 py-2 border-t border-black">
							<img src={newTeamLogoUrl} alt="头像预览" class="w-10 h-10 object-contain border border-black" />
						</div>
					{/if}
				</div>
			{/if}
			{#if myTeams.length === 0}
				<div class="border border-black bg-white text-center py-8">
					<p class="text-sm text-neutral-500 font-bold">还没有队伍</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each myTeams as tm (tm.id)}
						<div class="border border-black bg-white">
							<div class="relative overflow-hidden flex items-center justify-between gap-3 px-3 py-2 bg-black text-white">
								<div class="flex items-center gap-2 relative z-10 min-w-0">
									<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
									{#if tm.logoUrl ?? tm.logo_url}
										<img src={tm.logoUrl ?? tm.logo_url} alt={tm.name} class="w-5 h-5 object-contain shrink-0" />
									{:else}
										<span class="shrink-0">{(tm.logoEmoji ?? tm.logo_emoji) || '🏆'}</span>
									{/if}
									<span class="text-sm font-black truncate">{tm.name}</span>
								</div>
								<div class="flex items-center gap-3 relative z-10 shrink-0">
									<span class="text-xs text-white/70">{tm.players?.length ?? 0} 名选手</span>
									<button onclick={() => toggleTeamEdit(tm.id, tm.players)}
										class="text-xs font-bold text-white/80 border-b border-white/50 hover:text-white hover:border-white transition-colors duration-150">
										{editTeamId === tm.id ? '收起' : '管理队员'}
									</button>
								</div>
								<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
									style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Team</span>
							</div>
							{#if editTeamId === tm.id}
								<div class="p-3">
									<div class="space-y-2">
										{#each editPlayers as p, i}
											<div class="border border-black bg-white">
												<div class="flex gap-2 items-center p-1">
													<Input bind:value={p.player_name} placeholder="姓名" class="flex-1" />
													<Select
														bind:value={p.player_role}
														options={Object.entries(PLAYER_ROLE_MAP).map(([value, label]) => ({ value, label }))}
														class="w-24 px-2"
													/>
													<Input bind:value={p.game_id} placeholder="游戏 ID" class="flex-1" />
													<button type="button" onclick={() => (editPlayers = editPlayers.filter((_, j) => j !== i))}
														class="text-sm font-bold text-accent border border-accent px-3 py-1.5 hover:opacity-70 transition-opacity duration-150">×</button>
												</div>
												<div class="flex gap-2 items-center px-1 pb-1">
													<Input bind:value={p.avatar_url} placeholder="选手头像图片 URL（可选）" class="flex-1" />
													{#if p.avatar_url}
														<img src={p.avatar_url} alt="头像预览" class="w-8 h-8 object-cover border border-black shrink-0" />
													{/if}
												</div>
											</div>
										{/each}
									</div>
									<button type="button" onclick={() => (editPlayers = [...editPlayers, { player_name: '', player_role: 'member', game_id: '', avatar_url: '', is_captain: false }])}
										class="mt-2 text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">+ 添加队员</button>
									<div class="mt-3 flex gap-2">
										<Button onclick={() => saveTeamPlayers(tm.id)} disabled={saving} en="Save" class="rounded-none">
											{saving ? '保存中...' : '保存队员'}
										</Button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 我的报名 -->
		<div class="mb-10">
			<div class="flex items-center gap-2 mb-3">
				<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
				<ClipboardList size={14} class="text-neutral-700" aria-hidden="true" />
				<span class="text-xs font-bold uppercase tracking-widest text-neutral-700">我的报名</span>
			</div>
			{#if myRegs.length === 0}
				<div class="border border-black bg-white text-center py-8">
					<p class="text-sm text-neutral-500 font-bold">暂无报名记录</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each myRegs as reg (reg.id)}
						<div class="border border-black bg-white px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
							<div class="flex items-center gap-3 flex-wrap">
								<StatusBadge status={reg.status} map={REGISTRATION_STATUS_MAP} />
								<a href="/tournaments/{reg.tournamentId}" class="text-sm font-black hover:text-accent transition-colors duration-150">{reg.tournament?.name ?? '赛事'}</a>
								<span class="text-xs text-neutral-500 font-bold">队伍：{reg.teamName}</span>
							</div>
							{#if reg.status === 'rejected' && reg.note}
								<span class="text-xs text-neutral-500 font-bold">原因：{reg.note}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 我的赛事（赛事管理者） -->
		{#if myTournaments.length > 0}
			<div class="mb-10">
				<div class="flex items-center gap-2 mb-3">
					<span class="inline-block w-1 h-3.5 bg-black" aria-hidden="true"></span>
					<Trophy size={14} class="text-neutral-700" aria-hidden="true" />
					<span class="text-xs font-bold uppercase tracking-widest text-neutral-700">我管理的赛事</span>
				</div>
				<div class="space-y-2">
					{#each myTournaments as t (t.id)}
						<a href="/admin/tournaments/{t.id}" class="border border-black bg-white px-3 py-2 flex items-center justify-between gap-3 hover:bg-neutral-50 transition-colors duration-150">
							<div class="flex items-center gap-3 min-w-0">
								<StatusBadge status={t.status} />
								<span class="text-sm font-black truncate">{t.name}</span>
							</div>
							<span class="text-sm font-bold shrink-0">管理 →</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
