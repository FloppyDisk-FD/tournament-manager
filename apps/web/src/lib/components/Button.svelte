<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		href?: string;
		/** 按钮文字对应的英文，作为 hover 时的暗纹水印 */
		en?: string;
		size?: 'md' | 'sm';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (e: MouseEvent) => void;
		class?: string;
		children?: import('svelte').Snippet;
		[key: string]: unknown;
	}

	let {
		href,
		en = '',
		size = 'md',
		disabled = false,
		type = 'button',
		onclick,
		class: klass = '',
		children,
		...rest
	}: Props = $props();

	const base = cn(
		'group relative inline-flex items-center gap-2 overflow-hidden bg-black text-white font-bold transition-colors duration-150 active:opacity-70 press hover:bg-accent disabled:opacity-50 disabled:active:scale-100',
		size === 'md' ? 'px-5 py-2.5 text-sm' : 'px-3 py-1 text-xs'
	);

	const watermark = cn(
		'pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15 opacity-0 translate-x-3 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100',
		size === 'md' ? 'text-5xl leading-none' : 'text-2xl leading-none'
	);
</script>

{#if href}
	<a {href} class={cn(base, klass)} {...rest}>
		<span class="relative z-10 flex items-center gap-2 transition-transform duration-150 group-hover:translate-x-1">{@render children?.()}</span>
		{#if en}
			<span class={watermark}>{en}</span>
		{/if}
	</a>
{:else}
	<button {type} {disabled} {onclick} class={cn(base, klass)} {...rest}>
		<span class="relative z-10 flex items-center gap-2 transition-transform duration-150 group-hover:translate-x-1">{@render children?.()}</span>
		{#if en}
			<span class={watermark}>{en}</span>
		{/if}
	</button>
{/if}
