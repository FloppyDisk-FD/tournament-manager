<script lang="ts">
	interface Props {
		/** 标题文字 */
		title: string;
		/** 英文渐变水印（如 Seeding / Review / Check-in） */
		watermark: string;
		/** 红色数量徽标（0 或空不显示） */
		badge?: number;
		/** 标题旁次要文本（如签到计数 2/4） */
		meta?: string;
		/** 右侧操作区 */
		right?: import('svelte').Snippet;
	}

	let { title, watermark, badge, meta, right }: Props = $props();
</script>

<div class="relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 bg-black text-white">
	<div class="flex items-center gap-2 relative z-10 min-w-0">
		<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
		<span class="font-black text-base tracking-tight truncate">{title}</span>
		{#if badge && badge > 0}
			<span class="text-xs font-black bg-accent text-white px-1.5 py-0.5 shrink-0">{badge}</span>
		{/if}
		{#if meta}
			<span class="text-xs font-black text-white/70 shrink-0">{meta}</span>
		{/if}
	</div>
	{#if right}
		<div class="relative z-10 flex items-center gap-3 shrink-0">
			{@render right()}
		</div>
	{/if}
	<span
		class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl md:text-5xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
		style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)"
	>{watermark}</span>
</div>
