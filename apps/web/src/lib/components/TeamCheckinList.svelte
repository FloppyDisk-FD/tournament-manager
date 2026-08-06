<script lang="ts">
	import { api } from '$lib/api/client';
	import { success, error } from '$lib/stores/toast.svelte';

	/**
	 * 队长自助签到列表（赛事详情页 + /checkin 扫码页共用）。
	 * - tournamentId：赛事 id
	 * - teams：我的参赛队伍（兼容 id / teamId、logo_emoji / logoEmoji 字段）
	 * - 初始 checkedIn 状态由 teams 数据自带（/checkins/mine 返回 checkedIn 字段）；
	 *   详情页传入的本地队伍无该字段时由组件维护状态
	 */
	interface Props {
		tournamentId: string;
		teams: any[];
	}

	let { tournamentId, teams }: Props = $props();

	let checking = $state<string | null>(null);
	// 本地状态：仅当队伍无 checkedIn 字段时用于维护（详情页场景）
	let localState = $state<Record<string, boolean>>({});

	function teamIdOf(t: any): string {
		return t?.teamId ?? t?.id ?? '';
	}
	function logoEmojiOf(t: any): string {
		return t?.logo_emoji ?? t?.logoEmoji ?? '🏆';
	}
	function isChecked(t: any): boolean {
		if (typeof t?.checkedIn === 'boolean') return t.checkedIn;
		return !!localState[teamIdOf(t)];
	}

	async function doCheckin(t: any) {
		const id = teamIdOf(t);
		if (!id) return;
		checking = id;
		try {
			const res = await api.post<{ checkedIn: boolean }>(`/tournaments/${tournamentId}/checkins/self/${id}`);
			// 无 checkedIn 字段的队伍（详情页本地数据）→ 维护组件内状态
			if (typeof t?.checkedIn !== 'boolean') {
				localState[id] = res.checkedIn;
			} else {
				t.checkedIn = res.checkedIn;
			}
			success(res.checkedIn ? '签到成功' : '已取消签到');
		} catch (e: any) {
			error(e.message || '签到失败');
		} finally {
			checking = null;
		}
	}
</script>

<div class="space-y-2">
	{#each teams as t (teamIdOf(t))}
		<div class="flex items-center justify-between gap-3 border border-black px-3 py-2 flex-wrap">
			<div class="flex items-center gap-2 min-w-0">
				<span class="shrink-0 text-lg" aria-hidden="true">{logoEmojiOf(t)}</span>
				<span class="text-sm font-black truncate">{t.name}</span>
				{#if isChecked(t)}
					<span class="text-xs font-bold text-accent shrink-0">已签到</span>
				{/if}
			</div>
			<button
				onclick={() => doCheckin(t)}
				disabled={checking === teamIdOf(t)}
				class="rounded-none font-sans font-bold border border-black px-3 py-1 text-xs transition-colors duration-150 active:opacity-70 disabled:opacity-50 {isChecked(t)
					? 'bg-white text-accent hover:bg-neutral-100'
					: 'bg-black text-white hover:bg-neutral-800'}"
			>
				{checking === teamIdOf(t) ? '处理中...' : (isChecked(t) ? '取消签到' : '我队签到')}
			</button>
		</div>
	{/each}
</div>
