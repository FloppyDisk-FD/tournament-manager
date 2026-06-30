<script lang="ts">
	let { data } = $props();
	let stats = $derived(data.stats);

	const cards = $derived([
		{ label: '赛事总数', value: stats.tournaments, accent: false },
		{ label: '进行中', value: stats.ongoing, accent: true },
		{ label: '已结束', value: stats.completed, accent: false },
	]);
</script>

<div class="animate-enter">
	<div class="flex items-baseline justify-between mb-6 flex-wrap gap-2">
		<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">管理概览</h1>
		<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Dashboard</span>
	</div>

	<div class="grid grid-cols-3 gap-0 border-l border-t border-black mb-8">
		{#each cards as c, i}
			<div
				class="border-r border-b border-black bg-white p-4 md:p-6 lift animate-enter"
				style="animation-delay:{i * 60}ms"
			>
				<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{c.label}</div>
				<div class="font-black text-3xl md:text-5xl mt-2 tabular-nums {c.accent ? 'text-accent' : 'text-black'}">
					{c.value}
				</div>
			</div>
		{/each}
	</div>

	<div class="border border-black bg-neutral-50 p-4 md:p-6 animate-enter" style="animation-delay:200ms">
		<div class="flex items-center justify-between flex-wrap gap-4">
			<div>
				<div class="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">快速操作</div>
				<div class="font-black text-lg md:text-xl tracking-tight">开始创建新赛事</div>
			</div>
			<a
				href="/admin/tournaments/new"
				class="inline-flex items-center gap-2 border border-black bg-black text-white font-bold px-5 py-2.5 text-sm transition-opacity duration-150 active:opacity-70 press hover:opacity-90"
			>
				<span>创建赛事</span>
				<span>→</span>
			</a>
		</div>
	</div>

	<div class="mt-8 border-t border-black pt-6 animate-enter" style="animation-delay:280ms">
		<div class="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">最近赛事</div>
		<div class="border border-black bg-white">
			<a href="/admin/tournaments" class="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors duration-150 group">
				<span class="font-bold text-sm">管理全部赛事</span>
				<span class="text-sm font-bold transition-transform duration-150 group-hover:translate-x-1">→</span>
			</a>
		</div>
	</div>
</div>
