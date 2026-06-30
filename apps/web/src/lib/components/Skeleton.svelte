<script lang="ts" module>
	// 预设骨架组合
	export type SkeletonPreset =
		| 'tournament-card'
		| 'match-row'
		| 'stat-cell'
		| 'text'
		| 'block';
</script>

<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		preset = 'block',
		class: klass = '',
		width,
		height,
	}: {
		preset?: SkeletonPreset;
		class?: string;
		width?: string;
		height?: string;
	} = $props();

	const style = $derived(
		[width ? `width:${width}` : '', height ? `height:${height}` : '']
			.filter(Boolean)
			.join(';')
	);
</script>

{#if preset === 'tournament-card'}
	<div class="border-r border-b border-black bg-white" aria-hidden="true">
		<div class="skeleton h-32 border-b border-black"></div>
		<div class="p-4 md:p-6 space-y-3">
			<div class="flex gap-2">
				<div class="skeleton h-5 w-16"></div>
				<div class="skeleton h-5 w-20"></div>
			</div>
			<div class="skeleton h-6 w-3/4"></div>
			<div class="skeleton h-4 w-1/2"></div>
			<div class="skeleton h-4 w-24 mt-4"></div>
		</div>
	</div>
{:else if preset === 'match-row'}
	<div class="border border-black bg-white p-4" aria-hidden="true">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4 flex-1">
				<div class="skeleton h-4 flex-1"></div>
				<div class="skeleton h-8 w-16"></div>
				<div class="skeleton h-4 flex-1"></div>
			</div>
			<div class="skeleton h-8 w-24 ml-4"></div>
		</div>
	</div>
{:else if preset === 'stat-cell'}
	<div class="border-r border-b border-black bg-white p-4 md:p-6" aria-hidden="true">
		<div class="skeleton h-3 w-16 mb-2"></div>
		<div class="skeleton h-9 w-12"></div>
	</div>
{:else if preset === 'text'}
	<div class={cn('skeleton h-4', klass)} style={style} aria-hidden="true"></div>
{:else}
	<div class={cn('skeleton', klass)} style={style} aria-hidden="true"></div>
{/if}
