<script lang="ts">
	import { onMount } from 'svelte';
	import { Index as FlexIndex } from 'flexsearch';
	import Input from '$lib/components/Input.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP } from '$lib/constants/tournament';
	import { Search, ArrowRight, ChevronLeft, ChevronRight, Trophy, Users } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const all = $derived((data.tournaments ?? []) as any[]);
	const total = $derived(data.total ?? 0);

	// ---- flexsearch 索引（客户端即时搜索，与首页一致）----
	let searchIndex: FlexIndex | null = null;
	onMount(() => {
		const idx = new FlexIndex({ tokenize: 'full', context: true });
		for (const t of all) {
			idx.add(t.id, `${t.name} ${t.game ?? ''} ${FORMAT_MAP[t.format] ?? t.format ?? ''}`);
		}
		searchIndex = idx;
	});

	// ---- 搜索/筛选状态 ----
	let searchQ = $state(data.filters?.q ?? '');
	let searchStatus = $state(data.filters?.status ?? '');
	let searchFormat = $state(data.filters?.format ?? '');
	let searchFee = $state(data.filters?.fee ?? '');
	let pageNum = $state(1);
	const PER_PAGE = 12;

	const STATUS_OPTIONS = [
		{ value: '', label: '全部状态' },
		{ value: 'draft', label: '报名中' },
		{ value: 'ongoing', label: '进行中' },
		{ value: 'completed', label: '已结束' },
	];
	const FORMAT_OPTIONS = [
		{ value: '', label: '全部赛制' },
		{ value: 'single_elim', label: '单败淘汰' },
		{ value: 'double_elim', label: '双败淘汰' },
		{ value: 'round_robin', label: '循环联赛' },
		{ value: 'swiss', label: '瑞士轮' },
	];
	const FEE_OPTIONS = [
		{ value: '', label: '全部费用' },
		{ value: 'free', label: '免费' },
		{ value: 'paid', label: '付费' },
	];

	// ---- 客户端过滤（搜索词 + 筛选组合）----
	const filtered = $derived.by(() => {
		let list = all;
		if (searchStatus) list = list.filter((t) => t.status === searchStatus);
		if (searchFormat) list = list.filter((t) => t.format === searchFormat);
		if (searchFee === 'free') list = list.filter((t) => (t.entryFee ?? 0) <= 0);
		if (searchFee === 'paid') list = list.filter((t) => (t.entryFee ?? 0) > 0);
		if (searchQ.trim() && searchIndex) {
			const ids = searchIndex.search(searchQ.trim(), { limit: 100 }) as string[];
			const idSet = new Set(ids);
			list = list.filter((t) => idSet.has(t.id));
		} else if (searchQ.trim() && !searchIndex) {
			// 索引未就绪（SSR/首帧）：退化为名称包含匹配
			const q = searchQ.trim().toLowerCase();
			list = list.filter((t) => (t.name ?? '').toLowerCase().includes(q) || (t.game ?? '').toLowerCase().includes(q));
		}
		return list;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
	const paged = $derived(filtered.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE));

	// 筛选变化时回到第一页（依赖筛选条件，不含 pageNum）
	$effect(() => {
		void searchQ; void searchStatus; void searchFormat; void searchFee;
		pageNum = 1;
	});

	function goPage(p: number) {
		pageNum = Math.max(1, Math.min(totalPages, p));
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function clearFilters() {
		searchQ = '';
		searchStatus = '';
		searchFormat = '';
		searchFee = '';
	}

	/** 报名费显示 */
	function feeLabel(entryFee: number | null | undefined): string | null {
		const f = entryFee ?? 0;
		return f > 0 ? `报名费 ¥${f}` : '免费';
	}
</script>

<svelte:head>
	<title>发现赛事 — Tournix</title>
	<meta name="description" content="浏览 Tournix 上的公开电竞赛事：单败淘汰、双败淘汰、循环联赛、瑞士轮。搜索赛事、查看赛程与报名。" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
	<!-- 标题栏 -->
	<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-6">
		<div class="relative z-10">
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
				<span class="text-xs font-black uppercase tracking-widest text-white/60">Discover</span>
			</div>
			<h1 class="font-black text-2xl md:text-3xl tracking-tight">发现赛事</h1>
			<p class="text-sm text-white/70 mt-1">共 {total} 场公开赛事 · 当前显示 {filtered.length} 场</p>
		</div>
		<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15" style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Discover</span>
	</div>

	<!-- 搜索 + 筛选 -->
	<div class="border-2 border-black bg-white p-4 mb-6 space-y-3">
		<div class="flex gap-0">
			<div class="flex-1">
				<Input id="discover-q" type="search" bind:value={searchQ} placeholder="搜索赛事名称或游戏..." class="pr-10" />
			</div>
			<button type="button" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} class="border-2 border-black bg-black text-white px-4 py-2 text-sm font-black hover:bg-accent hover:border-accent transition-colors duration-150 inline-flex items-center gap-1.5 shrink-0">
				<Search size={14} class="shrink-0" aria-hidden="true" />
				搜索
			</button>
		</div>
		<div class="flex flex-wrap gap-2 items-center">
			<label class="text-xs font-black uppercase tracking-widest text-neutral-400">筛选</label>
			<select bind:value={searchStatus} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each STATUS_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<select bind:value={searchFormat} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each FORMAT_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<select bind:value={searchFee} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each FEE_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			{#if (searchQ || searchStatus || searchFormat || searchFee)}
				<button type="button" onclick={clearFilters} class="text-xs font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150">清除筛选</button>
			{/if}
		</div>
	</div>

	<!-- 赛事网格 -->
	{#if paged.length === 0}
		<EmptyState
			title="没有找到赛事"
			description="换个关键词或清除筛选条件试试"
		/>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each paged as item (item.id)}
				<a href="/tournaments/{item.id}" class="border-2 border-black bg-white flex flex-col hover:bg-neutral-50 transition-colors duration-150 group">
					<div class="relative h-36 overflow-hidden border-b-2 border-black bg-neutral-100">
						{#if item.coverImage ?? item.cover_image}
							<img src={item.coverImage ?? item.cover_image} alt={item.name} loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
						{:else}
							<div class="w-full h-full flex items-center justify-center">
								<Trophy size={36} class="text-neutral-300" aria-hidden="true" />
							</div>
						{/if}
						<span class="absolute top-2 left-2 text-[10px] font-black bg-black text-white px-1.5 py-0.5">{TOURNAMENT_STATUS_MAP[item.status]?.label ?? item.status}</span>
						{#if feeLabel(item.entryFee)}
							<span class="absolute top-2 right-2 text-[10px] font-black bg-accent text-white px-1.5 py-0.5">{feeLabel(item.entryFee)}</span>
						{/if}
					</div>
					<div class="p-3 flex flex-col flex-1">
						<div class="font-black text-base tracking-tight truncate">{item.name}</div>
						<div class="flex items-center gap-2 mt-1 text-xs text-neutral-500 font-bold">
							<span class="truncate">{item.game ?? '综合'}</span>
							<span class="shrink-0">· {FORMAT_MAP[item.format] ?? item.format}</span>
						</div>
						<div class="flex items-center gap-3 mt-auto pt-3 text-xs text-neutral-600 font-bold">
							<span class="inline-flex items-center gap-1"><Users size={12} class="shrink-0" aria-hidden="true" />{item.maxTeams ?? '—'} 队</span>
							<span class="inline-flex items-center gap-1 ml-auto text-black font-black group-hover:text-accent transition-colors duration-150">查看详情 <ArrowRight size={12} class="shrink-0" /></span>
						</div>
					</div>
				</a>
			{/each}
		</div>

		<!-- 分页 -->
		{#if totalPages > 1}
			<nav class="flex items-center justify-center gap-2 mt-8" aria-label="分页">
				<button type="button" onclick={() => goPage(pageNum - 1)} disabled={pageNum <= 1} class="border border-black px-3 py-1.5 text-sm font-bold bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1">
					<ChevronLeft size={14} class="shrink-0" aria-hidden="true" />上一页
				</button>
				<span class="text-sm font-black tabular-nums px-2">{pageNum} / {totalPages}</span>
				<button type="button" onclick={() => goPage(pageNum + 1)} disabled={pageNum >= totalPages} class="border border-black px-3 py-1.5 text-sm font-bold bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1">
					下一页<ChevronRight size={14} class="shrink-0" aria-hidden="true" />
				</button>
			</nav>
		{/if}
	{/if}
</div>
