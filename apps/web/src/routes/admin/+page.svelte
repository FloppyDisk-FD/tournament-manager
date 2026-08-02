<script lang="ts">
	import { cn } from '$lib/utils';
	import Button from '$lib/components/Button.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP } from '$lib/constants/tournament';
	import { formatDate } from '$lib/utils/format';

	let { data } = $props();
	let stats = $derived(data.stats);
	let recent: any[] = $derived(data.recent ?? []);

	const cards = $derived([
		{ label: '赛事总数', value: stats.tournaments, accent: false },
		{ label: '进行中', value: stats.ongoing, accent: true },
		{ label: '已结束', value: stats.completed, accent: false },
	]);
</script>

<div class="animate-enter">
	<PageHeader title="管理概览" en="Dashboard" />

	<!-- Stat cards -->
	<div class="grid grid-cols-3 gap-0 border-l border-t border-black mb-8">
		{#each cards as c, i}
			<StatCard label={c.label} value={c.value} accent={c.accent} class="border-r border-b border-black animate-enter" style="animation-delay:{i * 60}ms" />
		{/each}
	</div>

	<!-- Quick action -->
	<div class="border border-black bg-neutral-50 p-4 md:p-6 animate-enter" style="animation-delay:200ms">
		<div class="flex items-center justify-between flex-wrap gap-4">
			<div>
				<div class="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">快速操作</div>
				<div class="font-black text-lg md:text-xl tracking-tight">开始创建新赛事</div>
			</div>
			<Button href="/admin/tournaments/new" en="Create Tournament">
				创建赛事 →
			</Button>
		</div>
	</div>

	<!-- Recent tournaments -->
	<div class="mt-8 border-t border-black pt-6 animate-enter" style="animation-delay:280ms">
		<div class="flex items-baseline justify-between mb-3 flex-wrap gap-2">
			<div class="text-xs font-bold uppercase tracking-widest text-neutral-500">最近赛事</div>
			<a href="/admin/tournaments" class="text-xs font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">
				查看全部 →
			</a>
		</div>

		{#if recent.length === 0}
			<div class="border border-black bg-white px-4 py-6 text-center">
				<p class="text-sm text-neutral-500 font-bold">暂无赛事</p>
				<p class="text-xs text-neutral-400 mt-1">创建第一个赛事开始管理</p>
			</div>
		{:else}
			<div class="border-l border-t border-black">
				{#each recent as t, i (t.id)}
					<a
						href="/admin/tournaments/{t.id}"
						class="flex items-center justify-between gap-3 border-r border-b border-black bg-white p-3 md:p-4 hover:bg-neutral-50 transition-colors duration-150 group"
					>
						<div class="flex items-center gap-3 min-w-0 flex-1">
							<span class="text-xs font-black tabular-nums text-neutral-400 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
							<span class={cn('px-2 py-0.5 text-xs font-bold shrink-0', TOURNAMENT_STATUS_MAP[t.status]?.variant ?? 'bg-neutral-100 text-black')}>
								{TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status}
							</span>
							<div class="min-w-0 flex-1">
								<div class="font-bold text-sm text-black truncate">{t.name}</div>
								<div class="text-xs text-neutral-500 font-bold mt-0.5 flex items-center gap-2">
									<span>{FORMAT_MAP[t.format] ?? t.format}</span>
									<span class="text-neutral-300">·</span>
									<span>{formatDate(t.created_at ?? t.createdAt)}</span>
								</div>
							</div>
						</div>
						<span class="text-sm font-bold text-black transition-transform duration-150 group-hover:translate-x-1 shrink-0">→</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
