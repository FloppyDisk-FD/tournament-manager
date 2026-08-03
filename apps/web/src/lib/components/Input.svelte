<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value?: any;
		type?: string;
		placeholder?: string;
		class?: string;
		[key: string]: unknown;
	}

	let { value = $bindable(''), type = 'text', placeholder, class: klass = '', ...rest }: Props = $props();
</script>

<input
	{type}
	{placeholder}
	bind:value
	class={cn('w-full border border-black font-sans px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-accent', klass)}
	{...rest}
/>
