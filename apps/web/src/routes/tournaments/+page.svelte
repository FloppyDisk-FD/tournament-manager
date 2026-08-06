<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Index as FlexIndex } from 'flexsearch';
	import Input from '$lib/components/Input.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { FORMAT_MAP } from '$lib/constants/tournament';
	import { Search, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import TournamentCard from '$lib/components/TournamentCard.svelte';
	import HeroHeader from '$lib/components/HeroHeader.svelte';
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

	// ---- 搜索/筛选状态（URL 为唯一状态源：可分享/收藏/刷新保留）----
	const sp = $derived(page.url.searchParams);
	const searchQ = $derived(sp.get('q') ?? '');
	const searchStatus = $derived(sp.get('status') ?? '');
	const searchFormat = $derived(sp.get('format') ?? '');
	const searchFee = $derived(sp.get('fee') ?? '');
	const pageNum = $derived(Math.max(1, Number(sp.get('page')) || 1));
	const PER_PAGE = 12;

	/** 本地输入缓冲（搜索框打字用，回车/失焦才写入 URL） */
	let qInput = $state(searchQ);
	$effect(() => { qInput = searchQ; });

	/** 更新 URL 查询参数（触发 load 重跑，深链接保留） */
	function updateQuery(patch: Record<string, string>, resetPage = false) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(patch)) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}
		if (resetPage) url.searchParams.delete('page');
		goto(url.pathname + url.search);
	}
	function applySearch() {
		updateQuery({ q: qInput.trim() }, true);
	}
	function applyFilter(kind: 'status' | 'format' | 'fee', v: string) {
		updateQuery({ [kind]: v }, true);
	}
	function goPage(p: number) {
		const total = totalPages;
		updateQuery({ page: String(Math.max(1, Math.min(p, total))) });
	}

	const STATUS_OPTIONS = [
		{ value: '', label: '全部状态' },
		{ value: 'draft', label: '报名中' },
		{ value: 'ongoing', label: '进行中' },
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

	function clearFilters() {
		qInput = '';
		updateQuery({ q: '', status: '', format: '', fee: '' }, true);
	}
</script>

<svelte:head>
	<title>发现赛事 — Tournix</title>
	<meta name="description" content="浏览 Tournix 上的公开电竞赛事：单败淘汰、双败淘汰、循环联赛、瑞士轮。搜索赛事、查看赛程与报名。" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
	<!-- 标题栏（公共组件） -->
	<HeroHeader title="发现赛事" en="Discover" badge="Discover" subtitle={`共 ${total} 场公开赛事 · 当前显示 ${filtered.length} 场`} />

	<!-- 搜索 + 筛选 -->
	<div class="border-2 border-black bg-white p-4 mb-6 space-y-3">
		<div class="flex gap-0">
			<div class="flex-1">
				<Input id="discover-q" type="search" bind:value={qInput} placeholder="搜索赛事名称或游戏..." onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && applySearch()} class="pr-10" />
			</div>
			<button type="button" onclick={applySearch} class="border-2 border-black bg-black text-white px-4 py-2 text-sm font-black hover:bg-accent hover:border-accent transition-colors duration-150 inline-flex items-center gap-1.5 shrink-0">
				<Search size={14} class="shrink-0" aria-hidden="true" />
				搜索
			</button>
		</div>
		<div class="flex flex-wrap gap-2 items-center">
			<label class="text-xs font-black uppercase tracking-widest text-neutral-400">筛选</label>
			<select value={searchStatus} onchange={(e: Event) => applyFilter('status', (e.target as HTMLSelectElement).value)} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each STATUS_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<select value={searchFormat} onchange={(e: Event) => applyFilter('format', (e.target as HTMLSelectElement).value)} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each FORMAT_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<select value={searchFee} onchange={(e: Event) => applyFilter('fee', (e.target as HTMLSelectElement).value)} class="border border-black font-sans px-2 py-1.5 text-sm bg-white focus:outline-none">
				{#each FEE_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
			</select>
			<a href="/tournaments/archived" class="text-xs font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150 inline-flex items-center gap-1">已结束赛事 <ArrowRight size={11} class="shrink-0" aria-hidden="true" /></a>
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
				<TournamentCard tournament={item} variant="discover" />
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
