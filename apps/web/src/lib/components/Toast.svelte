<script lang="ts">
	import { getToasts, dismiss } from '$lib/stores/toast.svelte';
	import { cn } from '$lib/utils';

	const variantMap = {
		success: { box: 'bg-black text-white', icon: 'bg-white text-black', symbol: '✓' },
		error: { box: 'bg-white text-black border-2 border-black', icon: 'bg-black text-white', symbol: '✕' },
		info: { box: 'bg-white text-black border border-black', icon: 'bg-black text-white', symbol: '!' },
	};

	let toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div
		class="fixed top-16 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-80 max-w-[calc(100vw-2rem)]"
		aria-live="polite"
		aria-atomic="true"
	>
		{#each toasts as t (t.id)}
			{@const v = variantMap[t.type]}
			<div
				class={cn(
					'pointer-events-auto relative overflow-hidden font-sans',
					t.leaving ? 'opacity-0 transition-opacity duration-150' : 'animate-enter',
					v.box
				)}
				role={t.type === 'error' ? 'alert' : 'status'}
			>
				<div class="px-4 py-3 flex items-center gap-3">
					<span
						class="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-black {v.icon}"
						aria-hidden="true"
					>
						{v.symbol}
					</span>
					<span class="flex-1 text-sm font-bold leading-snug">{t.message}</span>
					<button
						onclick={() => dismiss(t.id)}
						class="shrink-0 opacity-60 hover:opacity-100 transition-opacity duration-150 px-1 text-sm"
						aria-label="关闭通知"
					>✕</button>
				</div>
				<div class="absolute bottom-0 left-0 right-0 h-0.5 {t.leaving ? 'opacity-0' : ''}">
					<div
						class="toast-progress h-full {t.type === 'success' ? 'bg-white' : 'bg-black'} opacity-30"
						style="animation-duration:{t.duration}ms;"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}
