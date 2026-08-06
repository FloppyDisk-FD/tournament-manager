<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import BackLink from '$lib/components/BackLink.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import TeamHeader from '$lib/components/TeamHeader.svelte';

	let profile = $state<any>(null);
	let loaded = $state(false);

	const teamId = $derived(page.params.id);

	onMount(async () => {
		try {
			profile = await api.get<any>(`/public/teams/${teamId}/profile`);
		} catch { /* ignore */ } finally {
			loaded = true;
		}
	});

	const winRate = $derived.by(() => {
		if (!profile?.stats || profile.stats.played === 0) return null;
		return Math.round((profile.stats.wins / profile.stats.played) * 100);
	});
</script>

<div class="min-h-screen bg-white px-4 md:px-8 py-6 max-w-5xl mx-auto">
	<BackLink href="/teams" class="mb-4 inline-block">← 队伍库</BackLink>

	{#if !loaded}
		<!-- 骨架屏：标题栏 + 内容区 -->
		<div class="mb-6" aria-hidden="true">
			<div class="skeleton h-20 w-full mb-4"></div>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="border border-black bg-white p-4">
					<div class="skeleton h-4 w-24 mb-3"></div>
					<div class="skeleton h-5 w-3/4 mb-2"></div>
					<div class="skeleton h-4 w-1/2"></div>
				</div>
				<div class="border border-black bg-white p-4">
					<div class="skeleton h-4 w-24 mb-3"></div>
					<div class="skeleton h-5 w-2/3 mb-2"></div>
					<div class="skeleton h-4 w-1/3"></div>
				</div>
			</div>
		</div>
	{:else if !profile}
		<div class="border border-black bg-white p-6 text-sm font-bold text-neutral-500">队伍不存在或已被删除</div>
	{:else}
		<!-- 标题栏（公共组件） -->
		<TeamHeader team={profile} showSeed={false} />

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- 战绩统计 -->
			<div class="border border-black bg-white">
				<PanelHeader title="历史战绩" watermark="Record" />
				{#if profile.stats.played === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">暂无已结束的比赛记录</div>
				{:else}
					<div class="grid grid-cols-3 divide-x divide-black border-b border-black">
						<div class="px-4 py-4 text-center">
							<div class="text-2xl font-black tabular-nums">{profile.stats.played}</div>
							<div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">场次</div>
						</div>
						<div class="px-4 py-4 text-center">
							<div class="text-2xl font-black tabular-nums text-black">{profile.stats.wins}</div>
							<div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">胜</div>
						</div>
						<div class="px-4 py-4 text-center">
							<div class="text-2xl font-black tabular-nums text-accent">{profile.stats.losses}</div>
							<div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">负</div>
						</div>
					</div>
					<div class="px-4 py-3 flex items-center justify-between">
						<span class="text-xs font-bold text-neutral-500">胜率</span>
						<span class="text-sm font-black tabular-nums">{winRate}%</span>
					</div>
				{/if}
			</div>

			<!-- 参赛赛事 -->
			<div class="border border-black bg-white">
				<PanelHeader title="参赛赛事" watermark="Events" meta={profile.tournaments.length ? `${profile.tournaments.length} 项` : undefined} />
				{#if profile.tournaments.length === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">尚未参加过赛事</div>
				{:else}
					<ul class="divide-y divide-black">
						{#each profile.tournaments as t}
							<li class="flex items-center justify-between gap-3 px-4 py-2.5">
								<a href="/tournaments/{t.tournamentId}" class="text-sm font-bold hover:text-accent transition-colors duration-150 truncate">{t.tournamentName}</a>
								<div class="flex items-center gap-2 shrink-0">
									<a href="/tournaments/{t.tournamentId}/teams/{teamId}" class="text-[10px] font-bold text-accent border-b border-accent hover:opacity-70 transition-opacity duration-150" title="本赛事内详情（种子/分组/积分）">赛事详情 →</a>
									{#if t.seed != null}
										<span class="text-[10px] font-black border border-black px-1.5 py-0.5 tabular-nums">#{t.seed}</span>
									{/if}
									<span class="text-[10px] font-bold text-neutral-500">{t.status}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 成员 -->
			<div class="border border-black bg-white">
				<PanelHeader title="成员" watermark="Roster" meta={profile.players.length ? `${profile.players.length} 人` : undefined} />
				{#if profile.players.length === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">暂无成员</div>
				{:else}
					<ul class="divide-y divide-black">
						{#each profile.players as p}
							<li class="flex items-center gap-3 px-4 py-2.5">
								{#if p.avatarUrl}
									<img src={p.avatarUrl} alt="" class="w-6 h-6 object-cover border border-black shrink-0" />
								{:else}
									<span class="w-6 h-6 flex items-center justify-center bg-black text-white text-[10px] font-black shrink-0">{p.name?.slice(0, 1) ?? '?'}</span>
								{/if}
								<span class="text-sm font-bold truncate">{p.name}</span>
								{#if p.isCaptain}
									<span class="text-[10px] font-black bg-black text-white px-1.5 py-0.5 shrink-0">队长</span>
								{/if}
								{#if p.role && p.role !== 'player'}
									<span class="text-[10px] font-bold text-neutral-500 shrink-0">{p.role}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- 近期比赛 -->
			<div class="border border-black bg-white">
				<PanelHeader title="近期比赛" watermark="Matches" />
				{#if profile.recent.length === 0}
					<div class="px-4 py-8 text-center text-sm font-bold text-neutral-400">暂无近期比赛</div>
				{:else}
					<ul class="divide-y divide-black">
						{#each profile.recent as m}
							<li class="flex items-center justify-between gap-3 px-4 py-2.5">
								<div class="min-w-0">
									<div class="text-[10px] font-bold text-neutral-500 truncate">{m.tournamentName}</div>
									{#if m.opponentId}
										<a href="/teams/{m.opponentId}" class="text-sm font-bold hover:text-accent transition-colors duration-150 truncate block">vs {m.opponentName ?? '对手'}</a>
									{:else}
										<span class="text-sm font-bold text-neutral-400 truncate block">vs 轮空</span>
									{/if}
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="text-sm font-black tabular-nums">{m.myScore ?? '-'} : {m.oppScore ?? '-'}</span>
									<span class="text-[10px] font-black px-1.5 py-0.5 {m.won ? 'bg-black text-white' : 'bg-accent text-white'}">{m.won ? '胜' : '负'}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>
