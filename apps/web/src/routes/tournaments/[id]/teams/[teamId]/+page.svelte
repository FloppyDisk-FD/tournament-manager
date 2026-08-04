<script lang="ts">
  import { cn } from '$lib/utils';
  import BackLink from '$lib/components/BackLink.svelte';
  import { Star } from 'lucide-svelte';
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
    <div class="relative overflow-hidden bg-black text-white px-4 py-4 mb-6">
      <div class="flex items-center gap-4 relative z-10 flex-wrap">
        {#if t.logo_url}
          <img src={t.logo_url} alt={t.name} width={64} height={64} class="w-14 h-14 md:w-16 md:h-16 object-contain bg-white p-1 border border-white/30 shrink-0" />
        {:else if t.logo_emoji}
          <div class="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center border border-white/30 bg-white/10 text-3xl shrink-0">
            {t.logo_emoji}
          </div>
        {/if}
        <div class="min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="font-black text-xl md:text-2xl tracking-tight text-white">{t.name}</h1>
            {#if t.status}
              <span class="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/40 px-2 py-0.5">
                <span class="w-1.5 h-1.5 bg-accent"></span>
                {t.status === 'active' ? '活跃' : t.status === 'eliminated' ? '已淘汰' : t.status === 'withdrawn' ? '已退出' : t.status}
              </span>
            {/if}
          </div>
          {#if t.seed || t.group_label}
            <div class="text-xs font-bold text-white/60 mt-1">
              种子 #{t.seed}{#if t.seed && t.group_label} · {/if}{#if t.group_label}分组 {t.group_label}{/if}
            </div>
          {/if}
        </div>
      </div>
      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-4xl md:text-5xl leading-none font-black uppercase tracking-widest whitespace-nowrap select-none text-white/10" style="-webkit-mask-image: linear-gradient(to left, black, transparent); mask-image: linear-gradient(to left, black, transparent)" aria-hidden="true">TEAM</span>
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
                        <div class="w-8 h-8 shrink-0 border border-black bg-black overflow-hidden flex items-center justify-center">
                          {#if p.avatar_url}
                            <img src={p.avatar_url} alt={p.player_name || '选手'} class="w-full h-full object-cover" width="32" height="32" />
                          {:else}
                            <span class="text-[11px] font-black text-white">{p.player_name?.slice(0, 1)?.toUpperCase() || '?'}</span>
                          {/if}
                        </div>
                        <span class="font-bold">{p.player_name}</span>
                        {#if p.is_captain}
                          <span class="inline-flex items-center gap-1 text-[10px] font-black bg-black text-white px-1.5 py-0.5">
                            <Star size={10} class="text-accent" aria-hidden="true" />
                            队长
                          </span>
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
          <div class="text-center py-12 text-sm font-bold text-neutral-400 border border-black bg-white">暂无选手数据</div>
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
          <div class="text-center py-12 text-sm font-bold text-neutral-400 border border-black bg-white">暂无比赛记录</div>
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
          <div class="text-center py-12 text-sm font-bold text-neutral-400 border border-black bg-white">
            暂无积分数据
            <p class="mt-1 text-xs font-bold text-neutral-400">该赛事可能未使用循环赛或瑞士轮赛制</p>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
