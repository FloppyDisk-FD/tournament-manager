<script lang="ts">
	import { api } from '$lib/api/client';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Label from '$lib/components/Label.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP, REGISTRATION_STATUS_MAP } from '$lib/constants/tournament';
	import { getUser } from '$lib/stores/auth.svelte';
	import { success, error } from '$lib/stores/toast.svelte';
	import { resolveLiveEmbed, type LiveEmbed } from '$lib/utils/live';

	let { data } = $props();

	const liveUrlValue = $derived(data.tournament?.liveUrl ?? data.tournament?.live_url ?? '');
	function livePlatformLabel(url: string): string {
		if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
		if (url.includes('twitch.tv')) return 'Twitch';
		return '原平台';
	}
	let liveInfo = $state<LiveEmbed | null>(null);
	$effect(() => {
		liveInfo = liveUrlValue
			? resolveLiveEmbed(liveUrlValue, typeof window !== 'undefined' ? window.location.hostname : undefined)
			: null;
	});

	let activeTab = $state('overview');
	let bracketData = $state<any>(null);
	let standings = $state<any[]>([]);
	let loadingBracket = $state(false);
	let loadingStandings = $state(false);

	// 报名参赛（从我的队伍中选择）
	let myRegistrations = $state<any[]>([]);
	let myTeams = $state<any[]>([]);
	let regLoaded = $state(false);
	let showRegForm = $state(false);
	let regTeamId = $state('');
	let regSubmitting = $state(false);

	async function loadMyRegistrations() {
		if (!getUser()) return;
		try {
			const [regs, teams] = await Promise.all([
				api.get<any[]>(`/tournaments/${data.tournament.id}/registrations/mine`),
				api.get<any[]>('/teams/my/teams'),
			]);
			myRegistrations = Array.isArray(regs) ? regs : [];
			myTeams = Array.isArray(teams) ? teams : [];
			regLoaded = true;
		} catch { /* 未登录时忽略 */ }
	}

	$effect(() => {
		if (getUser() && !regLoaded) loadMyRegistrations();
	});

	const myReg = $derived(myRegistrations[0] ?? null);

	async function submitRegistration() {
		if (!regTeamId) { error('请选择队伍'); return; }
		regSubmitting = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/registrations`, { team_id: regTeamId });
			success('报名已提交，等待审核');
			showRegForm = false;
			regTeamId = '';
			await loadMyRegistrations();
		} catch (e: any) {
			error(e.message || '报名失败');
		} finally {
			regSubmitting = false;
		}
	}

	async function cancelRegistration() {
		if (!confirm('确定取消报名？')) return;
		try {
			await api.del(`/tournaments/${data.tournament.id}/registrations/${myReg.id}`);
			success('报名已取消');
			await loadMyRegistrations();
		} catch (e: any) {
			error(e.message || '取消失败');
		}
	}

	// 队长自助签到：我的队伍 ∩ 该赛事队伍
	let myEntryTeams = $derived(
		myTeams.filter((t) => (data.teams ?? []).some((dt: any) => dt.id === t.id)),
	);
	let checkinState = $state<Record<string, boolean>>({});

	async function selfCheckin(teamId: string) {
		try {
			const res = await api.post<{ checkedIn: boolean }>(`/tournaments/${data.tournament.id}/checkins/self/${teamId}`);
			checkinState[teamId] = res.checkedIn;
			success(res.checkedIn ? '签到成功' : '已取消签到');
		} catch (e: any) {
			error(e.message || '签到失败');
		}
	}

	const tabs = [
		{ id: 'overview', label: '总览' },
		{ id: 'bracket', label: '赛程图' },
		{ id: 'standings', label: '积分榜' },
	];

	async function loadBracket() {
		loadingBracket = true;
		try {
			bracketData = await api.get(`/tournaments/${data.tournament.id}/bracket`);
		} catch (e) {
			console.error(e);
		} finally {
			loadingBracket = false;
		}
	}

	async function loadStandings() {
		loadingStandings = true;
		try {
			standings = await api.get(`/tournaments/${data.tournament.id}/standings`);
		} catch (e) {
			console.error(e);
		} finally {
			loadingStandings = false;
		}
	}

	$effect(() => {
		if (activeTab === 'bracket' && !bracketData && !loadingBracket) loadBracket();
		if (activeTab === 'standings' && standings.length === 0 && !loadingStandings) loadStandings();
	});

	const t = $derived(data.tournament);
	const teams = $derived(data.teams);
</script>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
	<div class="mb-6">
		<BackLink href="/">← 返回首页</BackLink>
	</div>

	{#if t.coverImage ?? t.cover_image}
		<div class="border border-black overflow-hidden mb-6 lift">
			<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-40 md:h-56 object-cover" />
		</div>
	{/if}

	<div class="flex items-start justify-between mb-6 flex-wrap gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-3 mb-1 flex-wrap">
				<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
				<StatusBadge status={t.status} />
			</div>
			<p class="text-sm text-neutral-600">{t.game} · {FORMAT_MAP[t.format]} · {teams.length}/{t.maxTeams} 队</p>
		</div>
		<Button href="/tournaments/{t.id}/bracket" en="Bracket" class="whitespace-nowrap">
			全屏赛程图 →
		</Button>
	</div>

	<!-- Tabs -->
	<div class="border-b-2 border-black mb-6">
		<div class="flex gap-0" role="tablist" aria-label="赛事视图切换">
			{#each tabs as tab}
				<button
					role="tab"
					aria-selected={activeTab === tab.id}
					onclick={() => activeTab = tab.id}
					class={cn(
						'px-4 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors duration-150 press',
						activeTab === tab.id
							? 'border-accent text-black bg-neutral-50'
							: 'border-transparent text-neutral-500 hover:text-black'
					)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	{#if activeTab === 'overview'}
		<div class="animate-enter">
			{#if liveUrlValue}
				<div class="border border-black bg-white mb-8">
					<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
						<div class="flex items-center gap-2 relative z-10">
							<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
							<span class="font-black text-base tracking-tight">直播</span>
						</div>
						{#if liveInfo}
							<a href={liveInfo.url} target="_blank" rel="noopener noreferrer"
								class="relative z-10 text-xs font-bold text-white/80 border-b border-white/50 hover:text-white transition-colors duration-150">
								{liveInfo.kind === 'iframe' ? `在 ${livePlatformLabel(liveInfo.url)} 观看` : '新窗口观看'} →
							</a>
						{/if}
					</div>
					{#if liveInfo?.kind === 'iframe'}
						<iframe src={liveInfo.src} class="w-full aspect-video block" allowfullscreen loading="lazy"
							title="赛事直播" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
					{:else if liveInfo?.kind === 'link'}
						<div class="p-6 text-center">
							<p class="text-sm font-bold text-black">该直播平台不支持页内嵌入</p>
							<a href={liveUrlValue} target="_blank" rel="noopener noreferrer"
								class="inline-block mt-3 text-sm font-bold text-black border border-black px-4 py-2 hover:bg-neutral-100 transition-colors duration-150">
								前往观看 →
							</a>
						</div>
					{/if}
				</div>
			{/if}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-8">
				{#each [{ label: '赛制', value: FORMAT_MAP[t.format] }, { label: '队伍', value: `${teams.length}/${t.maxTeams}` }, { label: '局数', value: `BO${t.boCount}` }, { label: '状态', value: TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status }] as stat, i}
					<div class="border-r border-b border-black bg-white p-4 lift animate-enter" style="animation-delay:{i * 50}ms">
						<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{stat.label}</div>
						<div class="font-black text-lg mt-1">{stat.value}</div>
					</div>
				{/each}
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
				{#if t.status === 'draft'}
					<div class="border border-black bg-white">
					<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
						<div class="flex items-center gap-2 relative z-10">
							<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
							<span class="font-black text-base tracking-tight">报名参赛</span>
						</div>
						<span
							class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
							style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
						>Register</span>
					</div>
					<div class="p-4">
						{#if !getUser()}
							<div class="flex items-center justify-between gap-3 flex-wrap">
								<p class="text-sm text-neutral-500 font-bold">登录后可报名参赛</p>
								<a href="/login?redirect=/tournaments/{data.tournament.id}" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录 →</a>
							</div>
						{:else if myReg}
							<div class="flex items-center justify-between gap-3 flex-wrap">
								<div class="flex items-center gap-3 flex-wrap">
									<StatusBadge status={myReg.status} map={REGISTRATION_STATUS_MAP} />
									<span class="text-sm font-black">{myReg.teamName}</span>
									{#if myReg.status === 'rejected' && myReg.note}
										<span class="text-xs text-neutral-500 font-bold">原因：{myReg.note}</span>
									{/if}
								</div>
								{#if myReg.status === 'pending'}
									<button onclick={cancelRegistration} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">取消报名</button>
								{/if}
							</div>
						{:else if teams.length >= t.maxTeams}
							<p class="text-sm text-neutral-500 font-bold">赛事队伍名额已满</p>
						{:else if !showRegForm}
							{#if myTeams.length === 0}
								<div class="flex items-center justify-between gap-3 flex-wrap">
									<p class="text-sm text-neutral-500 font-bold">你还没有队伍，需以「队伍管理员」身份创建队伍后才能报名</p>
									{#if getUser()?.role !== 'tournament_manager'}
										<a href="/dashboard" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去我的后台 →</a>
									{/if}
								</div>
							{:else}
								<Button onclick={() => (showRegForm = true)} en="Register" class="rounded-none">报名参赛 →</Button>
							{/if}
						{:else}
							<div class="space-y-4">
								<div>
									<Label for="regTeam">选择参赛队伍 *</Label>
									<select id="regTeam" bind:value={regTeamId}
										class="w-full rounded-none border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent">
										<option value="" disabled>请选择队伍</option>
										{#each myTeams as tm}
											<option value={tm.id}>{tm.name}（{tm.players?.length ?? 0} 名选手）</option>
										{/each}
									</select>
									<p class="text-xs text-neutral-400 mt-1">报名通过后该队伍将加入赛事，队员可在「我的后台」维护。</p>
								</div>
								<div class="flex gap-2">
									<Button onclick={submitRegistration} disabled={regSubmitting} en="Submit" class="rounded-none">
										{regSubmitting ? '提交中...' : '提交报名'}
									</Button>
									<button type="button" onclick={() => (showRegForm = false)}
										class="border border-black bg-white text-black px-4 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150">取消</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

				{#if myEntryTeams.length > 0}
					<div class="border border-black bg-white">
					<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
						<div class="flex items-center gap-2 relative z-10">
							<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
							<span class="font-black text-base tracking-tight">队伍签到</span>
						</div>
						<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
							style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Check-in</span>
					</div>
					<div class="p-4 space-y-2">
						{#each myEntryTeams as t (t.id)}
							<div class="flex items-center justify-between gap-3 border border-black px-3 py-2 flex-wrap">
								<div class="flex items-center gap-2 min-w-0">
									<span class="shrink-0">{t.logo_emoji || '🏆'}</span>
									<span class="text-sm font-black truncate">{t.name}</span>
									{#if checkinState[t.id]}
										<span class="text-xs font-bold text-accent shrink-0">已签到</span>
									{/if}
								</div>
								<button
									onclick={() => selfCheckin(t.id)}
									class="rounded-none font-sans font-bold border border-black px-3 py-1 text-xs transition-colors duration-150 active:opacity-70 {checkinState[t.id]
										? 'bg-white text-accent hover:bg-neutral-100'
										: 'bg-black text-white hover:bg-neutral-800'}"
								>
									{checkinState[t.id] ? '取消签到' : '我队签到'}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			</div>

			{#if teams.length > 0}
				<h2 class="font-black text-lg md:text-xl tracking-tight mb-3">参赛队伍</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black">
					{#each teams as team, i}
						<a href="/tournaments/{data.tournament.id}/teams/{team.id}"
							class="border-r border-b border-black bg-white px-3 py-2 text-sm flex items-center gap-2 animate-enter lift hover:bg-neutral-50 transition-colors duration-150"
							style="animation-delay:{Math.min(i * 30, 300)}ms">
							<span class="text-neutral-500 font-bold tabular-nums">#{i + 1}</span>
							{#if team.logo_url ?? team.logoUrl}
								<img src={team.logo_url ?? team.logoUrl} alt={team.name} class="w-5 h-5 object-contain" />
							{:else if team.logo_emoji ?? team.logoEmoji}
								<span class="text-lg" aria-hidden="true">{team.logo_emoji ?? team.logoEmoji}</span>
							{/if}
							<span class="font-bold truncate">{team.name}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'bracket'}
		<div class="animate-enter">
			{#if loadingBracket}
				<div class="space-y-3">
					{#each Array(4) as _, i}
						<div class="skeleton h-16 w-full" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if bracketData?.stages?.length > 0}
				<div class="overflow-x-auto">
					{#each bracketData.stages as stage}
						<div class="mb-8">
							<h3 class="font-black text-lg md:text-xl tracking-tight mb-4">{stage.name}</h3>
							<div class="flex gap-8">
								{#each stage.rounds as round}
									<div class="flex flex-col gap-2">
										<div class="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">第 {round.round} 轮</div>
										{#each round.matches as match}
											{@const t1Win = match.status === 'completed' && match.team1_score > match.team2_score}
											{@const t2Win = match.status === 'completed' && match.team2_score > match.team1_score}
											<div class="border border-black bg-white min-w-[200px] text-sm overflow-hidden">
												<div class="flex justify-between items-center px-3 py-1.5 {t1Win ? 'bg-black text-white' : ''}">
													<span class="font-bold truncate">{match.team1?.name ?? 'TBD'}</span>
													<span class="font-black tabular-nums ml-2">{match.team1_score ?? 0}</span>
												</div>
												<div class="flex justify-between items-center px-3 py-1.5 {t2Win ? 'bg-black text-white' : ''} border-t border-black/10">
													<span class="font-bold truncate">{match.team2?.name ?? 'TBD'}</span>
													<span class="font-black tabular-nums ml-2">{match.team2_score ?? 0}</span>
												</div>
											</div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState title="暂无赛程数据" class="bg-neutral-50 py-12" />
			{/if}
		</div>
	{:else}
		<div class="animate-enter">
			{#if loadingStandings}
				<div class="border border-black">
					{#each Array(5) as _, i}
						<div class="skeleton h-10 w-full border-t border-black/10" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if standings.length > 0}
				<div class="border border-black">
					<table class="w-full text-sm">
						<thead class="bg-black text-white">
							<tr>
								<th class="text-left px-4 py-3 font-bold">#</th>
								<th class="text-left px-4 py-3 font-bold">队伍</th>
								<th class="text-center px-4 py-3 font-bold">胜</th>
								<th class="text-center px-4 py-3 font-bold">负</th>
								<th class="text-center px-4 py-3 font-bold">积分</th>
							</tr>
						</thead>
						<tbody>
							{#each standings as s, i}
								<tr class="border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150 {i === 0 ? 'bg-neutral-50' : ''}">
									<td class="px-4 py-2 font-black tabular-nums">{i + 1}</td>
									<td class="px-4 py-2 font-bold">{s.team?.name ?? '-'}</td>
									<td class="px-4 py-2 text-center tabular-nums">{s.wins}</td>
									<td class="px-4 py-2 text-center tabular-nums">{s.losses}</td>
									<td class="px-4 py-2 text-center font-black tabular-nums">{s.points}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<EmptyState title="暂无积分数据" class="bg-neutral-50 py-12" />
			{/if}
		</div>
	{/if}
</div>
