<script lang="ts">
	import { api } from '$lib/api/client';
	import { ArrowRight, Check, Circle, QrCode } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import Button from '$lib/components/Button.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import Input from '$lib/components/Input.svelte';
	import SeedRankingPanel from '$lib/components/SeedRankingPanel.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP, REGISTRATION_STATUS_MAP } from '$lib/constants/tournament';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let generating = $state(false);
	let editingBanner = $state(false);
	let bannerUrl = $state(data.tournament?.coverImage ?? data.tournament?.cover_image ?? '');

	// 报名审核
	let registrations = $state<any[]>([]);
	let regLoaded = $state(false);
	let reviewing = $state<string | null>(null);

	// 签到管理
	let checkins = $state<any>({ teams: [], stats: { total: 0, checked: 0 } });
	let checkinLoaded = $state(false);
	let checkinToggling = $state<string | null>(null);

	async function loadCheckins() {
		try {
			const res = await api.get<any>(`/tournaments/${data.tournament.id}/checkins`);
			checkins = res ?? { teams: [], stats: { total: 0, checked: 0 } };
			checkinLoaded = true;
		} catch { /* ignore */ }
	}

	async function toggleCheckin(teamId: string) {
		checkinToggling = teamId;
		try {
			await api.post(`/tournaments/${data.tournament.id}/checkins/team/${teamId}`);
			await loadCheckins();
		} catch (e: any) {
			error(e.message);
		} finally {
			checkinToggling = null;
		}
	}

	$effect(() => {
		if (data.tournament && !checkinLoaded) loadCheckins();
	});

	// 签到二维码（单码：所有队伍扫同一个码）
	let qrOpen = $state(false);
	let qrUrl = $state('');

	async function showQr() {
		const url = `${window.location.origin}/tournaments/${data.tournament.id}/checkin`;
		const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
		qrUrl = dataUrl;
		qrOpen = true;
	}

	// 手动种子排位（面板组件化）
	let seedPanelOpen = $state(false);

	async function loadRegistrations() {
		try {
			const res = await api.get<any[]>(`/tournaments/${data.tournament.id}/registrations`);
			registrations = Array.isArray(res) ? res : [];
			regLoaded = true;
		} catch { /* ignore */ }
	}

	$effect(() => {
		if (data.tournament?.status === 'draft' && !regLoaded) loadRegistrations();
	});

	const pendingRegs = $derived(registrations.filter((r) => r.status === 'pending'));

	async function approveRegistration(rid: string) {
		reviewing = rid;
		try {
			await api.post(`/tournaments/${data.tournament.id}/registrations/${rid}/approve`);
			success('报名已通过');
			await loadRegistrations();
		} catch (e: any) {
			error(e.message);
		} finally {
			reviewing = null;
		}
	}

	async function rejectRegistration(rid: string) {
		const note = prompt('拒绝原因（可选）：');
		if (note === null) return;
		reviewing = rid;
		try {
			await api.post(`/tournaments/${data.tournament.id}/registrations/${rid}/reject`, { note });
			success('报名已拒绝');
			await loadRegistrations();
		} catch (e: any) {
			error(e.message);
		} finally {
			reviewing = null;
		}
	}


	/** 打开种子排位面板 */
	function openSeedPanel() {
		seedPanelOpen = true;
	}

	async function generateBracket() {
		generating = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/generate`, { seed_by: 'random' });
			success('赛程生成成功');
			setTimeout(() => window.location.reload(), 600);
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}

	async function resetBracket() {
		if (!confirm('确定要重置赛程吗？所有已生成的比赛和比分将被清除，赛事回到草稿状态。')) return;
		generating = true;
		try {
			await api.post(`/tournaments/${data.tournament.id}/reset`);
			success('赛程已重置');
			setTimeout(() => window.location.reload(), 600);
		} catch (e: any) {
			error(e.message);
		} finally {
			generating = false;
		}
	}

	async function saveBanner() {
		try {
			const payload = { ...data.tournament, cover_image: bannerUrl, coverImage: bannerUrl };
			const updated = await api.put<any>(`/tournaments/${data.tournament.id}`, payload);
			data.tournament = { ...data.tournament, ...updated };
			editingBanner = false;
			success('Banner 已更新');
		} catch (e: any) {
			error(e.message);
		}
	}

	const t = $derived(data.tournament);
	const teams = $derived(data.teams);
</script>

<div>
	<div class="mb-6">
		<BackLink href="/admin/tournaments">← 返回赛事列表</BackLink>
	</div>

	<!-- Banner -->
	{#if t.coverImage ?? t.cover_image}
		<div class="relative border border-black overflow-hidden mb-6 group">
			<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-40 md:h-56 object-cover" />
			{#if t.status === 'draft'}
				<button onclick={() => editingBanner = !editingBanner}
					class="absolute top-2 right-2 bg-white border border-black px-2 py-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150">
					编辑 Banner
				</button>
			{/if}
		</div>
	{:else if t.status === 'draft'}
		<div class="border border-black bg-neutral-50 p-4 mb-6 text-center">
			<button onclick={() => editingBanner = !editingBanner}
				class="text-sm font-bold text-neutral-600 hover:text-black transition-colors duration-150">
				+ 添加赛事 Banner
			</button>
		</div>
	{/if}

	{#if editingBanner && t.status === 'draft'}
		<div class="border border-black bg-white p-4 mb-6">
			<label class="block text-sm font-bold text-black mb-2">Banner 图片 URL</label>
			<div class="flex gap-0">
				<Input type="url" bind:value={bannerUrl} placeholder="https://..." class="flex-1" />
				<Button onclick={saveBanner} en="Save" class="px-4">
					保存
				</Button>
				<button onclick={() => { editingBanner = false; bannerUrl = t.coverImage ?? t.cover_image ?? ''; }}
					class="border border-l-0 border-black bg-white text-black font-bold px-4 py-2 text-sm hover:bg-neutral-100 transition-colors duration-150">
					取消
				</button>
			</div>
			{#if bannerUrl}
				<div class="mt-2 border border-black overflow-hidden">
					<img src={bannerUrl} alt="preview" class="w-full h-32 object-cover" />
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex items-start justify-between mb-6">
		<div>
			<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
			<p class="text-sm text-neutral-600 mt-1">{t.game} · {FORMAT_MAP[t.format] ?? t.format} · {TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status}</p>
		</div>
		<div class="flex gap-2">
			{#if t.status === 'draft'}
				{#if teams.length >= 2}
					<button
						onclick={openSeedPanel}
						class="border border-black bg-white text-black font-bold px-4 py-2 text-sm transition-colors duration-150 active:opacity-70 press"
					>
						种子排位
					</button>
				{/if}
				<Button onclick={generateBracket} disabled={generating} en="Generate Bracket">
					<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
					{generating ? '生成中...' : '生成赛程'}
				</Button>
			{:else}
				<button onclick={resetBracket} disabled={generating}
					class="border border-black bg-white text-black font-bold px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 disabled:opacity-50">
					{generating ? '重置中...' : '重置赛程'}
				</button>
			{/if}
		</div>
	</div>

	{#if seedPanelOpen}
		<SeedRankingPanel teams={teams} tournamentId={data.tournament.id} onclose={() => (seedPanelOpen = false)} />
	{/if}

	<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-6">
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">赛制</div>
			<div class="font-black text-lg mt-1">{FORMAT_MAP[t.format] ?? t.format}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">队伍</div>
			<div class="font-black text-lg mt-1">{teams.length}/{t.maxTeams}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">局数</div>
			<div class="font-black text-lg mt-1">BO{t.boCount}</div>
		</div>
		<div class="border-r border-b border-black bg-white p-4">
			<div class="text-xs text-neutral-500 font-bold">状态</div>
			<div class="font-black text-lg mt-1">{TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status}</div>
		</div>
	</div>

	{#if t.status === 'draft'}
		<div class="border border-black bg-white mb-6">
			<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
				<div class="flex items-center gap-2 relative z-10">
					<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
					<span class="font-black text-base tracking-tight">报名审核</span>
					{#if pendingRegs.length > 0}
						<span class="text-xs font-black bg-accent text-white px-1.5 py-0.5 shrink-0">{pendingRegs.length}</span>
					{/if}
				</div>
				<span
					class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
					style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
				>Review</span>
			</div>
			<div class="p-4">
				{#if registrations.length === 0}
					<p class="text-sm text-neutral-500 font-bold text-center py-2">暂无报名</p>
				{:else}
					<div class="space-y-2">
						{#each registrations as reg (reg.id)}
							<div class="border border-black bg-white">
								<div class="flex items-center justify-between gap-3 px-3 py-2 flex-wrap">
									<div class="flex items-center gap-3 min-w-0 flex-wrap">
										<StatusBadge status={reg.status} map={REGISTRATION_STATUS_MAP} />
										<span class="text-sm font-black truncate">{reg.teamName}</span>
										<span class="text-xs text-neutral-500 font-bold shrink-0">报名人：{reg.applicant?.username ?? '—'}</span>
										<span class="text-xs text-neutral-400 font-bold shrink-0">{reg.players?.length ?? 0} 名选手</span>
										{#if reg.status === 'rejected' && reg.note}
											<span class="text-xs text-neutral-500 font-bold">原因：{reg.note}</span>
										{/if}
									</div>
									<div class="flex gap-1 shrink-0">
										{#if reg.status === 'pending'}
											<button onclick={() => approveRegistration(reg.id)} disabled={reviewing === reg.id}
												class="rounded-none font-sans font-bold border border-black bg-black text-white px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70 disabled:opacity-50">通过</button>
											<button onclick={() => rejectRegistration(reg.id)} disabled={reviewing === reg.id}
												class="rounded-none font-sans font-bold border border-black bg-white text-accent px-3 py-1 text-xs transition-opacity duration-150 active:opacity-70 disabled:opacity-50">拒绝</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="border border-black bg-white mb-6">
		<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white">
			<div class="flex items-center gap-2 relative z-10">
				<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
				<span class="font-black text-base tracking-tight">签到管理</span>
				<span class="text-xs font-black text-white/70">{checkins.stats.checked}/{checkins.stats.total}</span>
			</div>
			<button
				onclick={showQr}
				class="text-xs font-bold text-white/80 border-b border-white/50 hover:text-white hover:border-white transition-colors duration-150 relative z-10 inline-flex items-center gap-1"
				title="展示赛事签到二维码"
			>
				<QrCode size={13} class="shrink-0" aria-hidden="true" />
				签到二维码
			</button>
			<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
				style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Check-in</span>
		</div>
		<div class="p-4">
			{#if checkins.teams.length === 0}
				<p class="text-sm text-neutral-500 font-bold text-center py-2">暂无队伍</p>
			{:else}
				<div class="flex items-center gap-3 mb-3 text-xs font-bold text-neutral-500">
					<span class="inline-block w-2 h-2 bg-accent" aria-hidden="true"></span> 已到 {checkins.stats.checked}
					<span class="inline-block w-2 h-2 bg-neutral-300" aria-hidden="true"></span> 未到 {checkins.stats.total - checkins.stats.checked}
				</div>
				<div class="space-y-1">
					{#each checkins.teams as t (t.teamId)}
						<div class="flex items-center justify-between gap-3 border border-black bg-white px-3 py-2 flex-wrap">
							<div class="flex items-center gap-3 min-w-0 flex-wrap">
								<span class="text-xs font-black tabular-nums text-neutral-500 shrink-0">{String(t.seed ?? '').padStart(2, '0')}</span>
								<span class="text-sm shrink-0 {t.checkedIn ? 'text-accent' : 'text-neutral-300'}" aria-hidden="true">
					{#if t.checkedIn}<Check size={14} class="shrink-0" />{:else}<Circle size={14} class="shrink-0" />{/if}
				</span>
								<span class="text-sm font-black truncate">{t.name}</span>
								{#if t.checkedInAt}
									<span class="text-xs text-neutral-400 font-bold shrink-0">{new Date(t.checkedInAt).toLocaleTimeString()}</span>
								{/if}
							</div>
							<button
								onclick={() => toggleCheckin(t.teamId)}
								disabled={checkinToggling === t.teamId}
								class="rounded-none font-sans font-bold border border-black px-3 py-1 text-xs transition-colors duration-150 active:opacity-70 disabled:opacity-50 {t.checkedIn
									? 'bg-white text-accent hover:bg-neutral-100'
									: 'bg-black text-white hover:bg-neutral-800'}"
							>
								{t.checkedIn ? '取消签到' : '标记到场'}
							</button>
						</div>
					{/each}
				</div>
				{#if qrOpen}
					<div class="border border-black bg-white p-4 text-center mt-2">
						{#if qrUrl}
							<img src={qrUrl} alt="签到二维码" class="w-44 h-44 mx-auto border border-black" />
							<p class="text-sm font-bold text-black mt-3">赛事签到二维码</p>
							<p class="text-xs text-neutral-400 font-bold mt-1">所有队伍扫码后登录，按身份匹配队伍签到</p>
							<button
								onclick={() => { qrOpen = false; qrUrl = ''; }}
								class="mt-3 rounded-none font-sans font-bold border border-black px-4 py-1.5 text-xs bg-black text-white hover:bg-neutral-800 transition-colors duration-150"
							>关闭</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-3 gap-0 border-l border-t border-black">
		<a href="/admin/tournaments/{t.id}/teams"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">队伍管理</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">{teams.length} 支队伍</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
		<a href="/admin/tournaments/{t.id}/matches"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">比赛管理</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">录入比分</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
		<a href="/tournaments/{t.id}/bracket"
			class="border-r border-b border-black bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-150 text-center">
			<div class="font-black text-sm md:text-base">赛程图</div>
			<div class="text-xs text-neutral-500 mt-1 font-bold">全屏查看</div>
			<div class="text-xs font-bold text-black mt-2">→</div>
		</a>
	</div>
</div>
