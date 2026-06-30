<script lang="ts">
	import { api } from '$lib/api/client';
	import { cn } from '$lib/utils';

	let { data } = $props();

	let activeTab = $state('overview');
	let bracketData = $state<any>(null);
	let standings = $state<any[]>([]);
	let loadingBracket = $state(false);
	let loadingStandings = $state(false);

	const formatMap: Record<string, string> = {
		single_elim: '单败淘汰',
		double_elim: '双败淘汰',
		round_robin: '循环联赛',
		swiss: '瑞士轮',
	};

	const statusMap: Record<string, { label: string; variant: string }> = {
		draft: { label: '未开始', variant: 'bg-neutral-100 text-black' },
		ongoing: { label: '进行中', variant: 'bg-black text-white' },
		completed: { label: '已结束', variant: 'bg-accent text-white' },
	};

	const tabs = [
		{ id: 'overview', label: '总览' },
		{ id: 'bracket', label: '赛程图' },
		{ id: 'standings', label: '积分榜' },
	];

	async function loadBracket() {
		loadingBracket = true;
		try {
			bracketData = await api.get(`/tournaments/${data.tournament.id}/bracket`);
		} catch (e) {
			console.error(e);
		} finally {
			loadingBracket = false;
		}
	}

	async function loadStandings() {
		loadingStandings = true;
		try {
			standings = await api.get(`/tournaments/${data.tournament.id}/standings`);
		} catch (e) {
			console.error(e);
		} finally {
			loadingStandings = false;
		}
	}

	$effect(() => {
		if (activeTab === 'bracket' && !bracketData && !loadingBracket) loadBracket();
		if (activeTab === 'standings' && standings.length === 0 && !loadingStandings) loadStandings();
	});

	const t = $derived(data.tournament);
	const teams = $derived(data.teams);
</script>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
	<div class="mb-6">
		<a href="/" class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150 link-underline">
			← 返回首页
		</a>
	</div>

	{#if t.coverImage ?? t.cover_image}
		<div class="border border-black overflow-hidden mb-6 lift">
			<img src={t.coverImage ?? t.cover_image} alt={t.name} class="w-full h-40 md:h-56 object-cover" />
		</div>
	{/if}

	<div class="flex items-start justify-between mb-6 flex-wrap gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-3 mb-1 flex-wrap">
				<h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
				<span class={cn('px-2 py-0.5 text-xs font-bold', statusMap[t.status]?.variant)}>
					{statusMap[t.status]?.label ?? t.status}
				</span>
			</div>
			<p class="text-sm text-neutral-600">{t.game} · {formatMap[t.format]} · {teams.length}/{t.maxTeams} 队</p>
		</div>
		<a href="/tournaments/{t.id}/bracket"
			class="border border-black bg-black text-white font-bold px-4 py-2 text-sm transition-opacity duration-150 active:opacity-70 press hover:opacity-90 whitespace-nowrap">
			全屏赛程图 →
		</a>
	</div>

	<!-- Tabs -->
	<div class="border-b-2 border-black mb-6">
		<div class="flex gap-0" role="tablist" aria-label="赛事视图切换">
			{#each tabs as tab}
				<button
					role="tab"
					aria-selected={activeTab === tab.id}
					onclick={() => activeTab = tab.id}
					class={cn(
						'px-4 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors duration-150 press',
						activeTab === tab.id
							? 'border-accent text-black bg-neutral-50'
							: 'border-transparent text-neutral-500 hover:text-black'
					)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	{#if activeTab === 'overview'}
		<div class="animate-enter">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-8">
				{#each [{ label: '赛制', value: formatMap[t.format] }, { label: '队伍', value: `${teams.length}/${t.maxTeams}` }, { label: '局数', value: `BO${t.boCount}` }, { label: '状态', value: statusMap[t.status]?.label ?? t.status }] as stat, i}
					<div class="border-r border-b border-black bg-white p-4 lift animate-enter" style="animation-delay:{i * 50}ms">
						<div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{stat.label}</div>
						<div class="font-black text-lg mt-1">{stat.value}</div>
					</div>
				{/each}
			</div>

			{#if teams.length > 0}
				<h2 class="font-black text-lg md:text-xl tracking-tight mb-3">参赛队伍</h2>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black">
					{#each teams as team, i}
						<div class="border-r border-b border-black bg-white px-3 py-2 text-sm flex items-center gap-2 animate-enter" style="animation-delay:{Math.min(i * 30, 300)}ms">
							<span class="text-neutral-500 font-bold tabular-nums">#{i + 1}</span>
							{#if team.logo_emoji}
								<span class="text-lg" aria-hidden="true">{team.logo_emoji}</span>
							{/if}
							<span class="font-bold truncate">{team.name}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if activeTab === 'bracket'}
		<div class="animate-enter">
			{#if loadingBracket}
				<div class="space-y-3">
					{#each Array(4) as _, i}
						<div class="skeleton h-16 w-full" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if bracketData?.stages?.length > 0}
				<div class="overflow-x-auto">
					{#each bracketData.stages as stage}
						<div class="mb-8">
							<h3 class="font-black text-lg md:text-xl tracking-tight mb-4">{stage.name}</h3>
							<div class="flex gap-8">
								{#each stage.rounds as round}
									<div class="flex flex-col gap-2">
										<div class="text-xs text-neutral-500 font-bold mb-1 uppercase tracking-wider">第 {round.round} 轮</div>
										{#each round.matches as match}
											{@const t1Win = match.status === 'completed' && match.team1_score > match.team2_score}
											{@const t2Win = match.status === 'completed' && match.team2_score > match.team1_score}
											<div class="border border-black bg-white min-w-[200px] text-sm overflow-hidden">
												<div class="flex justify-between items-center px-3 py-1.5 {t1Win ? 'bg-black text-white' : ''}">
													<span class="font-bold truncate">{match.team1?.name ?? 'TBD'}</span>
													<span class="font-black tabular-nums ml-2">{match.team1_score ?? 0}</span>
												</div>
												<div class="flex justify-between items-center px-3 py-1.5 {t2Win ? 'bg-black text-white' : ''} border-t border-black/10">
													<span class="font-bold truncate">{match.team2?.name ?? 'TBD'}</span>
													<span class="font-black tabular-nums ml-2">{match.team2_score ?? 0}</span>
												</div>
											</div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-12 text-sm text-neutral-500 border border-black bg-neutral-50">暂无赛程数据</div>
			{/if}
		</div>
	{:else}
		<div class="animate-enter">
			{#if loadingStandings}
				<div class="border border-black">
					{#each Array(5) as _, i}
						<div class="skeleton h-10 w-full border-t border-black/10" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if standings.length > 0}
				<div class="border border-black">
					<table class="w-full text-sm">
						<thead class="bg-black text-white">
							<tr>
								<th class="text-left px-4 py-3 font-bold">#</th>
								<th class="text-left px-4 py-3 font-bold">队伍</th>
								<th class="text-center px-4 py-3 font-bold">胜</th>
								<th class="text-center px-4 py-3 font-bold">负</th>
								<th class="text-center px-4 py-3 font-bold">积分</th>
							</tr>
						</thead>
						<tbody>
							{#each standings as s, i}
								<tr class="border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150 {i === 0 ? 'bg-neutral-50' : ''}">
									<td class="px-4 py-2 font-black tabular-nums">{i + 1}</td>
									<td class="px-4 py-2 font-bold">{s.team?.name ?? '-'}</td>
									<td class="px-4 py-2 text-center tabular-nums">{s.wins}</td>
									<td class="px-4 py-2 text-center tabular-nums">{s.losses}</td>
									<td class="px-4 py-2 text-center font-black tabular-nums">{s.points}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="text-center py-12 text-sm text-neutral-500 border border-black bg-neutral-50">暂无积分数据</div>
			{/if}
		</div>
	{/if}
</div>
