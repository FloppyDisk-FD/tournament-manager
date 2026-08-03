<script lang="ts">
  import { cn } from '$lib/utils';
  import BackLink from '$lib/components/BackLink.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { PLAYER_ROLE_MAP } from '$lib/constants/tournament';

  let { data } = $props();

  // Tab 状态
  let activeTab = $state<'players' | 'matches' | 'standings'>('players');

  // 派生数据
  const t = $derived(data.team);
  const matches = $derived(data.matches);
  const standing = $derived(data.standing);

  // 统计
  const wins = $derived(matches.filter((m: any) => m.status === 'completed' && isWin(m, data.teamId)).length);
  const losses = $derived(matches.filter((m: any) => m.status === 'completed' && !isWin(m, data.teamId) && m.team1 && m.team2).length);
  const totalMatches = $derived(matches.length);
  const completedMatches = $derived(matches.filter((m: any) => m.status === 'completed').length);

  function isWin(match: any, teamId: string): boolean {
    if (match.status !== 'completed') return false;
    const isTeam1 = match.team1?.id === teamId;
    const isTeam2 = match.team2?.id === teamId;
    if (isTeam1) return (match.team1_score ?? 0) > (match.team2_score ?? 0);
    if (isTeam2) return (match.team2_score ?? 0) > (match.team1_score ?? 0);
    return false;
  }

  const tabs = [
    { id: 'players' as const, label: '参赛选手' },
    { id: 'matches' as const, label: '比赛记录' },
    { id: 'standings' as const, label: '积分排名' },
  ];
</script>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
  <!-- 返回链接 -->
  <div class="mb-6">
    <BackLink href="/tournaments/{data.tournamentId}">← 返回赛事</BackLink>
  </div>

  {#if !t}
    <!-- 队伍不存在 -->
    <div class="text-center py-16 border border-black bg-neutral-50">
      <p class="font-black text-lg text-black">未找到该队伍</p>
      <p class="text-sm text-neutral-500 mt-1">队伍可能已被移出赛事</p>
    </div>
  {:else}
    <!-- 队伍头部 -->
    <div class="flex items-start gap-4 mb-8 flex-wrap">
      <div class="flex items-center gap-4 min-w-0 flex-1">
        {#if t.logo_url}
          <img src={t.logo_url} alt={t.name} width={80} height={80} class="w-16 h-16 md:w-20 md:h-20 object-contain border border-black" />
        {:else}
          <div class="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center border border-black bg-white text-4xl">
            {t.logo_emoji}
          </div>
        {/if}
        <div class="min-w-0">
          <div class="flex items-center gap-3 mb-1 flex-wrap">
            <h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
            <StatusBadge status={t.status ?? 'active'} kind="team" />
          </div>
          {#if t.seed}
            <p class="text-sm text-neutral-600">种子 #{t.seed}{#if t.group_label} · 分组 {t.group_label}{/if}</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- 统计网格 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-0 border-l border-t border-black mb-8">
      {#each [
        { label: '比赛', value: `${completedMatches}/${totalMatches}` },
        { label: '胜', value: wins },
        { label: '负', value: losses },
        { label: '排名', value: standing ? `#${standing.rank}` : '—' },
      ] as stat, i}
        <div class="border-r border-b border-black bg-white p-4 lift animate-enter" style="animation-delay:{i * 60}ms">
          <div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{stat.label}</div>
          <div class="font-black text-lg mt-1 tabular-nums">{stat.value}</div>
        </div>
      {/each}
    </div>

    <!-- Tab 切换 -->
    <div class="border-b-2 border-black mb-6">
      <div class="flex gap-0" role="tablist" aria-label="队伍视图切换">
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

    <!-- 选手名单 -->
    {#if activeTab === 'players'}
      <div class="animate-enter">
        {#if t.players.length > 0}
          <div class="border border-black overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-black text-white">
                <tr>
                  <th class="text-left px-4 py-3 font-bold w-12">#</th>
                  <th class="text-left px-4 py-3 font-bold">选手</th>
                  <th class="text-left px-4 py-3 font-bold hidden md:table-cell">游戏 ID</th>
                  <th class="text-left px-4 py-3 font-bold">角色</th>
                </tr>
              </thead>
              <tbody>
                {#each t.players as p, i}
                  <tr class="border-t border-black/20 hover:bg-neutral-50 transition-colors duration-150">
                    <td class="px-4 py-3 text-neutral-500 font-bold tabular-nums">{i + 1}</td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 shrink-0 border border-black bg-neutral-100 overflow-hidden flex items-center justify-center">
                          {#if p.avatar_url}
                            <img src={p.avatar_url} alt={p.player_name || '选手'} class="w-full h-full object-cover" width="32" height="32" />
                          {:else}
                            <span class="text-[9px] text-neutral-400 font-bold">无</span>
                          {/if}
                        </div>
                        <span class="font-bold">{p.player_name}</span>
                        {#if p.is_captain}
                          <span class="text-xs font-bold text-accent border border-accent px-1">C</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-neutral-600 hidden md:table-cell font-mono text-xs">{p.game_id || '—'}</td>
                    <td class="px-4 py-3 text-neutral-600">{PLAYER_ROLE_MAP[p.player_role] ?? p.player_role}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center py-12 text-sm text-neutral-500 border border-black bg-neutral-50">暂无选手数据</div>
        {/if}
      </div>
    {:else if activeTab === 'matches'}
      <!-- 比赛记录 -->
      <div class="animate-enter">
        {#if matches.length > 0}
          <div class="space-y-3">
            {#each matches as m, i}
              {@const isTeam1 = m.team1?.id === data.teamId}
              {@const opponent = isTeam1 ? m.team2 : m.team1}
              {@const myScore = isTeam1 ? m.team1_score : m.team2_score}
              {@const oppScore = isTeam1 ? m.team2_score : m.team1_score}
              {@const won = m.status === 'completed' && myScore > oppScore}
              {@const lost = m.status === 'completed' && myScore < oppScore}
              <div
                class="border border-black bg-white px-4 py-3 flex items-center gap-4 lift animate-enter"
                style="animation-delay:{Math.min(i * 40, 400)}ms"
              >
                <!-- 结果指示 -->
                <div class={cn(
                  'w-1 self-stretch',
                  won ? 'bg-black' : lost ? 'bg-accent' : 'bg-neutral-200'
                )}></div>

                <!-- 轮次 -->
                <div class="text-xs text-neutral-500 font-bold uppercase tracking-wider w-24 md:w-32 shrink-0">
                  {m.stageName}<br class="md:hidden" /> R{m.round}
                </div>

                <!-- 对手 -->
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  {#if opponent?.logo_url}
                    <img src={opponent.logo_url} alt={opponent.name} width={20} height={20} class="w-5 h-5 object-contain shrink-0" />
                  {:else if opponent?.logo_emoji}
                    <span class="text-lg shrink-0" aria-hidden="true">{opponent.logo_emoji}</span>
                  {/if}
                  <span class="font-bold truncate">{opponent?.name ?? 'TBD'}</span>
                </div>

                <!-- 比分 -->
                <div class="flex items-center gap-2 shrink-0">
                  {#if m.status === 'completed'}
                    <span class={cn('font-black tabular-nums text-lg', won ? 'text-black' : 'text-neutral-400')}>{myScore ?? 0}</span>
                    <span class="text-neutral-300">:</span>
                    <span class={cn('font-black tabular-nums text-lg', lost ? 'text-black' : 'text-neutral-400')}>{oppScore ?? 0}</span>
                  {:else}
                    <span class="text-xs text-neutral-400 font-bold">未开始</span>
                  {/if}
                </div>

                <!-- 状态 -->
                <div class="shrink-0 hidden md:block">
                  {#if won}
                    <span class="text-xs font-bold text-black">胜</span>
                  {:else if lost}
                    <span class="text-xs font-bold text-accent">负</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-12 text-sm text-neutral-500 border border-black bg-neutral-50">暂无比赛记录</div>
        {/if}
      </div>
    {:else}
      <!-- 积分排名 -->
      <div class="animate-enter">
        {#if standing}
          <div class="grid grid-cols-2 md:grid-cols-3 gap-0 border-l border-t border-black mb-6">
            {#each [
              { label: '排名', value: `#${standing.rank}` },
              { label: '积分', value: standing.points },
              { label: '胜', value: standing.wins },
              { label: '负', value: standing.losses },
              { label: '平', value: standing.draws ?? 0 },
              { label: '胜场差', value: standing.game_difference ?? '—' },
            ] as stat, i}
              <div class="border-r border-b border-black bg-white p-4 animate-enter" style="animation-delay:{i * 40}ms">
                <div class="text-xs text-neutral-500 font-bold uppercase tracking-wider">{stat.label}</div>
                <div class="font-black text-lg mt-1 tabular-nums">{stat.value}</div>
              </div>
            {/each}
          </div>
          <p class="text-xs text-neutral-500">已打 {standing.round_played ?? 0} 轮</p>
        {:else}
          <div class="text-center py-12 text-sm text-neutral-500 border border-black bg-neutral-50">
            暂无积分数据
            <p class="mt-1 text-xs">该赛事可能未使用循环赛或瑞士轮赛制</p>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
