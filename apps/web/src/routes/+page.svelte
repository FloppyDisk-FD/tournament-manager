<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';
	import { goto } from '$app/navigation';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { FORMAT_MAP } from '$lib/constants/tournament';
	import { detectLang, translate, type Lang, type TKey } from '$lib/stores/i18n.svelte';

	import { ArrowRight, ChevronLeft, ChevronRight, Trophy } from 'lucide-svelte';

	let lang = $state<Lang>(detectLang());
	function t(key: TKey) { return translate(key, lang); }

	let { data } = $props();

	const filters = [
		{ value: '', label: '全部' },
		{ value: 'ongoing', label: '进行中' },
		{ value: 'completed', label: '已结束', href: '/tournaments/archived' },
		{ value: 'draft', label: '报名中' },
	];

	function setFilter(status: string) {
		const target = status ? `/?status=${encodeURIComponent(status)}` : '/';
		goto(target);
	}

	const allTournaments = $derived(data.allTournaments ?? []);
	const currentStatus = $derived(data.currentStatus);

	// 状态筛选在客户端执行（服务端只拉一次全量数据）
	const visibleTournaments = $derived(
		allTournaments.filter((t) => !currentStatus || t.status === currentStatus),
	);
	const carouselItems = $derived(allTournaments.filter((t) => t.coverImage ?? t.cover_image));
	let carouselIndex = $state(0);
	let carouselTimer: ReturnType<typeof setInterval> | undefined;

	function reducedMotion(): boolean {
		return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function carouselNext() {
		if (carouselItems.length < 2) return;
		carouselIndex = (carouselIndex + 1) % carouselItems.length;
		resetTimer();
	}

	function carouselPrev() {
		if (carouselItems.length < 2) return;
		carouselIndex = (carouselIndex - 1 + carouselItems.length) % carouselItems.length;
		resetTimer();
	}

	function resetTimer() {
		clearInterval(carouselTimer);
		if (reducedMotion()) return;
		carouselTimer = setInterval(carouselNext, 5000);
	}

	onMount(() => {
		resetTimer();
		return () => clearInterval(carouselTimer);
	});

	const carouselItem = $derived(carouselItems[carouselIndex] ?? null);
	const carouselCover = $derived(carouselItem ? (carouselItem.coverImage ?? carouselItem.cover_image ?? '') : '');
</script>

<svelte:head>
	<title>Tournix — 首页</title>
</svelte:head>

<!-- Hero -->
<section class="border-b-2 border-black px-4 md:px-8 lg:px-16 py-12 md:py-20 lg:py-24">
	<div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
		<!-- 左侧：品牌 + 搜索 -->
		<div>
			<div class="animate-enter" style="animation-delay:50ms">
				<span class="inline-block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">Tournix</span>
			</div>
			<h1 class="font-black text-4xl md:text-6xl leading-tight tracking-tight text-black mb-4 animate-enter" style="animation-delay:100ms">
				电竞赛事<br />管理平台
			</h1>
			<p class="text-sm md:text-base text-neutral-600 max-w-xl mb-6 md:mb-8 animate-enter" style="animation-delay:150ms">
				创建和管理你的电竞赛事。支持单败淘汰、双败淘汰、循环联赛、瑞士轮四种赛制。
			</p>

			<div class="flex flex-wrap gap-3 animate-enter" style="animation-delay:250ms">
				<a
					href="#tournaments"
					class="inline-flex items-center gap-1.5 text-sm font-black border border-black px-4 py-2 bg-black text-white hover:bg-accent hover:border-accent transition-colors duration-150"
				>
					浏览赛事
					<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
				</a>
				<a
					href="/tournaments/archived"
					class="inline-flex items-center gap-1.5 text-sm font-black border border-black px-4 py-2 bg-white text-black hover:bg-neutral-100 transition-colors duration-150"
				>
					历史归档
				</a>
			</div>
		</div>

		<!-- 右侧：封面滚动图 -->
		<div class="relative border-2 border-black bg-white animate-enter" style="animation-delay:200ms" role="region" aria-label="赛事封面轮播">
			{#if carouselItem}
				<a href="/tournaments/{carouselItem.id}" class="block relative h-56 md:h-72 overflow-hidden group">
					{#if carouselCover}
						<img src={carouselCover} alt={carouselItem.name} class="w-full h-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
					{:else}
						<div class="w-full h-full flex items-center justify-center bg-black text-white text-6xl">
							<Trophy size={64} class="text-white/20" aria-hidden="true" />
						</div>
					{/if}
					<div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden="true"></div>
					<div class="absolute bottom-0 left-0 right-0 p-4 md:p-5">
						<div class="flex items-center gap-2 mb-1.5">
							<StatusBadge status={carouselItem.status} class="bg-black text-white" />
							<span class="text-[10px] font-bold text-white/80 uppercase tracking-widest">{FORMAT_MAP[carouselItem.format] ?? carouselItem.format}</span>
							{#if (carouselItem.entryFee ?? 0) > 0}
								<span class="text-[10px] font-black bg-accent text-white px-1.5 py-0.5 shrink-0">报名费 ¥{carouselItem.entryFee}</span>
							{/if}
						</div>
						<h3 class="font-black text-xl md:text-2xl tracking-tight text-white truncate">{carouselItem.name}</h3>
						{#if carouselItem.game}
							<p class="text-xs font-bold text-white/70 mt-0.5">{carouselItem.game}</p>
						{/if}
					</div>
				</a>
				{#if carouselItems.length > 1}
					<button
						onclick={carouselPrev}
						class="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-white/60 bg-black/50 text-white hover:bg-black transition-colors duration-150 press"
						aria-label="上一张"
					>
						<ChevronLeft size={18} class="shrink-0" aria-hidden="true" />
					</button>
					<button
						onclick={carouselNext}
						class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-white/60 bg-black/50 text-white hover:bg-black transition-colors duration-150 press"
						aria-label="下一张"
					>
						<ChevronRight size={18} class="shrink-0" aria-hidden="true" />
					</button>
					<div class="absolute bottom-2.5 right-3 flex gap-1.5" role="tablist" aria-label="轮播分页">
						{#each carouselItems as _, i}
							<button
								role="tab"
								aria-selected={i === carouselIndex}
								aria-label={`第 ${i + 1} 张`}
								onclick={() => {
									carouselIndex = i;
									resetTimer();
								}}
								class={cn('w-2 h-2 border border-white transition-colors duration-150', i === carouselIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/60')}
							></button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="h-56 md:h-72 flex flex-col items-center justify-center gap-3 bg-black text-white p-6 text-center">
					<Trophy size={48} class="text-white/20" aria-hidden="true" />
					<p class="text-sm font-bold text-white/60">暂无赛事封面</p>
					<a href="/admin/tournaments/new" class="text-xs font-black border border-white/50 px-3 py-1.5 hover:bg-white hover:text-black transition-colors duration-150">
						创建第一场赛事
					</a>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Tournament List -->
<section id="tournaments" class="px-4 md:px-8 lg:px-16 py-8 md:py-12">
	<div class="max-w-7xl mx-auto">
		<!-- 标题行 -->
		<div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
			<div>
				<h2 class="font-black text-xl md:text-2xl tracking-tight text-black">全部赛事</h2>
			</div>
			<div class="flex items-center gap-4">
				<a href="/tournaments" class="inline-flex items-center gap-1 text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">
					发现更多赛事
					<ArrowRight size={13} class="shrink-0" aria-hidden="true" />
				</a>
				<a href="/tournaments/archived" class="inline-flex items-center gap-1 text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">
					历史归档
					<ArrowRight size={13} class="shrink-0" aria-hidden="true" />
				</a>
			</div>
		</div>

		<!-- Filter -->
		<div class="flex flex-wrap gap-0 mb-8 border border-black w-full" role="tablist" aria-label="赛事状态筛选">
			{#each filters as f, i}
				{#if f.href}
					<a
						href={f.href}
						class={cn(
							'flex-1 min-w-0 px-4 md:px-6 py-2 md:py-3 text-sm font-bold transition-opacity duration-150 press inline-flex items-center justify-center gap-1',
							i > 0 ? 'border-l border-black' : '',
							currentStatus === f.value
								? 'bg-black text-white'
								: 'bg-white text-black hover:bg-neutral-100'
						)}
					>
						{f.label}
						<ArrowRight size={12} class="shrink-0" aria-hidden="true" />
					</a>
				{:else}
					<button
						role="tab"
						aria-selected={currentStatus === f.value}
						onclick={() => setFilter(f.value)}
						class={cn(
							'flex-1 min-w-0 px-4 md:px-6 py-2 md:py-3 text-sm font-bold transition-opacity duration-150 active:opacity-70 press',
							i > 0 ? 'border-l border-black' : '',
							currentStatus === f.value
								? 'bg-black text-white'
								: 'bg-white text-black hover:bg-neutral-100'
						)}
					>
						{f.label}
					</button>
				{/if}
			{/each}
		</div>

		{#if visibleTournaments.length === 0}
			<div class="py-20 text-center">
				<EmptyState
					title="暂无赛事"
					description="请前往管理后台创建，或去发现页浏览公开赛事"
					class="bg-neutral-50 px-8 py-6"
				/>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-l border-t border-black">
				{#each visibleTournaments as t, i (t.id)}
					<a
						href="/tournaments/{t.id}"
						class="block border-r border-b border-black bg-white hover:bg-neutral-50 transition-colors duration-150 group animate-enter lift flex flex-col"
						style="animation-delay:{Math.min(i * 40, 320)}ms"
					>
						{#if t.coverImage ?? t.cover_image}
						<div class="h-32 overflow-hidden border-b border-black">
							<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
						</div>
					{/if}
						<div class="p-4 md:p-6 flex-1 flex flex-col">
							<div class="flex items-center gap-2 mb-3">
								<StatusBadge status={t.status} />
								<span class="text-xs text-neutral-500 font-bold">{FORMAT_MAP[t.format] ?? t.format}</span>
								{#if (t.entryFee ?? 0) > 0}
									<span class="ml-auto text-[10px] font-black bg-neutral-100 border border-black px-1.5 py-0.5 shrink-0">报名费 ¥{t.entryFee}</span>
								{/if}
							</div>
							<h3 class="font-black text-lg md:text-xl tracking-tight text-black mb-1">{t.name}</h3>
							{#if t.game}
								<p class="text-sm text-neutral-600">{t.game}</p>
							{/if}
							<div class="text-sm font-bold text-black flex items-center gap-1 mt-auto pt-4">
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
