<script lang="ts">
	import { cn } from '$lib/utils';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		value?: any;
		options?: Option[];
		class?: string;
		[key: string]: unknown;
	}

	let { value = $bindable(''), options = [], class: klass = '', ...rest }: Props = $props();
</script>

<select
	bind:value
	class={cn('w-full border border-black font-sans px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-accent', klass)}
	{...rest}
>
	{#each options as opt}
		<option value={opt.value}>{opt.label}</option>
	{/each}
</select>
