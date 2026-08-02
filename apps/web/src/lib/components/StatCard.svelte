<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		label: string;
		value: number | string;
		accent?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let { label, value, accent = false, class: klass = '', ...rest }: Props = $props();
</script>

<!-- 边框由使用处通过 class 传入（如网格场景传 border-r border-b border-black） -->
<div class={cn('bg-white p-4 md:p-6 lift', klass)} {...rest}>
	<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{label}</div>
	<div class={cn('font-black text-3xl md:text-5xl mt-2 tabular-nums', accent ? 'text-accent' : 'text-black')}>
		{value}
	</div>
</div>
