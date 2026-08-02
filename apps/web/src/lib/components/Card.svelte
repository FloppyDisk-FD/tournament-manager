<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		/** 悬停微位移（lift） */
		hover?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
		[key: string]: unknown;
	}

	let { hover = false, class: klass = '', children, ...rest }: Props = $props();
</script>

<div class={cn('border border-black bg-white', hover && 'lift', klass)} {...rest}>
	{@render children?.()}
</div>
