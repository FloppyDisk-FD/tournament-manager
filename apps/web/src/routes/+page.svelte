<script lang="ts">
	import { cn } from '$lib/utils';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const statusMap: Record<string, { label: string; variant: string }> = {
		draft: { label: '未开始', variant: 'bg-neutral-100 text-black' },
		ongoing: { label: '进行中', variant: 'bg-black text-white' },
		completed: { label: '已结束', variant: 'bg-accent text-white' },
		cancelled: { label: '已取消', variant: 'bg-white text-neutral-500 line-through border border-black' },
	};

	const formatMap: Record<string, string> = {
		single_elim: '单败淘汰',
		double_elim: '双败淘汰',
		round_robin: '循环联赛',
		swiss: '瑞士轮',
	};

	const filters = [
		{ value: '', label: '全部' },
		{ value: 'ongoing', label: '进行中' },
		{ value: 'completed', label: '已结束' },
		{ value: 'draft', label: '未开始' },
	];

	function setFilter(status: string) {
		const target = status ? `/?status=${encodeURIComponent(status)}` : '/';
		goto(target);
	}

	const tournaments = $derived(data.tournaments);
	const currentStatus = $derived(data.currentStatus);
</script>

<svelte:head>
	<title>赛事管理平台 — 首页</title>
</svelte:head>

<!-- Hero -->
<section class="border-b-2 border-black px-4 md:px-8 lg:px-16 py-12 md:py-24 lg:py-32">
	<div class="max-w-7xl mx-auto">
		<div class="animate-enter" style="animation-delay:50ms">
			<span class="inline-block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">Tournament Platform</span>
		</div>
		<h1 class="font-black text-4xl md:text-6xl lg:text-7xl leading-tight tracking-tight text-black mb-4 animate-enter" style="animation-delay:100ms">
			电竞赛事<br />管理平台
		</h1>
		<p class="text-sm md:text-base text-neutral-600 max-w-xl mb-6 md:mb-8 animate-enter" style="animation-delay:150ms">
			创建和管理你的电竞赛事。支持单败淘汰、双败淘汰、循环联赛、瑞士轮四种赛制。
		</p>
	</div>
</section>

<!-- Tournament List -->
<section class="px-4 md:px-8 lg:px-16 py-8 md:py-12">
	<div class="max-w-7xl mx-auto">
		<!-- Filter -->
		<div class="flex flex-wrap gap-0 mb-8 border border-black" role="tablist" aria-label="赛事状态筛选">
			{#each filters as f, i}
				<button
					role="tab"
					aria-selected={currentStatus === f.value}
					onclick={() => setFilter(f.value)}
					class={cn(
						'px-4 md:px-6 py-2 md:py-3 text-sm font-bold transition-opacity duration-150 active:opacity-70 press',
						i > 0 ? 'border-l border-black' : '',
						currentStatus === f.value
							? 'bg-black text-white'
							: 'bg-white text-black hover:bg-neutral-100'
					)}
				>
					{f.label}
				</button>
			{/each}
		</div>

		{#if tournaments.length === 0}
			<div class="py-20 text-center">
				<div class="inline-block border border-black bg-neutral-50 px-8 py-6">
					<p class="text-sm text-neutral-500 mb-1 font-bold">暂无赛事</p>
					<p class="text-xs text-neutral-400">请前往管理后台创建</p>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-l border-t border-black">
				{#each tournaments as t, i (t.id)}
					<a
						href="/tournaments/{t.id}"
						class="block border-r border-b border-black bg-white hover:bg-neutral-50 transition-colors duration-150 group animate-enter lift"
						style="animation-delay:{Math.min(i * 40, 320)}ms"
					>
						{#if t.coverImage ?? t.cover_image}
						<div class="h-32 overflow-hidden border-b border-black">
							<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
						</div>
					{/if}
						<div class="p-4 md:p-6">
							<div class="flex items-center gap-2 mb-3">
								<span class={cn('px-2 py-0.5 text-xs font-bold', statusMap[t.status]?.variant)}>
									{statusMap[t.status]?.label ?? t.status}
								</span>
								<span class="text-xs text-neutral-500 font-bold">{formatMap[t.format] ?? t.format}</span>
							</div>
							<h3 class="font-black text-lg md:text-xl tracking-tight text-black mb-1">{t.name}</h3>
							{#if t.game}
								<p class="text-sm text-neutral-600">{t.game}</p>
							{/if}
							<div class="mt-4 text-sm font-bold text-black flex items-center gap-1">
								<span>查看详情</span>
								<span class="transition-transform duration-150 group-hover:translate-x-1">→</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</section>
