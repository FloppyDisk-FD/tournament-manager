<script lang="ts">
	import { cn } from '$lib/utils';

	/**
	 * 黑底渐变水印大标题栏（发现页 / 归档页 / 队伍库 / 仪表盘等共用）。
	 * - title：主标题
	 * - en：右上角大号渐变英文水印（渐隐到黑底）
	 * - badge：标题上方小红点 + 小字标签（如 "Discover"）
	 * - subtitle：标题下方灰色说明
	 */
	interface Props {
		title: string;
		en?: string;
		badge?: string;
		subtitle?: string;
		class?: string;
	}

	let { title, en, badge, subtitle, class: klass = '' }: Props = $props();
</script>

<div class={cn('relative overflow-hidden bg-black text-white px-4 py-5 mb-6', klass)}>
	<div class="relative z-10">
		{#if badge}
			<div class="flex items-center gap-2 mb-1">
				<span class="inline-block w-1 h-1 bg-accent" aria-hidden="true"></span>
				<span class="text-xs font-black uppercase tracking-widest text-white/60">{badge}</span>
			</div>
		{/if}
		<h1 class="font-black text-2xl md:text-3xl tracking-tight">{title}</h1>
		{#if subtitle}
			<p class="text-sm text-white/70 mt-1">{subtitle}</p>
		{/if}
	</div>
	{#if en}
		<span
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-5xl md:text-6xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
			style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
		>{en}</span>
	{/if}
</div>
