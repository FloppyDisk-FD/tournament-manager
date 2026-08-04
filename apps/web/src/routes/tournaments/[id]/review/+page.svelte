<script lang="ts">
	import { Trophy, Medal, Copy, Check, Users, CalendarDays, Swords, Target, Crown } from 'lucide-svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { FORMAT_MAP } from '$lib/constants/tournament';

	let { data } = $props();
	const review = $derived(data.review);
	const t = $derived(review?.tournament ?? null);
	const champion = $derived(review?.champion ?? null);
	const ranking = $derived(review?.ranking ?? []);
	const stats = $derived(review?.stats ?? { teamCount: 0, matchCount: 0, totalScore: 0, avgScore: '0' });
	const finalMatch = $derived(review?.final ?? null);

	let copied = $state(false);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* ignore */
		}
	}

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '—';
		try {
			return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
		} catch {
			return '—';
		}
	}

	function teamLogo(row: any): string | null {
		return row?.logoUrl ?? row?.logo_url ?? null;
	}
	function teamEmoji(row: any): string | null {
		return row?.logoEmoji ?? row?.logo_emoji ?? null;
	}

	// 并列名次区间解析：'1' → 1，'3-4' → 3
	function rankStart(label: string): number {
		const n = parseInt(label, 10);
		return Number.isNaN(n) ? 999 : n;
	}

	const sortedRanking = $derived([...ranking].sort((a, b) => rankStart(a.label) - rankStart(b.label)));
	const isChampion = $derived((row: any) => row?.teamId === champion?.teamId);

	const statItems = [
		{ icon: Users, label: '参赛队伍', value: () => String(stats.teamCount) },
		{ icon: Swords, label: '总场次', value: () => String(stats.matchCount) },
		{ icon: Target, label: '总比分', value: () => String(stats.totalScore) },
		{ icon: CalendarDays, label: '场均得分', value: () => String(stats.avgScore) },
	];
</script>

<svelte:head>
	<title>{t ? `${t.name} — 赛事回顾` : '赛事回顾'}</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 md:px-8 py-8">
	<div class="mb-6 flex items-center justify-between gap-4">
		<BackLink href="/tournaments/{t?.id ?? ''}">返回赛事详情</BackLink>
		<button
			type="button"
			onclick={copyLink}
			class="inline-flex items-center gap-1.5 text-sm font-black border border-black px-3 py-1.5 bg-white hover:bg-black hover:text-white transition-colors duration-150"
		>
			{#if copied}
				<Check size={14} class="shrink-0" aria-hidden="true" />
				已复制链接
			{:else}
				<Copy size={14} class="shrink-0" aria-hidden="true" />
				分享回顾
			{/if}
		</button>
	</div>

	{#if !review || !t}
		<EmptyState
			title="回顾数据加载失败"
			description="赛事不存在或尚未生成回顾"
			class="border border-black px-8 py-10"
		/>
	{:else}
		<!-- 标题栏：黑底 + 渐变水印 -->
		<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-8">
			<div class="relative z-10">
				<div class="flex items-center gap-2 mb-1">
					<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
					<span class="text-xs font-black uppercase tracking-widest text-white/60">Tournament Review</span>
				</div>
				<h1 class="font-black text-2xl md:text-3xl tracking-tight">{t.name}</h1>
				<p class="text-sm text-white/70 mt-1">
					{FORMAT_MAP[t.format] ?? t.format}
					{#if t.game} · {t.game}{/if}
					· {fmtDate(t.startDate ?? t.createdAt)}
				</p>
			</div>
			<span
				class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
				style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
			>Review</span>
		</div>

		<!-- 冠军卡 -->
		{#if champion}
			<div class="border-2 border-black bg-white mb-8">
				<div class="flex items-center gap-3 px-4 py-2 border-b-2 border-black">
					<Crown size={14} class="shrink-0 text-accent" aria-hidden="true" />
					<span class="text-xs font-black uppercase tracking-widest text-black">Champion</span>
				</div>
				<div class="flex flex-col md:flex-row md:items-center gap-4 px-4 py-6">
					<div class="flex items-center gap-4 flex-1 min-w-0">
						<div class="w-16 h-16 shrink-0 border-2 border-black bg-neutral-50 flex items-center justify-center text-3xl overflow-hidden">
							{#if teamLogo(champion)}
								<img src={teamLogo(champion)} alt={champion.name} class="w-full h-full object-cover" />
							{:else if teamEmoji(champion)}
								<span aria-hidden="true">{teamEmoji(champion)}</span>
							{:else}
								<span class="text-neutral-300 font-black" aria-hidden="true">{champion.name?.slice(0, 1)}</span>
							{/if}
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<Trophy size={16} class="shrink-0 text-accent" aria-hidden="true" />
								<span class="font-black text-xl md:text-2xl tracking-tight text-black truncate">{champion.name}</span>
								{#if champion.seed}
									<span class="text-xs font-black bg-black text-white px-1.5 py-0.5 shrink-0">#{champion.seed}</span>
								{/if}
							</div>
							<div class="text-xs font-bold text-neutral-500">战绩 {champion.wins} 胜 {champion.losses} 负</div>
						</div>
					</div>
					<div class="shrink-0 text-right">
						<div class="flex items-center justify-end">
							<Trophy size={44} stroke-width={2} class="text-accent" aria-hidden="true" />
						</div>
						<div class="text-xs font-black uppercase tracking-widest text-neutral-500 mt-1">冠军</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- 数据亮点 -->
		<div class="grid grid-cols-2 lg:grid-cols-4 border-l border-t border-black mb-8">
			{#each statItems as item}
				<div class="border-r border-b border-black bg-white px-4 py-5">
					<div class="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">
						<item.icon size={14} class="shrink-0" aria-hidden="true" />
						{item.label}
					</div>
					<div class="font-black text-3xl tracking-tight text-black tabular-nums">{item.value()}</div>
				</div>
			{/each}
		</div>

		<!-- 决赛对阵 -->
		{#if finalMatch}
			<div class="border border-black bg-white mb-8">
				<div class="flex items-center justify-between px-4 py-2 border-b-2 border-black">
					<span class="text-xs font-black uppercase tracking-widest text-black">决赛</span>
					<span class="text-xs font-bold text-neutral-500">BO{t.boCount ?? 3}</span>
				</div>
				<div class="flex flex-col md:flex-row items-stretch">
					<div class="flex items-center gap-3 px-4 py-4 flex-1 {finalMatch.winnerId === finalMatch.team1Id ? 'bg-neutral-100' : ''}">
						{#if finalMatch.winnerId === finalMatch.team1Id}
							<Trophy size={16} class="shrink-0 text-accent" aria-hidden="true" />
						{/if}
						<div class="w-10 h-10 shrink-0 border border-current/30 flex items-center justify-center text-xl overflow-hidden">
							{#if teamLogo(finalMatch.team1)}
								<img src={teamLogo(finalMatch.team1)} alt={finalMatch.team1?.name} class="w-full h-full object-cover" />
							{:else if teamEmoji(finalMatch.team1)}
								<span aria-hidden="true">{teamEmoji(finalMatch.team1)}</span>
							{/if}
						</div>
						<span class="font-black tracking-tight truncate">{finalMatch.team1?.name ?? '—'}</span>
					</div>
					<div class="flex items-center justify-center gap-2 px-4 py-4 border-t md:border-t-0 md:border-x border-black bg-neutral-50 shrink-0">
						<span class="font-black text-2xl tracking-tight tabular-nums">{finalMatch.team1Score ?? 0}</span>
						<span class="text-xs font-black text-neutral-400">:</span>
						<span class="font-black text-2xl tracking-tight tabular-nums">{finalMatch.team2Score ?? 0}</span>
					</div>
					<div class="flex items-center gap-3 px-4 py-4 flex-1 {finalMatch.winnerId === finalMatch.team2Id ? 'bg-neutral-100' : ''}">
						{#if finalMatch.winnerId === finalMatch.team2Id}
							<Trophy size={16} class="shrink-0 text-accent" aria-hidden="true" />
						{/if}
						<div class="w-10 h-10 shrink-0 border border-current/30 flex items-center justify-center text-xl overflow-hidden">
							{#if teamLogo(finalMatch.team2)}
								<img src={teamLogo(finalMatch.team2)} alt={finalMatch.team2?.name} class="w-full h-full object-cover" />
							{:else if teamEmoji(finalMatch.team2)}
								<span aria-hidden="true">{teamEmoji(finalMatch.team2)}</span>
							{/if}
						</div>
						<span class="font-black tracking-tight truncate">{finalMatch.team2?.name ?? '—'}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- 最终排名 -->
		<div class="border border-black bg-white mb-8">
			<div class="flex items-center gap-2 px-4 py-2 border-b-2 border-black">
				<Medal size={14} class="shrink-0 text-accent" aria-hidden="true" />
				<span class="text-xs font-black uppercase tracking-widest text-black">最终排名</span>
				<span class="text-xs font-bold text-neutral-500 ml-auto">{sortedRanking.length} 支队伍</span>
			</div>
			{#if sortedRanking.length === 0}
				<div class="px-4 py-10 text-center text-sm font-bold text-neutral-400">暂无排名数据</div>
			{:else}
				<div class="divide-y divide-black">
					{#each sortedRanking as row, i (row.teamId)}
						<div class="flex items-center gap-3 md:gap-4 px-4 py-3 {isChampion(row) ? 'bg-accent/5' : ''}">
							<span class="w-12 shrink-0 font-black text-sm px-1 py-0.5 text-center border border-black {rankStart(row.label) <= 3 ? 'bg-black text-white' : 'bg-neutral-100 text-black'}">{row.label}</span>
							<div class="w-8 h-8 shrink-0 border border-black flex items-center justify-center text-lg overflow-hidden">
								{#if teamLogo(row)}
									<img src={teamLogo(row)} alt={row.name} class="w-full h-full object-cover" />
								{:else if teamEmoji(row)}
									<span aria-hidden="true">{teamEmoji(row)}</span>
								{:else}
									<span class="text-neutral-300 font-black text-xs" aria-hidden="true">{row.name?.slice(0, 1)}</span>
								{/if}
							</div>
							<a
								href="/teams/{row.teamId}"
								class="flex-1 min-w-0 font-black tracking-tight text-black hover:text-accent hover:underline truncate"
							>
								{row.name}
								{#if isChampion(row)}
									<span class="ml-2 text-xs font-black text-accent align-middle">冠军</span>
								{/if}
							</a>
							{#if row.seed}
								<span class="text-xs font-bold text-neutral-400 shrink-0 hidden sm:block">#{row.seed}</span>
							{/if}
							<span class="text-xs font-bold text-neutral-500 shrink-0">{row.wins}W-{row.losses}L</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
