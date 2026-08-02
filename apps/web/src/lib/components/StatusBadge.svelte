<script lang="ts">
	import { cn } from '$lib/utils';
	import { TOURNAMENT_STATUS_MAP, TEAM_STATUS_MAP, type StatusVariant } from '$lib/constants/tournament';

	interface Props {
		status?: string | null;
		/** 默认按赛事状态映射；传 map 时优先用自定义映射 */
		map?: Record<string, StatusVariant>;
		/** 快捷选择队伍状态映射 */
		kind?: 'tournament' | 'team';
		class?: string;
	}

	let { status, map, kind = 'tournament', class: klass = '' }: Props = $props();

	let variant = $derived(
		(map ?? (kind === 'team' ? TEAM_STATUS_MAP : TOURNAMENT_STATUS_MAP))[status ?? ''],
	);
</script>

{#if variant}
	<span class={cn('px-2 py-0.5 text-xs font-bold shrink-0', variant.variant, klass)}>{variant.label}</span>
{/if}
