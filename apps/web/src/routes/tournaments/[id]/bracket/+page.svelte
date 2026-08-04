<script lang="ts">
	import { GitFork, Star, ArrowRight } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { api } from '$lib/api/client';

	let { data } = $props();
	let bracketEl: HTMLElement;
	let exporting = $state(false);
	const stages: any[] = $derived(data.bracket?.stages ?? []);

	// hover 队伍详情（懒加载 + 缓存）
	const teamCache = new Map<string, any>();
	let hoveredTeam = $state<{ id: string; name: string; logoEmoji?: string | null; logoUrl?: string | null; players?: any[]; dir: 'up' | 'down' } | null>(null);
	let hoverLoadingId = $state<string | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	// 计算浮层方向：行靠近卡片顶部时朝下展开（避免被容器裁剪）
	function computeDir(el?: HTMLElement | null): 'up' | 'down' {
		const card = el?.closest('.match-card');
		if (!card) return 'up';
		const cardRect = card.getBoundingClientRect();
		const rowRect = el!.getBoundingClientRect();
		return rowRect.top - cardRect.top < 120 ? 'down' : 'up';
	}

	async function showTeam(teamId: string | null | undefined, el?: HTMLElement | null) {
		if (!teamId) return;
		clearTimeout(hideTimer);
		const dir = computeDir(el);
		if (teamCache.has(teamId)) {
			hoveredTeam = { ...teamCache.get(teamId)!, dir };
			return;
		}
		hoverLoadingId = teamId;
		try {
			const t = await api.get<any>(`/public/teams/${teamId}`);
			teamCache.set(teamId, t);
			hoveredTeam = { ...t, dir };
		} catch {
			// 队伍可能已删除，忽略
		} finally {
			hoverLoadingId = null;
		}
	}

	// 触屏/点击支持：再次点击同一队伍则收起
	function toggleTeam(teamId: string | null | undefined, el: HTMLElement) {
		if (!teamId) return;
		if (hoveredTeam?.id === teamId) {
			hoveredTeam = null;
			return;
		}
		showTeam(teamId, el);
	}

	function scheduleHide() {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (hoveredTeam = null), 150);
	}

	function cancelHide() {
		clearTimeout(hideTimer);
	}

	// 兼容 API 的 camelCase / snake_case 队标字段
	function logoUrlOf(t: any) {
		return t?.logoUrl ?? t?.logo_url ?? null;
	}
	function logoEmojiOf(t: any) {
		return t?.logoEmoji ?? t?.logo_emoji ?? null;
	}

	// Geometry constants for elimination brackets.
	const CARD_H = 80;
	const GAP = 32;
	const COL_GAP = 56;

	function sortRound(matches: any[]): any[] {
		return [...matches].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
	}

	// Winner is derived from scores (API does not return winner_id on the match).
	function getWinner(m: any): any | null {
		if (!m) return null;
		if (m.status === 'completed') {
			if ((m.team1_score ?? 0) > (m.team2_score ?? 0)) return m.team1;
			if ((m.team2_score ?? 0) > (m.team1_score ?? 0)) return m.team2;
		}
		return null;
	}

	function gamesSummary(m: any): string {
		const games = m?.games;
		if (!games || games.length === 0) return '';
		let t1 = 0;
		let t2 = 0;
		for (const g of games) {
			if (g.winner_id == null) continue;
			if (m.team1 && g.winner_id === m.team1.id) t1++;
			else if (m.team2 && g.winner_id === m.team2.id) t2++;
		}
		return `BO${games.length}: ${t1}-${t2}`;
	}

	function getRoundRobinTeams(stage: any): any[] {
		const map = new Map<string, any>();
		for (const r of stage.rounds ?? []) {
			for (const m of r.matches ?? []) {
				if (m.team1 && !map.has(m.team1.id)) map.set(m.team1.id, m.team1);
				if (m.team2 && !map.has(m.team2.id)) map.set(m.team2.id, m.team2);
			}
		}
		const arr = [...map.values()];
		arr.sort(
			(a, b) => (a.seed ?? 9999) - (b.seed ?? 9999) || String(a.name).localeCompare(String(b.name))
		);
		return arr;
	}

	function findMatchBetween(stage: any, aId: string, bId: string): any | null {
		for (const r of stage.rounds ?? []) {
			for (const m of r.matches ?? []) {
				const t1 = m.team1?.id;
				const t2 = m.team2?.id;
				if ((t1 === aId && t2 === bId) || (t1 === bId && t2 === aId)) return m;
			}
		}
		return null;
	}

	function cellScore(m: any, rowTeamId: string): string {
		if (!m) return '';
		if (m.team1 && m.team1.id === rowTeamId)
			return `${m.team1_score ?? 0}:${m.team2_score ?? 0}`;
		if (m.team2 && m.team2.id === rowTeamId)
			return `${m.team2_score ?? 0}:${m.team1_score ?? 0}`;
		return '';
	}

	function buildStandings(stage: any, teams: any[]): any[] {
		const rows = teams.map((t) => ({ team: t, w: 0, d: 0, l: 0, pts: 0, gd: 0, played: 0 }));
		const byId = new Map(rows.map((r) => [r.team.id, r]));
		// 对战矩阵：h2h[a][b] > 0 表示 a 在对阵 b 中净胜场次占优（与后端 T.Lets 规则一致）
		const h2h = new Map<string, Map<string, number>>();
		for (const r of stage.rounds ?? []) {
			for (const m of r.matches ?? []) {
				if (m.status !== 'completed' && m.status !== 'walkthrough') continue;
				if (!m.team1 || !m.team2) continue;
				const s1 = m.team1_score ?? 0;
				const s2 = m.team2_score ?? 0;
				const a = byId.get(m.team1.id);
				const b = byId.get(m.team2.id);
				if (!a || !b) continue;
				a.played++;
				b.played++;
				const winnerId = m.winner_id ?? m.winnerId ?? (s1 > s2 ? m.team1.id : s1 < s2 ? m.team2.id : null);
				if (!winnerId) {
					a.d++;
					b.d++;
					a.pts++;
					b.pts++;
				} else {
					const win = winnerId === m.team1.id ? a : b;
					const lose = winnerId === m.team1.id ? b : a;
					win.w++;
					lose.l++;
					win.pts += 3;
					if (!h2h.has(win.team.id)) h2h.set(win.team.id, new Map());
					if (!h2h.has(lose.team.id)) h2h.set(lose.team.id, new Map());
					h2h.get(win.team.id)!.set(lose.team.id, (h2h.get(win.team.id)!.get(lose.team.id) ?? 0) + 1);
					h2h.get(lose.team.id)!.set(win.team.id, (h2h.get(lose.team.id)!.get(win.team.id) ?? 0) - 1);
				}
				a.gd += s1 - s2;
				b.gd += s2 - s1;
			}
		}
		// T.Lets：积分 → 胜负场次差 → 净胜分 → 对战胜负
		rows.sort((x, y) => {
			if (y.pts !== x.pts) return y.pts - x.pts;
			const wd = (y.w - y.l) - (x.w - x.l);
			if (wd !== 0) return wd;
			if (y.gd !== x.gd) return y.gd - x.gd;
			return -((h2h.get(x.team.id)?.get(y.team.id) ?? 0) || 0);
		});
		return rows;
	}

	// 淘汰赛轮次命名：决赛 / 半决赛 / 1/4 决赛 …
	function roundLabel(r: number, total: number): string {
		if (r >= total) return '决赛';
		if (total - r === 1) return '半决赛';
		if (total - r === 2) return '1/4 决赛';
		if (total - r === 3) return '1/8 决赛';
		if (total - r === 4) return '1/16 决赛';
		return `第 ${r} 轮`;
	}

	// 缩放控制
	let zoom = $state(1);
	const ZOOM_MIN = 0.5;
	const ZOOM_MAX = 2;
	function zoomBy(d: number) {
		zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + d) * 10) / 10));
	}

	async function exportImage() {
		exporting = true;
		try {
			// 导出前临时恢复 100% 缩放，避免图片被缩放影响
			const prevZoom = zoom;
			if (prevZoom !== 1) {
				zoom = 1;
				await new Promise((r) => requestAnimationFrame(() => r(null)));
			}
			const { toPng } = await import('html-to-image');
			const dataUrl = await toPng(bracketEl, { backgroundColor: '#ffffff', pixelRatio: 2 });
			const link = document.createElement('a');
			link.download = `${data.tournament.name}-bracket.png`;
			link.href = dataUrl;
			link.click();
		} catch (e: any) {
			alert('导出失败: ' + e.message);
		} finally {
			exporting = false;
		}
	}
</script>

<div class="min-h-screen bg-neutral-100 font-sans">
	<div
		class="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b-2 border-black px-4 md:px-6 py-3 flex items-center justify-between"
	>
		<div class="flex items-center gap-4 min-w-0">
			<a
				href="/tournaments/{data.tournament.id}"
				onclick={(e) => {
					// 优先返回来源页面（如管理后台）；新标签页直达时才回退到详情页
					if (window.history.length > 1) {
						e.preventDefault();
						window.history.back();
					}
				}}
				class="shrink-0 text-sm font-bold text-black border-b border-black hover:text-neutral-500 hover:border-neutral-500 transition-colors duration-150"
			>
				← 返回详情
			</a>
			<h1 class="font-black text-lg md:text-xl tracking-tight truncate">
				{data.tournament.name} — 赛程图
			</h1>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			<div class="flex items-center border border-black bg-white">
				<button
					onclick={() => zoomBy(-0.1)}
					class="px-2.5 py-1.5 text-sm font-black hover:bg-neutral-100 transition-colors duration-150"
					aria-label="缩小"
				>−</button>
				<button
					onclick={() => (zoom = 1)}
					class="px-2.5 py-1.5 text-xs font-bold border-x border-black tabular-nums hover:bg-neutral-100 transition-colors duration-150"
					aria-label="重置缩放"
				>{Math.round(zoom * 100)}%</button>
				<button
					onclick={() => zoomBy(0.1)}
					class="px-2.5 py-1.5 text-sm font-black hover:bg-neutral-100 transition-colors duration-150"
					aria-label="放大"
				>+</button>
			</div>
			<Button
				onclick={exportImage}
				disabled={exporting}
				en="Export"
				class="rounded-none shrink-0"
				aria-label="导出赛程图为图片"
			>
			{exporting ? '导出中...' : '导出为图片 →'}
		</Button>
		</div>
	</div>

	{#snippet matchCard(m: any, isFinal: boolean)}
		{@const winner = getWinner(m)}
		{@const summary = gamesSummary(m)}
		{@const ongoing = m.status === 'in_progress'}
		{@const isWaiting = m.status === 'pending' && m.team1 && m.team2}
		{@const walk = m.status === 'walkthrough'}
		{@const t1Win = !!(winner && m.team1 && winner.id === m.team1.id)}
		{@const t2Win = !!(winner && m.team2 && winner.id === m.team2.id)}
		{@const decided = t1Win || t2Win}
		{@const isHoverTarget =
			hoveredTeam?.id === m.team1?.id ||
			hoveredTeam?.id === m.team2?.id ||
			hoverLoadingId === m.team1?.id ||
			hoverLoadingId === m.team2?.id}
		{@const hoverSeed =
			hoveredTeam?.id === m.team1?.id ? m.team1?.seed : hoveredTeam?.id === m.team2?.id ? m.team2?.seed : null}
		<div
			class="match-card relative bg-white border border-black rounded-none font-sans {isFinal
				? 'border-2 min-w-[240px]'
				: 'min-w-[200px]'} {decided ? 'border-l-2 border-l-black' : ''} {ongoing ? 'border-l-2 border-l-accent' : ''}"
			style="height:{CARD_H}px;"
		>
			<div class="h-full flex flex-col">
				<div class="flex-1 flex flex-col justify-center text-xs">
					<div
						class="flex items-center gap-2 px-2 py-0.5 cursor-pointer transition-colors duration-150 hover:bg-neutral-100 {t1Win
							? 'font-black'
							: t2Win ? 'opacity-40 font-medium' : 'font-bold'}"
						onmouseenter={(e) => showTeam(m.team1?.id, e.currentTarget as HTMLElement)}
						onmouseleave={scheduleHide}
						onclick={(e) => toggleTeam(m.team1?.id, e.currentTarget as HTMLElement)}
						onfocus={(e) => showTeam(m.team1?.id, e.currentTarget as HTMLElement)}
						onblur={scheduleHide}
						role="button"
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') toggleTeam(m.team1?.id, e.currentTarget as HTMLElement);
						}}
						tabindex="0"
					>
						<span class="w-5 shrink-0 text-[10px] text-neutral-400 tabular-nums">
							{m.team1?.seed != null ? '#' + m.team1.seed : ''}
						</span>
						{#if logoUrlOf(m.team1)}
							<img src={logoUrlOf(m.team1)} alt="" class="w-4 h-4 object-contain shrink-0" loading="lazy" />
						{:else if logoEmojiOf(m.team1)}
							<span class="w-4 h-4 shrink-0 flex items-center justify-center text-xs leading-none" aria-hidden="true">{logoEmojiOf(m.team1)}</span>
						{/if}
						<span class="flex-1 min-w-0 truncate">
							{m.team1 ? m.team1.name : 'TBD'}
						</span>
						<span class="shrink-0 font-black text-sm tabular-nums">
							{m.team1_score ?? 0}
						</span>
					</div>
					<div
						class="flex items-center gap-2 px-2 py-0.5 cursor-pointer transition-colors duration-150 hover:bg-neutral-100 {t2Win
							? 'font-black'
							: t1Win ? 'opacity-40 font-medium' : 'font-bold'}"
						onmouseenter={(e) => showTeam(m.team2?.id, e.currentTarget as HTMLElement)}
						onmouseleave={scheduleHide}
						onclick={(e) => toggleTeam(m.team2?.id, e.currentTarget as HTMLElement)}
						onfocus={(e) => showTeam(m.team2?.id, e.currentTarget as HTMLElement)}
						onblur={scheduleHide}
						role="button"
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') toggleTeam(m.team2?.id, e.currentTarget as HTMLElement);
						}}
						tabindex="0"
					>
						<span class="w-5 shrink-0 text-[10px] text-neutral-400 tabular-nums">
							{m.team2?.seed != null ? '#' + m.team2.seed : ''}
						</span>
						{#if logoUrlOf(m.team2)}
							<img src={logoUrlOf(m.team2)} alt="" class="w-4 h-4 object-contain shrink-0" loading="lazy" />
						{:else if logoEmojiOf(m.team2)}
							<span class="w-4 h-4 shrink-0 flex items-center justify-center text-xs leading-none" aria-hidden="true">{logoEmojiOf(m.team2)}</span>
						{/if}
						<span class="flex-1 min-w-0 truncate">
							{m.team2 ? m.team2.name : 'TBD'}
						</span>
						<span class="shrink-0 font-black text-sm tabular-nums">
							{m.team2_score ?? 0}
						</span>
					</div>
				</div>
				{#if summary}
					<div class="px-2 py-0.5 text-[10px] text-neutral-500 border-t border-neutral-200 tabular-nums">
						{summary}
					</div>
				{/if}
			</div>
			{#if ongoing}
				<div class="absolute -top-2.5 right-1.5 z-10 flex items-center gap-1 bg-accent text-white px-1.5 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.15)]" aria-label="进行中">
					<span class="w-1 h-1 bg-white rounded-full status-dot"></span>
					<span class="text-[9px] font-black uppercase tracking-wider leading-none">进行中</span>
				</div>
			{:else if isWaiting}
				<div class="absolute -top-2.5 right-1.5 z-10 flex items-center gap-1 bg-neutral-200 text-black px-1.5 py-0.5 border border-black shadow-[2px_2px_0_rgba(0,0,0,0.15)]" aria-label="待赛">
					<span class="w-1 h-1 bg-neutral-500 rounded-full"></span>
					<span class="text-[9px] font-black uppercase tracking-wider leading-none">待赛</span>
				</div>
			{:else if walk}
				<div class="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">轮空</div>
			{/if}
			{#if isHoverTarget}
				<div
					role="tooltip"
					class="absolute z-30 left-1/2 -translate-x-1/2 w-52 bg-black text-white border border-black shadow-[4px_4px_0_rgba(0,0,0,0.18)] p-3 tooltip-enter {hoveredTeam?.dir === 'down' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}"
					onmouseenter={cancelHide}
					onmouseleave={scheduleHide}
				>
					{#if hoveredTeam}
						<div class="flex items-center gap-2.5 mb-2 min-w-0">
							{#if hoveredTeam.logoUrl}
								<img src={hoveredTeam.logoUrl} alt={hoveredTeam.name} class="w-7 h-7 object-contain bg-white border border-white/30 shrink-0" />
							{:else if hoveredTeam.logoEmoji}
								<span class="w-7 h-7 flex items-center justify-center border border-white/30 shrink-0 text-base leading-none">{hoveredTeam.logoEmoji}</span>
							{:else}
								<span class="w-7 h-7 shrink-0 flex items-center justify-center border border-white/40 text-[11px] font-black">{hoveredTeam.name.slice(0, 1)}</span>
							{/if}
							<div class="min-w-0 flex-1">
								<div class="font-black text-sm truncate">{hoveredTeam.name}</div>
								{#if hoverSeed != null}
									<div class="text-[10px] font-bold text-white/50 uppercase tracking-wider">种子 #{hoverSeed}</div>
								{/if}
							</div>
						</div>
						{#if hoveredTeam.players?.length}
							<div class="border-t border-white/20 pt-1.5 space-y-1 max-h-32 overflow-hidden">
								{#each hoveredTeam.players as p}
									<div class="flex items-center gap-1.5 text-[11px] font-bold text-white/90 min-w-0">
										{#if p.isCaptain}
											<Star size={9} fill="currentColor" class="shrink-0 text-accent" aria-label="队长" />
										{:else}
											<span class="w-[9px] shrink-0" aria-hidden="true"></span>
										{/if}
										<span class="truncate">{p.name || '未命名选手'}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="border-t border-white/20 pt-1.5 text-[11px] text-white/60 font-bold">暂无成员信息</p>
						{/if}
						<a
							href="/teams/{hoveredTeam.id}"
							onclick={(e) => e.stopPropagation()}
							onmouseenter={cancelHide}
							onmouseleave={scheduleHide}
							class="mt-2 flex items-center justify-between border-t border-white/20 pt-1.5 text-[11px] font-black text-white hover:text-accent transition-colors duration-150"
						>
							查看战队主页
							<ArrowRight size={11} class="shrink-0" aria-hidden="true" />
						</a>
					{:else}
						<div class="space-y-1.5 animate-pulse" aria-label="加载中">
							<div class="flex items-center gap-2.5">
								<div class="w-7 h-7 bg-white/20 shrink-0"></div>
								<div class="h-3.5 flex-1 bg-white/20"></div>
							</div>
							<div class="h-2.5 bg-white/10"></div>
							<div class="h-2.5 bg-white/10 w-2/3"></div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet connector(pitch: number)}
		{@const half = COL_GAP / 2}
		<div
			class="absolute pointer-events-none"
			style="top:50%; left:100%; width:{COL_GAP}px; height:{pitch}px;"
		>
			<div class="absolute bg-black" style="top:0; left:0; width:{half}px; height:1px;"></div>
			<div
				class="absolute bg-black"
				style="bottom:0; left:0; width:{half}px; height:1px;"
			></div>
			<div
				class="absolute bg-black"
				style="top:0; left:{half}px; width:1px; height:100%;"
			></div>
			<div
				class="absolute bg-black"
				style="top:50%; left:{half}px; width:{half}px; height:1px;"
			></div>
		</div>
	{/snippet}

	{#snippet elimStage(stage: any)}
		{@const rounds = (stage.rounds ?? []).filter((r: any) => r.matches.length > 0)}
		{@const n1 = rounds[0]?.matches.length ?? 1}
		{@const H = Math.max(n1, 1) * (CARD_H + GAP)}
		{@const isChampionship =
			stage.type === 'grand_final' ||
			(data.tournament.format === 'single_elim' && stage.type === 'winners_bracket')}
		{@const finalMatch = rounds.length
			? sortRound(rounds[rounds.length - 1].matches)[0] ?? null
			: null}
		{@const champion = finalMatch ? getWinner(finalMatch) : null}
		{#if isChampionship && champion}
		<div class="mb-4 self-start animate-enter">
			<div class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-1"> Champion</div>
			<div class="font-black text-xl md:text-2xl tracking-tight text-black">{champion.name}</div>
		</div>
	{/if}
		<div class="flex" style="gap:{COL_GAP}px;">
			{#each rounds as round, ri}
				{@const n = round.matches.length}
				{@const pitch = H / Math.max(n, 1)}
				{@const isLast = ri === rounds.length - 1}
				{@const halvesNext = !isLast && rounds[ri + 1].matches.length * 2 === n}
				<div class="shrink-0">
					<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2 h-4">
						{roundLabel(round.round, rounds.length)}
					</div>
					<div class="flex flex-col justify-around" style="height:{H}px;">
						{#each sortRound(round.matches) as m, mi}
							{@const finalThis =
								isLast && (n === 1 ? true : (m.position ?? mi) === 0)}
							{@const thirdThis = isLast && n === 2 && (m.position ?? mi) === 1}
							<div class="relative">
								{#if finalThis && n === 2}
									<div
										class="absolute -top-4 left-0 text-[10px] text-black font-bold uppercase tracking-wider"
									>
										决赛
									</div>
								{/if}
								{#if thirdThis}
									<div
										class="absolute -top-4 left-0 text-[10px] text-neutral-500 font-bold uppercase tracking-wider"
									>
										季军赛
									</div>
								{/if}
								{@render matchCard(m, finalThis)}
								{#if halvesNext && mi % 2 === 0 && mi + 1 < n}
									{@render connector(pitch)}
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}

	{#snippet swissStage(stage: any)}
		{@const rounds = (stage.rounds ?? []).filter((r: any) => r.matches.length > 0)}
		{@const teams = getRoundRobinTeams(stage)}
		{@const standings = buildStandings(stage, teams)}
		<div class="flex gap-8 items-start">
			<div class="flex gap-6">
				{#each rounds as round}
					<div class="flex flex-col gap-3 shrink-0">
						<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">
							第 {round.round} 轮
						</div>
						{#each sortRound(round.matches) as m}
							{@render matchCard(m, false)}
						{/each}
					</div>
				{/each}
			</div>
			{#if standings.length > 0}
				<div class="shrink-0">
					<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">积分榜</div>
					<div class="border border-black bg-white overflow-x-auto">
						<table class="border-collapse text-sm">
							<thead>
								<tr class="bg-black text-white">
									<th class="px-3 py-2 text-left font-bold">排名</th>
									<th class="px-3 py-2 text-left font-bold">队伍</th>
									<th class="px-3 py-2 text-center font-bold">胜</th>
									<th class="px-3 py-2 text-center font-bold">负</th>
									<th class="px-3 py-2 text-center font-bold">净胜</th>
									<th class="px-3 py-2 text-center font-bold">积分</th>
								</tr>
							</thead>
							<tbody>
								{#each standings as s, i}
									<tr class="border-t border-black">
										<td class="px-3 py-2 font-bold">{i + 1}</td>
										<td class="px-3 py-2 font-bold whitespace-nowrap">{s.team.name}</td>
										<td class="px-3 py-2 text-center tabular-nums">{s.w}</td>
										<td class="px-3 py-2 text-center tabular-nums">{s.l}</td>
										<td class="px-3 py-2 text-center tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
										<td class="px-3 py-2 text-center font-black tabular-nums">{s.pts}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet rrStage(stage: any)}
		{@const teams = getRoundRobinTeams(stage)}
		{@const standings = buildStandings(stage, teams)}
		<div class="flex flex-col gap-6">
			<div class="border border-black bg-white overflow-x-auto">
				<table class="border-collapse text-sm">
					<thead>
						<tr class="bg-black text-white">
							<th class="px-3 py-2 text-left font-bold sticky left-0 bg-black z-10">队伍</th>
							{#each teams as t}
								<th class="px-3 py-2 text-center font-bold min-w-[64px]">
									<div class="max-w-[80px] truncate mx-auto" title={t.name}>{t.name}</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each teams as rowTeam, i}
							<tr class="border-t border-black">
								<td class="px-3 py-2 font-bold bg-neutral-100 whitespace-nowrap sticky left-0 z-10">
									{rowTeam.name}
								</td>
								{#each teams as colTeam, j}
								{@const m =
									i === j ? null : findMatchBetween(stage, rowTeam.id, colTeam.id)}
								<td class="px-3 py-2 text-center border-l border-neutral-300">
									{#if i === j}
										<span class="text-neutral-400">—</span>
									{:else if i < j && m && m.status === 'completed'}
										<span class="font-bold tabular-nums">{cellScore(m, rowTeam.id)}</span>
									{:else if i < j && m}
										<span class="text-neutral-400 text-xs">待赛</span>
									{:else if i < j}
										<span class="text-neutral-300">·</span>
									{:else}
										<span class="text-neutral-200">·</span>
									{/if}
								</td>
							{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div>
				<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-2">积分榜</div>
				<div class="border border-black bg-white overflow-x-auto">
					<table class="border-collapse text-sm w-full">
						<thead>
							<tr class="bg-black text-white">
								<th class="px-3 py-2 text-left font-bold">排名</th>
								<th class="px-3 py-2 text-left font-bold">队伍</th>
								<th class="px-3 py-2 text-center font-bold">胜</th>
								<th class="px-3 py-2 text-center font-bold">平</th>
								<th class="px-3 py-2 text-center font-bold">负</th>
								<th class="px-3 py-2 text-center font-bold">积分</th>
							</tr>
						</thead>
						<tbody>
							{#each standings as s, i}
								<tr class="border-t border-black">
									<td class="px-3 py-2 font-bold">{i + 1}</td>
									<td class="px-3 py-2 font-bold">{s.team.name}</td>
									<td class="px-3 py-2 text-center tabular-nums">{s.w}</td>
									<td class="px-3 py-2 text-center tabular-nums">{s.d}</td>
									<td class="px-3 py-2 text-center tabular-nums">{s.l}</td>
									<td class="px-3 py-2 text-center font-black tabular-nums">{s.pts}</td>
								</tr>
							{/each}
							{#if standings.length === 0}
								<tr class="border-t border-black">
									<td colspan="6" class="px-3 py-4 text-center text-neutral-400">暂无已完成比赛</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/snippet}

	<div class="p-4 md:p-6 overflow-auto animate-enter bg-white/70 backdrop-blur-md" bind:this={bracketEl}>
		{#if stages.length > 0}
			<div class="flex gap-10 flex-nowrap" style="zoom: {zoom}">
				{#each stages as stage}
					<div class="flex flex-col shrink-0 {stage.type === 'losers_bracket' ? 'bg-neutral-100/70 p-3' : ''}">
						<div class="mb-4 border-b border-black pb-1 flex items-center gap-2">
							<span class="w-2 h-2 shrink-0 {stage.type === 'losers_bracket' || stage.type === 'grand_final' ? 'bg-accent' : stage.type === 'winners_bracket' && data.tournament.format !== 'single_elim' ? 'bg-black' : 'bg-neutral-400'}" aria-hidden="true"></span>
							<h3 class="font-black text-base md:text-lg tracking-tight">{stage.name}</h3>
							{#if stage.type === 'winners_bracket' && data.tournament.format !== 'single_elim'}
								<span class="ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-black text-white">胜者组</span>
							{:else if stage.type === 'losers_bracket'}
								<span class="ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-accent text-white">败者组</span>
							{/if}
						</div>
						{#if stage.type === 'swiss'}
							{@render swissStage(stage)}
						{:else if stage.type === 'round_robin'}
							{@render rrStage(stage)}
						{:else}
							{@render elimStage(stage)}
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<EmptyState icon={GitFork} title="暂无赛程数据" class="py-20" />
		{/if}
	</div>
	{#if stages.length > 0}
		<div class="mt-4 border border-black bg-white px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-wider text-neutral-600">
			<span class="flex items-center gap-1.5"><span class="w-4 h-[3px] bg-black inline-block"></span>胜者晋级</span>
			<span class="flex items-center gap-1.5"><span class="w-4 h-[3px] bg-black/40 inline-block"></span>败者淘汰</span>
			<span class="flex items-center gap-1.5"><span class="w-2 h-2 bg-accent inline-block rounded-full"></span>进行中</span>
			<span class="flex items-center gap-1.5"><span class="w-2 h-2 bg-neutral-400 inline-block rounded-full"></span>待赛</span>
			<span class="flex items-center gap-1.5"><span class="text-[10px] leading-none font-black">轮空</span>不战而胜</span>
			<span class="flex items-center gap-1.5">#1 <span class="text-neutral-400 font-bold">种子号</span></span>
			<span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 bg-neutral-200 border border-neutral-400 inline-block"></span>队标</span>
		</div>
	{/if}
</div>
