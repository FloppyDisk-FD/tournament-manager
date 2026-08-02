<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		subtitle?: string;
		/** 右上角英文小标签（水印风格） */
		en?: string;
		class?: string;
		/** 右侧操作区（按钮等） */
		children?: import('svelte').Snippet;
	}

	let { title, subtitle, en, class: klass = '', children }: Props = $props();
</script>

<div class={cn('flex items-baseline justify-between mb-6 flex-wrap gap-2', klass)}>
	<div>
		<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{title}</h1>
		{#if subtitle}
			<p class="text-sm text-neutral-600 mt-1">{subtitle}</p>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		{#if en}
			<span class="text-xs font-bold uppercase tracking-widest text-neutral-500">{en}</span>
		{/if}
		{@render children?.()}
	</div>
</div>
