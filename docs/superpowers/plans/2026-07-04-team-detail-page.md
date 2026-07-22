# 队伍详情页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/tournaments/[id]/teams/[teamId]` 公开页面，展示队伍在某赛事中的完整档案：基本信息、选手名单、比赛记录、积分排名。

**Architecture:** SvelteKit 约定式路由 + `+page.ts` SSR 数据加载。复用现有 3 个公开 API（`/tournaments/:id/teams`、`/bracket`、`/standings`），前端 filter 出目标队伍数据。零后端改动。UI 严格遵循 Swiss International Style（黑边直角、Helvetica、红色 accent、`gap-0` 网格），加入精致入场动效。

**Tech Stack:** SvelteKit 2 + Svelte 5 runes ($state/$derived/$effect/$props) + Tailwind CSS v4 + TypeScript

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/src/lib/utils/normalize.ts` | 新建 | 共享 `normalizeTeam` / `normalizePlayer` 函数，消除重复的 `??` 双兜底 |
| `apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.ts` | 新建 | SSR 加载：调 3 个 API，filter 出队伍信息/比赛/积分，normalize 后返回 |
| `apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.svelte` | 新建 | 队伍详情页 UI：头部 + Tab（选手/比赛/积分） |
| `apps/web/src/routes/tournaments/[id]/+page.svelte` | 修改 | 队伍 grid 项包裹 `<a>` 链接跳转到详情页 |

---

## Task 1: 抽取共享 normalizeTeam 到 $lib

**Files:**
- Create: `apps/web/src/lib/utils/normalize.ts`

**背景**：`normalizeTeam` 当前在 `admin/teams/+page.svelte:42` 和 `admin/teams/+page.ts:6` 重复，新详情页也需要它。抽到 `$lib` 消除重复（DRY）。

- [ ] **Step 1: 创建 normalize.ts**

```typescript
// apps/web/src/lib/utils/normalize.ts

export interface NormalizedPlayer {
  player_name: string;
  player_role: string;
  game_id: string;
  avatar_emoji: string;
  is_captain: boolean;
}

export interface NormalizedTeam {
  id: string;
  name: string;
  logo_emoji: string;
  logo_url?: string;
  seed?: number | null;
  status?: string;
  group_label?: string | null;
  players: NormalizedPlayer[];
}

/**
 * 后端返回字段命名混合（全局队伍库 camelCase，赛事内队伍 snake_case）。
 * 统一 normalize 为 snake_case，消除 svelte 模板里的 `??` 双兜底。
 */
export function normalizeTeam(t: any): NormalizedTeam {
  return {
    id: t.id,
    name: t.name,
    logo_emoji: t.logo_emoji ?? t.logoEmoji ?? '🏆',
    logo_url: t.logo_url ?? t.logoUrl ?? undefined,
    seed: t.seed ?? null,
    status: t.status,
    group_label: t.group_label ?? t.groupLabel ?? null,
    players: (t.players ?? []).map(normalizePlayer),
  };
}

export function normalizePlayer(p: any): NormalizedPlayer {
  return {
    player_name: p.player_name ?? p.playerName ?? '',
    player_role: p.player_role ?? p.playerRole ?? 'member',
    game_id: p.game_id ?? p.gameId ?? '',
    avatar_emoji: p.avatar_emoji ?? p.avatarEmoji ?? '🦸',
    is_captain: p.is_captain ?? p.isCaptain ?? false,
  };
}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 无新增错误（预存错误忽略）

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/utils/normalize.ts
git commit -m "refactor(web): extract normalizeTeam to $lib/utils/normalize.ts"
```

---

## Task 2: 创建 +page.ts 数据加载

**Files:**
- Create: `apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.ts`

**背景**：SSR load 函数调 3 个公开 API，filter 出目标队伍的数据。参考 `tournaments/[id]/+page.ts` 的错误处理模式（try/catch + console.error，不吞错）。

- [ ] **Step 1: 创建 +page.ts**

```typescript
// apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.ts
import { normalizeTeam } from '$lib/utils/normalize';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { id: tournamentId, teamId } = params;

  // 1. 队伍信息 + 选手（从赛事队伍列表 filter）
  let team: any = null;
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/teams`, { credentials: 'include' });
    if (res.ok) {
      const allTeams = await res.json();
      const raw = (allTeams as any[]).find((t) => t.id === teamId);
      if (raw) team = normalizeTeam(raw);
    } else {
      console.error('[team detail] teams API returned', res.status);
    }
  } catch (err) {
    console.error('[team detail] fetch teams failed:', err);
  }

  // 2. 比赛记录（从 bracket filter 出该队伍参与的比赛）
  let matches: any[] = [];
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/bracket`, { credentials: 'include' });
    if (res.ok) {
      const bracket = await res.json();
      matches = extractTeamMatches(bracket, teamId);
    } else {
      console.error('[team detail] bracket API returned', res.status);
    }
  } catch (err) {
    console.error('[team detail] fetch bracket failed:', err);
  }

  // 3. 积分排名（从 standings filter）
  let standing: any = null;
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/standings`, { credentials: 'include' });
    if (res.ok) {
      const standings = await res.json();
      standing = (standings as any[]).find((s) => s.team?.id === teamId) ?? null;
    } else {
      console.error('[team detail] standings API returned', res.status);
    }
  } catch (err) {
    console.error('[team detail] fetch standings failed:', err);
  }

  return { tournamentId, team, matches, standing };
};

/** 从 bracket 结构中提取目标队伍的所有比赛，按 stage → round → 顺序展平 */
function extractTeamMatches(bracket: any, teamId: string): any[] {
  const result: any[] = [];
  for (const stage of bracket?.stages ?? []) {
    for (const round of stage?.rounds ?? []) {
      for (const match of round?.matches ?? []) {
        const isTeam1 = match.team1?.id === teamId;
        const isTeam2 = match.team2?.id === teamId;
        if (isTeam1 || isTeam2) {
          result.push({
            ...match,
            stageName: stage.name,
            round: round.round,
          });
        }
      }
    }
  }
  return result;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.ts
git commit -m "feat(web): add team detail page data loader"
```

---

## Task 3: 创建 +page.svelte 队伍详情页 UI

**Files:**
- Create: `apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.svelte`

**设计说明**：
- **visual thesis**: 克制的信息档案页，黑边直角网格 + Helvetica 重字号，红色 accent 点缀状态，入场用 fade+translateY
- **content plan**: 返回链接 → 队伍头部（logo+名+状态+seed）→ stat 网格（战绩/积分/排名）→ Tab（选手/比赛/积分）
- **interaction thesis**: (1) 各 section 错峰 animate-enter 入场 (2) Tab 切换 border-accent 激活 (3) 比赛卡 hover lift + 胜方黑底高亮
- **utility copy**: 标签用"参赛选手 / 比赛记录 / 积分排名"，不用营销语

- [ ] **Step 1: 创建 +page.svelte**

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';

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

  const statusMap: Record<string, { label: string; variant: string }> = {
    active: { label: '活跃', variant: 'bg-black text-white' },
    eliminated: { label: '已淘汰', variant: 'bg-accent text-white' },
    withdrawn: { label: '已退出', variant: 'bg-neutral-200 text-black' },
  };

  const roleMap: Record<string, string> = {
    captain: '队长',
    member: '成员',
    substitute: '替补',
    coach: '教练',
  };

  const tabs = [
    { id: 'players' as const, label: '参赛选手' },
    { id: 'matches' as const, label: '比赛记录' },
    { id: 'standings' as const, label: '积分排名' },
  ];
</script>

<div class="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12 animate-enter">
  <!-- 返回链接 -->
  <div class="mb-6">
    <a href="/tournaments/{data.tournamentId}"
      class="text-sm font-bold text-black border-b border-black hover:text-accent hover:border-accent transition-colors duration-150 link-underline">
      ← 返回赛事
    </a>
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
          <img src={t.logo_url} alt={t.name} class="w-16 h-16 md:w-20 md:h-20 object-contain border border-black" />
        {:else}
          <div class="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center border border-black bg-white text-4xl">
            {t.logo_emoji}
          </div>
        {/if}
        <div class="min-w-0">
          <div class="flex items-center gap-3 mb-1 flex-wrap">
            <h1 class="font-black text-2xl md:text-4xl tracking-tight text-black">{t.name}</h1>
            <span class={cn('px-2 py-0.5 text-xs font-bold', statusMap[t.status ?? 'active']?.variant)}>
              {statusMap[t.status ?? 'active']?.label ?? t.status}
            </span>
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
          <div class="border border-black">
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
                        <span class="text-lg" aria-hidden="true">{p.avatar_emoji}</span>
                        <span class="font-bold">{p.player_name}</span>
                        {#if p.is_captain}
                          <span class="text-xs font-bold text-accent border border-accent px-1">C</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-neutral-600 hidden md:table-cell font-mono text-xs">{p.game_id || '—'}</td>
                    <td class="px-4 py-3 text-neutral-600">{roleMap[p.player_role] ?? p.player_role}</td>
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
                    <img src={opponent.logo_url} alt={opponent.name} class="w-5 h-5 object-contain shrink-0" />
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
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 无新增错误

- [ ] **Step 3: 构建验证**

Run: `cd apps/web && pnpm run build`
Expected: 构建成功，无 "impossible situation" 或类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.svelte
git commit -m "feat(web): add team detail page UI with players/matches/standings tabs"
```

---

## Task 4: 接入入口链接

**Files:**
- Modify: `apps/web/src/routes/tournaments/[id]/+page.svelte` (第 127-137 行)

**背景**：赛事详情页的队伍 grid 当前是纯展示，加 `<a>` 包裹跳转到详情页。

- [ ] **Step 1: 修改队伍 grid 项为链接**

将 `apps/web/src/routes/tournaments/[id]/+page.svelte` 第 127-137 行：

```svelte
{#each teams as team, i}
  <div class="border-r border-b border-black bg-white px-3 py-2 text-sm flex items-center gap-2 animate-enter" style="animation-delay:{Math.min(i * 30, 300)}ms">
    <span class="text-neutral-500 font-bold tabular-nums">#{i + 1}</span>
    {#if team.logo_url ?? team.logoUrl}
      <img src={team.logo_url ?? team.logoUrl} alt={team.name} class="w-5 h-5 object-contain" />
    {:else if team.logo_emoji ?? team.logoEmoji}
      <span class="text-lg" aria-hidden="true">{team.logo_emoji ?? team.logoEmoji}</span>
    {/if}
    <span class="font-bold truncate">{team.name}</span>
  </div>
{/each}
```

替换为：

```svelte
{#each teams as team, i}
  <a href="/tournaments/{data.tournament.id}/teams/{team.id}"
    class="border-r border-b border-black bg-white px-3 py-2 text-sm flex items-center gap-2 animate-enter lift hover:bg-neutral-50 transition-colors duration-150"
    style="animation-delay:{Math.min(i * 30, 300)}ms">
    <span class="text-neutral-500 font-bold tabular-nums">#{i + 1}</span>
    {#if team.logo_url ?? team.logoUrl}
      <img src={team.logo_url ?? team.logoUrl} alt={team.name} class="w-5 h-5 object-contain" />
    {:else if team.logo_emoji ?? team.logoEmoji}
      <span class="text-lg" aria-hidden="true">{team.logo_emoji ?? team.logoEmoji}</span>
    {/if}
    <span class="font-bold truncate">{team.name}</span>
  </a>
{/each}
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/tournaments/[id]/+page.svelte
git commit -m "feat(web): link team grid items to team detail page"
```

---

## Self-Review

**1. Spec coverage**:
- ✅ 队伍基本信息 → Task 3 头部 + stat 网格
- ✅ 选手名单 → Task 3 players Tab
- ✅ 比赛记录 → Task 3 matches Tab
- ✅ 积分排名 → Task 3 standings Tab
- ✅ 精致动效 → animate-enter 错峰、lift hover、Tab border-accent
- ✅ 人性化排版 → 黑边网格、tabular-nums、响应式
- ✅ 路由 `/tournaments/[id]/teams/[teamId]` → Task 2 + 3
- ✅ 纯前端 filter → Task 2 复用 3 个现有 API
- ✅ 入口链接 → Task 4

**2. Placeholder scan**: 无 TBD/TODO，所有代码完整。

**3. Type consistency**:
- `normalizeTeam` 返回 `NormalizedTeam`，Task 2 import 使用，Task 3 通过 `data.team` 访问字段 `t.logo_url`/`t.players`/`t.seed`/`t.group_label` — 一致
- `extractTeamMatches` 返回 match 带 `stageName`/`round`，Task 3 模板用 `m.stageName`/`m.round` — 一致
- `data.teamId` 在 +page.ts 返回，Task 3 用 `data.teamId` — 一致
