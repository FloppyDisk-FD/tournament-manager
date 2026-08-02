<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		/** lucide 图标组件（32px 浅灰） */
		icon?: any;
		title?: string;
		description?: string;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { icon: Icon, title, description, class: klass = '', children }: Props = $props();
</script>

<div class={cn('text-center py-12 border border-black bg-white', klass)}>
	{#if Icon}
		<Icon size={32} strokeWidth={1.5} class="mx-auto text-neutral-300 mb-3" aria-hidden="true" />
	{/if}
	{#if title}
		<p class="text-sm text-neutral-500 font-bold">{title}</p>
	{/if}
	{#if description}
		<p class="text-xs text-neutral-400 mt-1">{description}</p>
	{/if}
	{@render children?.()}
</div>
