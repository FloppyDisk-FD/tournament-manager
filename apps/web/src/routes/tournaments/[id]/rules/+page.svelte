<script lang="ts">
	import { FileText, ArrowRight, Users, Swords, CircleDot } from 'lucide-svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { FORMAT_MAP, TOURNAMENT_STATUS_MAP } from '$lib/constants/tournament';

	let { data } = $props();

	const t = $derived(data.tournament);
	const rulesHtml = $derived(renderMarkdown(t?.rules ?? ''));

	const statItems = $derived(
		t
			? [
					{ icon: Swords, label: '赛制', value: FORMAT_MAP[t.format] ?? t.format },
					{ icon: Users, label: '队伍规模', value: `${t.teamSize ?? '-'} 人` },
					{ icon: CircleDot, label: '局数', value: `BO${t.boCount ?? 1}` },
					{ icon: FileText, label: '状态', value: TOURNAMENT_STATUS_MAP[t.status]?.label ?? t.status },
				]
			: [],
	);

	function fmtDate(d: string | null | undefined): string {
		if (!d) return '';
		try {
			return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>{t?.name ?? '赛事'} — 赛事规则</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 md:px-8 py-8">
	<div class="mb-6 flex items-center justify-between gap-4">
		<BackLink href="/tournaments/{t?.id}">返回赛事详情</BackLink>
		{#if t}
			<a
				href="/tournaments/{t.id}"
				class="inline-flex items-center gap-1.5 text-sm font-black border-2 border-black px-3 py-1.5 bg-white hover:bg-black hover:text-white transition-colors duration-150"
			>
				查看赛事
				<ArrowRight size={14} class="shrink-0" aria-hidden="true" />
			</a>
		{/if}
	</div>

	{#if t}
		<!-- 黑底标题栏 -->
		<div class="relative overflow-hidden bg-black text-white px-4 py-5 mb-6">
			<div class="relative z-10">
				<div class="flex items-center gap-2 mb-1">
					<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
					<span class="text-xs font-black uppercase tracking-widest text-white/60">Tournament Rules</span>
				</div>
				<h1 class="font-black text-2xl md:text-3xl tracking-tight">{t.name}</h1>
				<p class="text-sm text-white/70 mt-1">{FORMAT_MAP[t.format] ?? t.format}{t.startDate ? ` · ${fmtDate(t.startDate)}` : ''}</p>
			</div>
			<span
				class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
				style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
				>Rules</span
			>
		</div>

		<!-- 赛制信息条 -->
		<div class="grid grid-cols-2 md:grid-cols-4 border-l border-t border-black mb-6">
			{#each statItems as item}
				<div class="border-r border-b border-black bg-white px-4 py-3">
					<div class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
						<item.icon size={11} class="shrink-0" aria-hidden="true" />
						{item.label}
					</div>
					<div class="font-black text-sm tracking-tight text-black truncate">{item.value}</div>
				</div>
			{/each}
		</div>

		<!-- 规则正文 -->
		<div class="border border-black bg-white">
			<div class="relative overflow-hidden flex items-center gap-2 px-4 py-3 bg-black text-white">
				<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
				<span class="font-black text-sm tracking-tight relative z-10">赛事规则</span>
				<span class="text-[10px] font-bold text-white/50 ml-auto">官方发布</span>
			</div>
			{#if rulesHtml}
				<div class="p-4 md:p-6 rules-markdown">{@html rulesHtml}</div>
			{:else}
				<EmptyState icon={FileText} title="主办方暂未发布赛事规则" description="规则发布后将在此展示赛制说明、奖品与联系方式" />
			{/if}
		</div>
	{:else}
		<EmptyState title="赛事不存在或已删除" description="请返回赛事列表查看其他赛事" />
	{/if}
</div>
