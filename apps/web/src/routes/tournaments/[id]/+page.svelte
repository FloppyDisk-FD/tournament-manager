<script lang="ts">
	import { api } from '$lib/api/client';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Input from '$lib/components/Input.svelte';
	import Label from '$lib/components/Label.svelte';
	import Select from '$lib/components/Select.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP, REGISTRATION_STATUS_MAP } from '$lib/constants/tournament';
	import { getUser } from '$lib/stores/auth.svelte';
	import { success, error } from '$lib/stores/toast.svelte';
	import { resolveLiveEmbed, type LiveEmbed } from '$lib/utils/live';
	import { renderMarkdown } from '$lib/utils/markdown';
import { ArrowRight, ChartLine, Trophy } from 'lucide-svelte';

	let { data } = $props();

	const liveUrlValue = $derived(data.tournament?.liveUrl ?? data.tournament?.live_url ?? '');
	const bannerUrlValue = $derived(data.tournament?.bannerUrl ?? data.tournament?.banner_url ?? '');
	const sponsorList = $derived(
		(data.tournament?.sponsors ?? []).map((s: any) => ({
			name: s?.name ?? '',
			logoUrl: s?.logoUrl ?? s?.logo_url ?? '',
			url: s?.url ?? '',
		})) as { name: string; logoUrl: string; url: string }[]
	);
	const bannerLink = $derived(sponsorList.find((s) => s.url)?.url ?? bannerUrlValue);
	const rulesHtml = $derived(renderMarkdown(data.tournament?.rules ?? ''));
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

	// —— 时间线：赛程 + 实时比分 + 预测 ——
	let timelineMatches = $state<any[]>([]);
	let predictionStats = $state<Record<string, any>>({});
	let leaderboard = $state<any>(null);
	let loadingTimeline = $state(false);
	let predicting = $state<string | null>(null);

	const user = $derived(getUser());

	async function loadTimeline() {
		if (loadingTimeline && timelineMatches.length > 0) return;
		loadingTimeline = true;
		try {
			const [m, p] = await Promise.all([
				api.get<any[]>(`/tournaments/${data.tournament.id}/matches`),
				api.get<any>(`/tournaments/${data.tournament.id}/predictions`).catch(() => ({}))
			]);
			timelineMatches = Array.isArray(m) ? m : [];
			predictionStats = p ?? {};
			// 排行榜需要登录，未登录时为 null（展示引导）
			api.get<any>(`/tournaments/${data.tournament.id}/predictions/leaderboard`).then((lb) => {
				leaderboard = lb;
			}).catch(() => {
				leaderboard = null;
			});
		} catch (e) {
			console.error(e);
		} finally {
			loadingTimeline = false;
		}
	}

	let pollTimer: ReturnType<typeof setInterval> | undefined;
	$effect(() => {
		if (activeTab === 'timeline') {
			if (timelineMatches.length === 0 && !loadingTimeline) loadTimeline();
			pollTimer = setInterval(async () => {
				// 实时比分：仅刷新比分/状态，避免覆盖正在进行的预测交互
				try {
					const [m, p] = await Promise.all([
						api.get<any[]>(`/tournaments/${data.tournament.id}/matches`),
						api.get<any>(`/tournaments/${data.tournament.id}/predictions`).catch(() => ({}))
					]);
					timelineMatches = Array.isArray(m) ? m : [];
					predictionStats = p ?? {};
					api.get<any>(`/tournaments/${data.tournament.id}/predictions/leaderboard`).then((lb) => {
						leaderboard = lb;
					}).catch(() => {
						leaderboard = null;
					});
				} catch (e) {
					console.error(e);
				}
			}, 20000);
			return () => {
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = undefined;
			};
		}
	});

	async function vote(matchId: string, winnerTeamId: string) {
		if (!user || predicting) return;
		predicting = matchId;
		try {
			await api.post(`/tournaments/${data.tournament.id}/predictions`, {
				match_id: matchId,
				winner_team_id: winnerTeamId
			});
			const p = await api.get<any>(`/tournaments/${data.tournament.id}/predictions`).catch(() => ({}));
			predictionStats = p ?? {};
			success('预测已提交');
		} catch (e: any) {
			console.error(e);
			error(e?.message ?? '预测失败');
		} finally {
			predicting = null;
		}
	}

	async function cancelVote(matchId: string) {
		if (!user || predicting) return;
		predicting = matchId;
		try {
			await api.del(`/tournaments/${data.tournament.id}/predictions`, { match_id: matchId });
			const p = await api.get<any>(`/tournaments/${data.tournament.id}/predictions`).catch(() => ({}));
			predictionStats = p ?? {};
			success('已撤销预测');
		} catch (e: any) {
			console.error(e);
			error(e?.message ?? '操作失败');
		} finally {
			predicting = null;
		}
	}

	function dayLabel(iso: string | null): string {
		if (!iso) return '未排期';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '未排期';
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const day = new Date(d);
		day.setHours(0, 0, 0, 0);
		const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
		if (diff === 0) return '今天';
		if (diff === 1) return '明天';
		if (diff === -1) return '昨天';
		const week = ['日', '一', '二', '三', '四', '五', '六'];
		if (diff > 1 && diff < 7) return `${week[d.getDay()]}（+${diff} 天）`;
		return `${d.getMonth() + 1}月${d.getDate()}日`;
	}

	function timeLabel(iso: string | null): string {
		if (!iso) return '时间待定';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '时间待定';
		return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
	}

	const timelineGroups = $derived.by(() => {
		const order = ['今天', '明天', '未排期'];
		const groups: { label: string; matches: any[] }[] = [];
		for (const m of timelineMatches) {
			const label = dayLabel(m.scheduled_at ?? null);
			let g = groups.find((x) => x.label === label);
			if (!g) {
				g = { label, matches: [] };
				groups.push(g);
			}
			g.matches.push(m);
		}
		groups.sort((a, b) => {
			const ia = order.indexOf(a.label);
			const ib = order.indexOf(b.label);
			if (ia !== -1 && ib !== -1) return ia - ib;
			if (ia !== -1) return -1;
			if (ib !== -1) return 1;
			return a.label.localeCompare(b.label, 'zh-CN');
		});
		for (const g of groups) {
			g.matches.sort((a, b) => {
				const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
				const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
				if (ta !== tb) return ta - tb;
				return (a.stage_order ?? 0) - (b.stage_order ?? 0) || (a.round ?? 0) - (b.round ?? 0);
			});
		}
		return groups;
	});

	function matchStatusLabel(m: any): { text: string; cls: string } {
		if (m.status === 'in_progress') return { text: '进行中', cls: 'bg-accent text-white' };
		if (m.status === 'completed') return { text: '已结束', cls: 'bg-black text-white' };
		if (m.status === 'walkthrough') return { text: '轮空', cls: 'bg-neutral-200 text-neutral-600' };
		return { text: '待赛', cls: 'bg-white text-black border border-black' };
	}

	function logoOf(t: any): string | null {
		return t?.logo_url ?? t?.logoUrl ?? null;
	}
	function emojiOf(t: any): string | null {
		return t?.logo_emoji ?? t?.logoEmoji ?? null;
	}

	// 报名参赛（从我的队伍中选择）
	let myRegistrations = $state<any[]>([]);
	let myTeams = $state<any[]>([]);
	let regLoaded = $state(false);
	let showRegForm = $state(false);
	let regTeamId = $state('');
	let regSubmitting = $state(false);
	let regAnswers = $state<Record<string, string>>({});
	const customFields = $derived(Array.isArray(data.tournament?.customFields) ? data.tournament.customFields : []);
	let payOrder = $state<any>(null);
	let paying = $state(false);

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
			const res = await api.post<any>(`/tournaments/${data.tournament.id}/registrations`, { team_id: regTeamId, answers: regAnswers });
			showRegForm = false;
			regTeamId = '';
			regAnswers = {};
			await loadMyRegistrations();
			if (res?.payment) {
				payOrder = res.payment;
				success('报名已提交，请完成支付');
			} else {
				success('报名已提交，等待审核');
			}
		} catch (e: any) {
			error(e.message || '报名失败');
		} finally {
			regSubmitting = false;
		}
	}

	async function payOrderPay() {
		if (!payOrder) return;
		paying = true;
		try {
			const res: any = await api.post(`/payments/${payOrder.id}/pay`);
			// Waffo 网关：返回 checkoutUrl，新标签打开托管收银台（SKILL 禁用 location.href 跳转）
			if (res?.checkoutUrl) {
				window.open(res.checkoutUrl, '_blank', 'noopener,noreferrer');
				success('请在打开的支付页完成付款，支付成功后将自动回到赛事页');
				payOrder = null;
				await loadMyRegistrations();
				return;
			}
			success('支付成功，报名等待审核');
			payOrder = null;
			await loadMyRegistrations();
		} catch (e: any) {
			error(e.message || '支付失败');
		} finally {
			paying = false;
		}
	}

	async function retryPay(p: any) {
		payOrder = p;
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
		{ id: 'timeline', label: '时间线' },
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
	const sortedTeams = $derived([...(teams ?? [])].sort((a: any, b: any) => (a.seed ?? 0) - (b.seed ?? 0)));
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

	{#if bannerUrlValue || sponsorList.length > 0}
		<div class="grid grid-cols-1 gap-6 mb-6 {bannerUrlValue && sponsorList.length > 0 ? 'md:grid-cols-2' : ''}">
			{#if bannerUrlValue}
				<div class="border border-black overflow-hidden">
					<a href={bannerLink} target="_blank" rel="noopener noreferrer" class="block h-full" aria-label="赛事广告横幅">
						<img src={bannerUrlValue} alt="赛事广告" class="w-full h-full min-h-[120px] object-cover" />
					</a>
				</div>
			{/if}
			{#if sponsorList.length > 0}
				<div class="border border-black bg-white">
					<div class="flex items-center justify-between px-4 py-3 border-b border-black">
						<div class="flex items-center gap-2">
							<span class="inline-block w-1 h-1 bg-accent"></span>
							<span class="font-black text-sm tracking-tight">赞助商</span>
						</div>
						<span class="text-xs text-neutral-400 font-bold">{sponsorList.length} 家</span>
					</div>
					<div class="p-4 flex flex-wrap items-center gap-3">
						{#each sponsorList as s}
							{#if s.url}
								<a href={s.url} target="_blank" rel="noopener noreferrer"
									class="border border-black bg-white px-4 py-3 flex items-center gap-2 hover:bg-neutral-100 transition-colors duration-150 min-w-[120px] justify-center">
									{#if s.logoUrl}
										<img src={s.logoUrl} alt={s.name} class="h-8 w-auto max-w-[120px] object-contain" loading="lazy" />
									{:else}
										<span class="font-black text-sm text-black">{s.name}</span>
									{/if}
								</a>
							{:else}
								<div class="border border-black bg-white px-4 py-3 flex items-center gap-2 min-w-[120px] justify-center">
									{#if s.logoUrl}
										<img src={s.logoUrl} alt={s.name} class="h-8 w-auto max-w-[120px] object-contain" loading="lazy" />
									{:else}
										<span class="font-black text-sm text-black">{s.name}</span>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
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
		<div class="flex items-center gap-3 shrink-0">
			{#if t.status === 'completed'}
				<Button href="/tournaments/{t.id}/review" en="Review" class="whitespace-nowrap">
					赛事回顾 →
				</Button>
			{/if}
			<Button href="/tournaments/{t.id}/bracket" en="Bracket" class="whitespace-nowrap">
				全屏赛程图 →
			</Button>
		</div>
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
						'flex-1 px-2 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors duration-150 press text-center whitespace-nowrap',
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
								class="relative z-10 text-xs font-bold text-white border border-white/60 px-3 py-1.5 hover:bg-white hover:text-black transition-colors duration-150">
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
			{#if data.tournament?.rules}
				<div class="border border-black bg-white mb-8">
					<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
						<div class="flex items-center gap-2 relative z-10">
							<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
							<span class="font-black text-base tracking-tight">赛事规则</span>
						</div>
						<a href="/tournaments/{data.tournament.id}/rules" class="relative z-10 inline-flex items-center gap-1 text-xs font-black text-white/70 hover:text-accent transition-colors duration-150">
							完整规则
							<ArrowRight size={12} class="shrink-0" aria-hidden="true" />
						</a>
					</div>
					<div class="p-4 md:p-5 rules-markdown">{@html rulesHtml}</div>
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
				{#if t.status === 'draft' || t.status === 'ongoing'}
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
									{#if myReg.payment?.status === 'paid'}
										<span class="text-xs font-bold bg-black text-white px-1.5 py-0.5">已支付 ¥{myReg.payment.amount}</span>
									{:else if myReg.payment?.status === 'refunded'}
										<span class="text-xs font-bold bg-neutral-200 text-black border border-black px-1.5 py-0.5">已退款 ¥{myReg.payment.amount}</span>
									{/if}
									<span class="text-sm font-black">{myReg.teamName}</span>
									{#if myReg.status === 'rejected' && myReg.note}
										<span class="text-xs text-neutral-500 font-bold">原因：{myReg.note}</span>
									{/if}
								</div>
								{#if myReg.payment && myReg.payment.status === 'pending'}
									<button onclick={() => retryPay(myReg.payment)} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">去支付</button>
								{/if}
								{#if myReg.status === 'pending' && myReg.payment?.status !== 'paid'}
									<button onclick={cancelRegistration} class="text-sm font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">取消报名</button>
								{/if}
								{#if myReg.status === 'rejected' && teams.length < t.maxTeams}
									<button onclick={() => (showRegForm = true)} class="text-sm font-black border border-black px-3 py-1.5 bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150">重新申请</button>
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
								<div class="flex items-center gap-3 flex-wrap">
									{#if t.entryFee > 0}
										<span class="text-xs font-black bg-neutral-100 border border-black px-1.5 py-0.5">报名费 ¥{t.entryFee}</span>
									{/if}
									<Button onclick={() => (showRegForm = true)} en="Register" class="rounded-none">报名参赛 →</Button>
								</div>
							{/if}
						{:else}
							<div class="space-y-4">
								<div>
									<Label for="regTeam">选择参赛队伍 *</Label>
									<Select id="regTeam" bind:value={regTeamId} placeholder="请选择队伍" options={myTeams.map((tm) => ({ value: tm.id, label: `${tm.name}（${tm.players?.length ?? 0} 名选手）` }))} />
									<p class="text-xs text-neutral-400 mt-1">报名通过后该队伍将加入赛事，队员可在「我的后台」维护。</p>
								</div>
								{#if customFields.length > 0}
									<div class="space-y-3">
										{#each customFields as f (f.key)}
											<div>
												<Label for={`cf-${f.key}`}>{f.label}{f.required ? ' *' : ''}</Label>
												{#if f.type === 'select'}
													<Select id={`cf-${f.key}`} bind:value={regAnswers[f.key]} placeholder="请选择" options={(f.options ?? []).map((opt: string) => ({ value: opt, label: opt }))} />
												{:else if f.type === 'textarea'}
													<textarea id={`cf-${f.key}`} bind:value={regAnswers[f.key]} rows="3"
														class="w-full rounded-none border border-black font-sans px-3 py-2 text-sm bg-white focus:outline-none focus:border-accent"></textarea>
												{:else}
													<Input id={`cf-${f.key}`} type={f.type === 'number' ? 'number' : 'text'} bind:value={regAnswers[f.key]} placeholder={f.placeholder ?? ''} />
												{/if}
											</div>
										{/each}
									</div>
								{/if}
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
				{:else if t.status === 'completed' || t.status === 'cancelled'}
					<div class="border border-black bg-white">
						<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
							<div class="flex items-center gap-2 relative z-10">
								<span class="inline-block w-1 h-1 bg-neutral-500 shrink-0" aria-hidden="true"></span>
								<span class="font-black text-base tracking-tight">报名参赛</span>
							</div>
							<span
								class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
								style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
							>Register</span>
						</div>
						<div class="p-4">
							<p class="text-sm font-bold text-neutral-500">
								{t.status === 'completed' ? '赛事已结束，报名已截止' : '赛事已取消，报名已关闭'}
							</p>
						</div>
					</div>
				{/if}

				{#if payOrder}
					<div class="mt-4 border border-black">
						<div class="px-4 py-2.5 bg-black text-white flex items-center gap-2">
							<span class="inline-block w-1 h-1 bg-accent"></span>
							<span class="font-black text-sm tracking-tight">支付报名费</span>
						</div>
						<div class="p-4 space-y-3">
							<div class="flex justify-between text-sm font-bold"><span class="text-neutral-500">队伍</span><span>{myReg?.teamName ?? '—'}</span></div>
							<div class="flex justify-between text-sm font-bold"><span class="text-neutral-500">订单号</span><span class="font-mono">{payOrder.id.slice(0, 8).toUpperCase()}</span></div>
							<div class="flex justify-between text-sm font-black"><span>应付金额</span><span class="text-accent">¥{payOrder.amount}</span></div>
							<p class="text-xs text-neutral-500 font-bold">当前为模拟支付环境，点击按钮即视为支付成功。</p>
							<div class="flex gap-2">
								<Button onclick={payOrderPay} disabled={paying} en="Pay" class="rounded-none">
									{paying ? '支付中...' : `确认支付 ¥${payOrder.amount}`}
								</Button>
								<button onclick={() => (payOrder = null)} class="border border-black bg-white text-black px-4 py-2 text-sm font-bold hover:bg-neutral-100 transition-colors duration-150">稍后支付</button>
							</div>
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
					{#each sortedTeams as team, i}
						<a href="/tournaments/{data.tournament.id}/teams/{team.id}"
							class="border-r border-b border-black bg-white px-3 py-2 text-sm flex items-center gap-2 animate-enter lift hover:bg-neutral-50 transition-colors duration-150"
							style="animation-delay:{Math.min(i * 30, 300)}ms">
							<span class="text-neutral-500 font-bold tabular-nums">#{team.seed ?? i + 1}</span>
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
	{:else if activeTab === 'timeline'}
		<div class="animate-enter">
			{#if loadingTimeline && timelineMatches.length === 0}
				<div class="space-y-3">
					{#each Array(4) as _, i}
						<div class="skeleton h-16 w-full" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if timelineGroups.length === 0}
				<EmptyState title="暂无赛程安排" class="bg-neutral-50 py-12" />
			{:else}
			<!-- 竞猜排行榜 -->
			<div class="border border-black bg-white mb-8">
				<PanelHeader
					title="竞猜排行榜"
					watermark="Leaderboard"
					meta={user && leaderboard?.myRank ? `我的排名 #${leaderboard.myRank}` : undefined}
				/>
				<div class="p-4">
					{#if !user}
						<p class="text-xs font-bold text-neutral-500">登录后可查看竞猜排行榜并参与预测，猜对一场 +1 分</p>
					{:else if !leaderboard}
						<div class="skeleton h-24 w-full" aria-hidden="true"></div>
					{:else if leaderboard.leaderboard.length === 0}
						<p class="text-xs font-bold text-neutral-500">暂无竞猜数据，快去预测比赛吧</p>
					{:else}
						<div class="divide-y divide-black/10">
							{#each leaderboard.leaderboard.slice(0, 10) as row}
								<div class="flex items-center gap-3 py-2 {row.userId === user?.id ? 'bg-neutral-100 px-2 -mx-2' : ''}">
									<span
										class="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-black tabular-nums {row.rank <= 3
											? 'bg-black text-white'
											: 'bg-neutral-100 text-neutral-500 border border-black/10'}"
									>{row.rank}</span>
									{#if row.avatarUrl}
										<img src={row.avatarUrl} alt={row.displayName ?? row.username} class="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
									{:else}
										<span class="w-6 h-6 rounded-full bg-neutral-200 border border-black/10 flex items-center justify-center text-[10px] font-black text-neutral-500 shrink-0" aria-hidden="true">
											{(row.displayName ?? row.username).slice(0, 1).toUpperCase()}
										</span>
									{/if}
									<span class="font-bold text-sm truncate min-w-0">
										{row.displayName ?? row.username}
										{#if row.userId === user?.id}
											<span class="text-[10px] font-black text-accent ml-1">我</span>
										{/if}
									</span>
									<span class="ml-auto flex items-center gap-3 shrink-0">
										<span class="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-400 tabular-nums">
											<ChartLine size={12} class="shrink-0" aria-hidden="true" />
											预测 {row.votes} 场
										</span>
										<span class="inline-flex items-center gap-1 text-sm font-black tabular-nums border border-black px-1.5 py-0.5">
											<Trophy size={12} class="shrink-0 text-accent" aria-hidden="true" />
											{row.correct} 分
										</span>
									</span>
								</div>
							{/each}
						</div>
						<p class="text-[10px] font-bold text-neutral-400 mt-3">规则：预测正确一场 +1 分，同分按命中率排名；仅统计已结束比赛</p>
					{/if}
				</div>
			</div>
				<div class="space-y-8">
					{#each timelineGroups as group}
						<section aria-label={group.label}>
							<h3 class="font-black text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
								<span class="inline-block w-1 h-4 bg-accent"></span>
								{group.label}
								<span class="text-neutral-400 font-bold text-xs">{group.matches.length} 场</span>
							</h3>
							<div class="space-y-3">
								{#each group.matches as m}
									{@const st = matchStatusLabel(m)}
									{@const ps = predictionStats[m.id] ?? { team1Votes: 0, team2Votes: 0, total: 0, myPick: null }}
									{@const t1VotePct = ps.total > 0 ? Math.round((ps.team1Votes / ps.total) * 100) : 0}
									{@const t2VotePct = ps.total > 0 ? Math.round((ps.team2Votes / ps.total) * 100) : 0}
									{@const ended = m.status === 'completed' || m.status === 'walkthrough'}
									{@const t1Won = m.status === 'completed' && (m.team1_score ?? 0) > (m.team2_score ?? 0)}
									{@const t2Won = m.status === 'completed' && (m.team2_score ?? 0) > (m.team1_score ?? 0)}
									<div class="border border-black bg-white">
										<div class="flex items-center gap-3 px-4 py-2 border-b border-black/10">
											<span class="text-xs font-bold text-neutral-500 tabular-nums">{timeLabel(m.scheduled_at ?? null)}</span>
											<span class="text-xs font-bold text-neutral-400">{m.stage_name ?? '赛程'} · 第 {m.round ?? 1} 轮</span>
											<span class="ml-auto text-[10px] font-black px-2 py-0.5 uppercase tracking-wider {st.cls}">{st.text}</span>
										</div>
										<div class="grid md:grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
											<!-- 队伍 A -->
											<div class="flex items-center gap-2 min-w-0 {t1Won ? 'font-black' : ''}">
												<span class="shrink-0 w-6 h-6 flex items-center justify-center text-base">
													{#if logoOf(m.team1)}
														<img src={logoOf(m.team1)} alt={m.team1?.name ?? ''} class="w-6 h-6 object-contain" loading="lazy" />
													{:else if emojiOf(m.team1)}
														<span aria-hidden="true">{emojiOf(m.team1)}</span>
													{:else}
														<span class="w-6 h-6 inline-block bg-neutral-100 border border-black" aria-hidden="true"></span>
													{/if}
												</span>
												<span class="font-bold truncate">{m.team1?.name ?? 'TBD'}</span>
											</div>
											<!-- 比分 -->
											<div class="text-center shrink-0">
												<span class="font-black text-xl tabular-nums">{m.team1_score ?? 0}<span class="text-neutral-400 mx-1 text-sm">:</span>{m.team2_score ?? 0}</span>
												{#if m.status === 'in_progress'}
													<span class="block text-[10px] font-black text-accent uppercase tracking-wider animate-pulse">LIVE</span>
												{/if}
											</div>
											<!-- 队伍 B -->
											<div class="flex items-center gap-2 min-w-0 justify-end {t2Won ? 'font-black' : ''}">
												<span class="font-bold truncate">{m.team2?.name ?? 'TBD'}</span>
												<span class="shrink-0 w-6 h-6 flex items-center justify-center text-base">
													{#if logoOf(m.team2)}
														<img src={logoOf(m.team2)} alt={m.team2?.name ?? ''} class="w-6 h-6 object-contain" loading="lazy" />
													{:else if emojiOf(m.team2)}
														<span aria-hidden="true">{emojiOf(m.team2)}</span>
													{:else}
														<span class="w-6 h-6 inline-block bg-neutral-100 border border-black" aria-hidden="true"></span>
													{/if}
												</span>
											</div>
										</div>
										<!-- 预测区 -->
										<div class="border-t border-black/10 px-4 py-3 bg-neutral-50">
											{#if !user}
												<p class="text-xs font-bold text-neutral-500">登录后可参与预测竞猜</p>
											{:else if ended}
												<p class="text-xs font-bold text-neutral-500">比赛已结束 · 预测 {ps.total} 票（A {ps.team1Votes} / B {ps.team2Votes}）</p>
											{:else}
												<div class="flex items-center gap-3">
													<span class="text-[10px] font-black uppercase tracking-wider text-neutral-500 shrink-0">预测</span>
													<button
														class="flex-1 border text-xs font-bold px-2 py-1.5 transition-colors {ps.myPick === m.team1?.id ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-neutral-100'}"
														type="button"
														disabled={predicting === m.id || !m.team1?.id}
														onclick={() => vote(m.id, m.team1?.id)}
													>
														{m.team1?.name ?? 'A'} 胜 · {ps.team1Votes} 票
													</button>
													<button
														class="flex-1 border text-xs font-bold px-2 py-1.5 transition-colors {ps.myPick === m.team2?.id ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-neutral-100'}"
														type="button"
														disabled={predicting === m.id || !m.team2?.id}
														onclick={() => vote(m.id, m.team2?.id)}
													>
														{m.team2?.name ?? 'B'} 胜 · {ps.team2Votes} 票
													</button>
													{#if ps.myPick}
														<button
															class="text-[10px] font-bold text-neutral-500 underline underline-offset-2 shrink-0"
															type="button"
															disabled={predicting === m.id}
															onclick={() => cancelVote(m.id)}
														>撤销</button>
													{/if}
												</div>
												<div class="flex items-center gap-2 mt-2">
													<span class="text-[10px] font-bold text-neutral-500 tabular-nums shrink-0">
														<span class="inline-block w-2 h-2 bg-black align-[-1px]" aria-hidden="true"></span> {t1VotePct}%
													</span>
													<div class="flex flex-1 h-1.5 border border-black/20" role="img" aria-label="预测票数分布">
														<div class="h-full bg-black" style="width: {t1VotePct}%"></div>
														<div class="h-full bg-accent" style="width: {t2VotePct}%"></div>
													</div>
													<span class="text-[10px] font-bold text-neutral-500 tabular-nums shrink-0">
														<span class="inline-block w-2 h-2 bg-accent align-[-1px]" aria-hidden="true"></span> {t2VotePct}%
													</span>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</section>
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
