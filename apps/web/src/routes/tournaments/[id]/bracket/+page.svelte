<script lang="ts">
	import { GitFork } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data } = $props();
	let bracketEl: HTMLElement;
	let exporting = $state(false);
	const stages: any[] = $derived(data.bracket?.stages ?? []);

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
		const rows = teams.map((t) => ({ team: t, w: 0, d: 0, l: 0, pts: 0 }));
		const byId = new Map(rows.map((r) => [r.team.id, r]));
		for (const r of stage.rounds ?? []) {
			for (const m of r.matches ?? []) {
				if (m.status !== 'completed') continue;
				if (!m.team1 || !m.team2) continue;
				const s1 = m.team1_score ?? 0;
				const s2 = m.team2_score ?? 0;
				const a = byId.get(m.team1.id);
				const b = byId.get(m.team2.id);
				if (!a || !b) continue;
				if (s1 === s2) {
					a.d++;
					b.d++;
					a.pts++;
					b.pts++;
				} else if (s1 > s2) {
					a.w++;
					b.l++;
					a.pts += 3;
				} else {
					b.w++;
					a.l++;
					b.pts += 3;
				}
			}
		}
		rows.sort(
			(x, y) =>
				y.pts - x.pts ||
				y.w - x.w ||
				String(x.team.name).localeCompare(String(y.team.name))
		);
		return rows;
	}

	async function exportImage() {
		exporting = true;
		try {
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

	{#snippet matchCard(m: any, isFinal: boolean)}
		{@const winner = getWinner(m)}
		{@const summary = gamesSummary(m)}
		{@const ongoing = m.status === 'in_progress'}
		{@const isWaiting = m.status === 'pending' && m.team1 && m.team2}
		{@const walk = m.status === 'walkthrough'}
		{@const t1Win = !!(winner && m.team1 && winner.id === m.team1.id)}
		{@const t2Win = !!(winner && m.team2 && winner.id === m.team2.id)}
		{@const decided = t1Win || t2Win}
		<div
			class="relative bg-white border border-black rounded-none font-sans {isFinal
				? 'border-2 min-w-[240px]'
				: 'min-w-[200px]'} {decided ? 'border-l-2 border-l-black' : ''} {ongoing ? 'border-l-2 border-l-accent' : ''}"
			style="height:{CARD_H}px;"
		>
			<div class="h-full flex flex-col">
				<div class="flex-1 flex flex-col justify-center text-xs">
					<div
						class="flex items-center gap-2 px-2 py-0.5 {t1Win
							? 'font-black'
							: t2Win ? 'opacity-40 font-medium' : 'font-bold'}"
					>
						<span class="w-4 shrink-0 text-[10px] text-neutral-400 tabular-nums">
							{m.team1?.seed ?? ''}
						</span>
						<span class="flex-1 min-w-0 truncate">
							{m.team1 ? m.team1.name : 'TBD'}
						</span>
						<span class="shrink-0 font-black text-sm tabular-nums">
							{m.team1_score ?? 0}
						</span>
					</div>
					<div
						class="flex items-center gap-2 px-2 py-0.5 {t2Win
							? 'font-black'
							: t1Win ? 'opacity-40 font-medium' : 'font-bold'}"
					>
						<span class="w-4 shrink-0 text-[10px] text-neutral-400 tabular-nums">
							{m.team2?.seed ?? ''}
						</span>
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
				<div class="absolute top-1.5 right-1.5 flex items-center gap-1" aria-label="进行中">
					<span class="w-1.5 h-1.5 bg-accent status-dot"></span>
				</div>
			{:else if isWaiting}
				<div class="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-neutral-400 status-dot" aria-label="待赛"></div>
			{:else if walk}
				<div class="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">轮空</div>
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
						第 {round.round} 轮{isLast && n === 1 ? ' · 决赛' : ''}
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
	{/snippet}

	{#snippet rrStage(stage: any)}
		{@const teams = getRoundRobinTeams(stage)}
		{@const standings = buildStandings(stage, teams)}
		<div class="flex flex-col gap-6">
			<div class="border border-black bg-white">
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
				<div class="border border-black bg-white">
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
			<div class="flex gap-10 flex-nowrap">
				{#each stages as stage}
					<div class="flex flex-col shrink-0">
						<div class="mb-4 border-b border-black pb-1">
							<h3 class="font-black text-base md:text-lg tracking-tight">{stage.name}</h3>
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
</div>
