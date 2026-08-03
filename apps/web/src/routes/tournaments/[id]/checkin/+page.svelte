<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import { getUser } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import { success, error } from '$lib/stores/toast.svelte';

	let tournament = $state<any>(null);
	let myTeams = $state<any[]>([]);
	let loaded = $state(false);
	let checking = $state<string | null>(null);

	const tid = $derived(page.params.id);

	onMount(async () => {
		try {
			const [t, teams] = await Promise.all([
				api.get<any>(`/tournaments/${tid}`),
				getUser() ? api.get<any[]>(`/tournaments/${tid}/checkins/mine`) : Promise.resolve([]),
			]);
			tournament = t;
			myTeams = Array.isArray(teams) ? teams : [];
		} catch { /* ignore */ } finally {
			loaded = true;
		}
	});

	async function doCheckin(teamId: string) {
		checking = teamId;
		try {
			const res = await api.post<{ checkedIn: boolean }>(`/tournaments/${tid}/checkins/self/${teamId}`);
			const idx = myTeams.findIndex((t) => t.teamId === teamId);
			if (idx >= 0) myTeams[idx] = { ...myTeams[idx], checkedIn: res.checkedIn };
			success(res.checkedIn ? '签到成功' : '已取消签到');
		} catch (e: any) {
			error(e.message || '签到失败');
		} finally {
			checking = null;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4 md:px-8">
	<div class="w-full max-w-md">
		<div class="border-2 border-black bg-white p-6 md:p-8">
			<div class="relative overflow-hidden flex items-center justify-between px-4 py-3 bg-black text-white -mx-6 -mt-6 md:-mx-8 md:-mt-8 mb-6">
				<div class="flex items-center gap-2 relative z-10">
					<span class="inline-block w-1 h-1 bg-accent shrink-0" aria-hidden="true"></span>
					<span class="font-black text-base tracking-tight">队伍签到</span>
				</div>
				<span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-4xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/15"
					style="-webkit-mask-image: linear-gradient(to right, transparent, black); mask-image: linear-gradient(to right, transparent, black)">Check-in</span>
			</div>

			{#if !loaded}
				<div class="skeleton h-16 w-full" aria-hidden="true"></div>
			{:else if !tournament}
				<p class="text-sm text-neutral-500 font-bold text-center py-4">赛事不存在</p>
			{:else if !getUser()}
				<div class="border border-black bg-neutral-50 p-4 text-center">
					<p class="text-sm text-neutral-500 font-bold mb-3">《{tournament.name}》签到前请先登录</p>
					<a href="/login?redirect=/tournaments/{tid}/checkin"
						class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150">去登录</a>
				</div>
			{:else if myTeams.length === 0}
				<div class="border border-black bg-neutral-50 p-4 text-center">
					<p class="text-sm text-neutral-500 font-bold">你没有参加《{tournament.name}》的队伍</p>
				</div>
			{:else}
				<p class="text-sm text-neutral-500 font-bold mb-3">《{tournament.name}》— 选择你的队伍签到</p>
				<div class="space-y-2">
					{#each myTeams as t (t.teamId)}
						<div class="border border-black bg-white px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
							<div class="flex items-center gap-2 min-w-0">
								<span class="shrink-0 text-lg">{t.logoEmoji || '🏆'}</span>
								<span class="text-sm font-black truncate">{t.name}</span>
								{#if t.checkedIn}
									<span class="text-xs font-bold text-accent shrink-0">已签到</span>
								{/if}
							</div>
							<button
								onclick={() => doCheckin(t.teamId)}
								disabled={checking === t.teamId}
								class="rounded-none font-sans font-bold border border-black px-3 py-1 text-xs transition-colors duration-150 active:opacity-70 disabled:opacity-50 {t.checkedIn
									? 'bg-white text-accent hover:bg-neutral-100'
									: 'bg-black text-white hover:bg-neutral-800'}"
							>
								{checking === t.teamId ? '处理中...' : (t.checkedIn ? '取消签到' : '我队签到')}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
