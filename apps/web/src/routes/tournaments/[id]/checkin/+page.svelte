<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import { getUser } from '$lib/stores/auth.svelte';
	import TeamCheckinList from '$lib/components/TeamCheckinList.svelte';

	let tournament = $state<any>(null);
	let myTeams = $state<any[]>([]);
	let loaded = $state(false);

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
				<TeamCheckinList tournamentId={tid ?? ''} teams={myTeams} />
			{/if}
		</div>
	</div>
</div>
