<script lang="ts">
	import { cn } from '$lib/utils';
	import { FORMAT_MAP } from '$lib/constants/tournament';
	import { ArrowRight, Trophy, Users } from 'lucide-svelte';

	/**
	 * 公开赛事卡片（首页 / 发现页共用）。
	 * variant:
	 * - 'home'：首页列表风格（封面可选，内容区信息密度高）
	 * - 'discover'：发现页风格（封面必有 fallback，右上角报名费角标）
	 */
	interface Props {
		tournament: any;
		variant?: 'home' | 'discover';
		/** 入场动画延迟（ms） */
		delay?: number;
		class?: string;
	}

	let { tournament: t, variant = 'home', delay = 0, class: klass = '' }: Props = $props();

	const coverUrl = $derived(t.coverImage ?? t.cover_image ?? null);
	const fee = $derived((t.entryFee ?? 0) > 0 ? `报名费 ¥${t.entryFee}` : null);

	function statusLabel(s: string | null | undefined): string {
		if (!s) return '';
		return s === 'draft' ? '报名中' : s === 'ongoing' ? '进行中' : s === 'completed' ? '已结束' : s === 'cancelled' ? '已取消' : s;
	}
</script>

{#if variant === 'home'}
	<a
		href="/tournaments/{t.id}"
		class={cn('block border-r border-b border-black bg-white hover:bg-neutral-50 transition-colors duration-150 group animate-enter lift flex flex-col', klass)}
		style={delay ? `animation-delay:${Math.min(delay, 320)}ms` : undefined}
	>
		{#if coverUrl}
			<div class="h-32 overflow-hidden border-b border-black">
				<img src={coverUrl} alt={t.name} class="w-full h-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
			</div>
		{/if}
		<div class="p-4 md:p-6 flex-1 flex flex-col">
			<div class="flex items-center gap-2 mb-3">
				<span class="text-[10px] font-black px-1.5 py-0.5 border border-black {t.status === 'ongoing' ? 'bg-black text-white' : t.status === 'completed' ? 'bg-accent text-white' : t.status === 'cancelled' ? 'bg-neutral-100 text-neutral-500 line-through' : 'bg-neutral-100 text-black'}">{statusLabel(t.status)}</span>
				<span class="text-xs text-neutral-500 font-bold">{FORMAT_MAP[t.format] ?? t.format}</span>
				{#if fee}
					<span class="ml-auto text-[10px] font-black bg-neutral-100 border border-black px-1.5 py-0.5 shrink-0">{fee}</span>
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
{:else}
	<a
		href="/tournaments/{t.id}"
		class={cn('border-2 border-black bg-white flex flex-col hover:bg-neutral-50 transition-colors duration-150 group', klass)}
	>
		<div class="relative h-36 overflow-hidden border-b-2 border-black bg-neutral-100">
			{#if coverUrl}
				<img src={coverUrl} alt={t.name} loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
			{:else}
				<div class="w-full h-full flex items-center justify-center">
					<Trophy size={36} class="text-neutral-300" aria-hidden="true" />
				</div>
			{/if}
			<span class="absolute top-2 left-2 text-[10px] font-black bg-black text-white px-1.5 py-0.5">{statusLabel(t.status)}</span>
			{#if fee}
				<span class="absolute top-2 right-2 text-[10px] font-black bg-accent text-white px-1.5 py-0.5">{fee}</span>
			{/if}
		</div>
		<div class="p-3 flex flex-col flex-1">
			<div class="font-black text-base tracking-tight truncate">{t.name}</div>
			<div class="flex items-center gap-2 mt-1 text-xs text-neutral-500 font-bold">
				<span class="truncate">{t.game ?? '综合'}</span>
				<span class="shrink-0">· {FORMAT_MAP[t.format] ?? t.format}</span>
			</div>
			<div class="flex items-center gap-3 mt-auto pt-3 text-xs text-neutral-600 font-bold">
				<span class="inline-flex items-center gap-1"><Users size={12} class="shrink-0" aria-hidden="true" />{t.maxTeams ?? '—'} 队</span>
				<span class="inline-flex items-center gap-1 ml-auto text-black font-black group-hover:text-accent transition-colors duration-150">查看详情 <ArrowRight size={12} class="shrink-0" /></span>
			</div>
		</div>
	</a>
{/if}
