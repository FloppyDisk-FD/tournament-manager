<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		href?: string;
		class?: string;
		children?: import('svelte').Snippet;
		[key: string]: unknown;
	}

	let { href, class: klass = '', children, ...rest }: Props = $props();

	const cls = cn(
		'text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150',
		klass,
	);
</script>

{#if href}
	<a {href} class={cls} {...rest}>
		{#if children}
			{@render children()}
		{:else}
			← 返回
		{/if}
	</a>
{:else}
	<button type="button" class={cls} {...rest}>
		{#if children}
			{@render children()}
		{:else}
			← 返回
		{/if}
	</button>
{/if}
