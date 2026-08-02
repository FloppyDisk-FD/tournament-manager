<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		children?: import('svelte').Snippet;
		[key: string]: unknown;
	}

	let { class: klass = '', children, ...rest }: Props = $props();
</script>

<label class={cn('block text-sm font-bold text-black mb-1', klass)} {...rest}>
	{@render children?.()}
</label>
