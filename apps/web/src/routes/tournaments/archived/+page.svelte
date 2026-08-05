<script lang="ts">
	import { ArrowRight, History } from 'lucide-svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { FORMAT_MAP } from '$lib/constants/tournament';

	let { data } = $props();
	const tournaments = $derived(data.tournaments);

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '—';
		try {
			return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
		} catch {
			return '—';
		}
	}
</script>

<svelte:head>
	<title>历史赛事 — Tournix</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 md:px-8 py-8">
	<div class="mb-6">
		<BackLink href="/">返回首页</BackLink>
	</div>

	<!-- 标题栏：黑底 + 渐变水印 -->
	<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-8">
		<div class="relative z-10">
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Archive</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">历史赛事</h1>
			<p class="text-sm text-white/70 mt-1">已结束赛事自动归档，可回溯查看赛程、比分与最终排名</p>
		</div>
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>Archive</span>
	</div>

	{#if tournaments.length === 0}
		<EmptyState
			title="暂无已结束赛事"
			description="赛事结束后会自动出现在这里"
			class="border border-black px-8 py-10"
		/>
	{:else}
		<div class="border-t border-l border-black">
			{#each tournaments as t, i (t.id)}
				<div
					class="group flex flex-col md:flex-row md:items-center gap-3 border-r border-b border-black bg-white px-4 md:px-6 py-4 hover:bg-neutral-50 transition-colors duration-150"
					style="animation-delay:{Math.min(i * 30, 300)}ms"
				>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-xs font-black uppercase tracking-widest text-neutral-400 shrink-0">#{String(tournaments.length - i).padStart(2, '0')}</span>
							<span class="text-xs font-bold text-neutral-500 shrink-0">{FORMAT_MAP[t.format] ?? t.format}</span>
							{#if t.game}
								<span class="text-xs text-neutral-400 truncate">{t.game}</span>
							{/if}
						</div>
						<h2 class="font-black text-lg tracking-tight text-black truncate">{t.name}</h2>
					</div>
					<div class="flex items-center gap-4 md:gap-6 shrink-0">
						<span class="text-xs font-bold text-neutral-500 hidden sm:block">{fmtDate(t.startDate ?? t.createdAt)}</span>
						<a
							href="/tournaments/{t.id}"
							class="inline-flex items-center gap-1 text-sm font-bold text-black border border-black px-3 py-1.5 bg-white hover:bg-black hover:text-white transition-colors duration-150"
						>
							查看详情
						</a>
						<a
							href="/tournaments/{t.id}/review"
							class="inline-flex items-center gap-1 text-sm font-black text-black bg-black text-white px-3 py-1.5 hover:bg-accent hover:border-accent transition-colors duration-150"
						>
							<History size={14} class="shrink-0" aria-hidden="true" />
							赛事回顾
							<ArrowRight size={14} class="shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" aria-hidden="true" />
						</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
