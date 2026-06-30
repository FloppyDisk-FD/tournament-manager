# 赛制算法

本系统支持四种赛制，每种赛制由独立的生成器实现（[apps/api/src/generators/](../../apps/api/src/generators/)）。所有生成器实现统一接口：

```typescript
interface BracketGenerator {
  generate(teams: Team[], settings: BracketSettings): GenerateResult;
}
```

## 生成器接口

### `GenerateResult`
```typescript
{
  stages: Omit<Stage, 'id'>[];   // 阶段（占位 ID 用 __stage_<idx>__）
  matches: Omit<Match, 'id'>[];  // 比赛（占位 ID 用 __match_<idx>__）
}
```

### `BracketSettings`
| 字段 | 说明 |
|------|------|
| `boCount` | BO 局数（BO3 = 3） |
| `thirdPlace` | 是否设季军赛 |
| `hasGroupStage` | 是否有小组赛 |
| `groupCount` | 小组数 |
| `advancePerGroup` | 每组出线数 |
| `swissRounds` | 瑞士轮轮数 |
| `formatConfig` | 扩展配置 |

## 占位 ID 约定

生成器返回的 matches/stages 没有真实数据库 ID，使用占位符：

- `__stage_<idx>__`：指向 `GenerateResult.stages[idx]`
- `__match_<idx>__`：指向 `GenerateResult.matches[idx]`

`bracket.ts` 的 `/generate` 端点分两阶段处理：

1. **First pass**：插入所有 matches 到数据库，建立 `占位符 → 真实 ID` 映射
2. **Second pass**：用真实 ID 替换 `nextMatchId`、`nextLosersMatchId` 中的占位符
3. **Third pass**：推进 `walkthrough`（轮空）比赛的胜者到下一轮

---

## 1. 单败淘汰（Single Elimination）

**文件**：[single-elimination.ts](../../apps/api/src/generators/single-elimination.ts)

### 结构
- 1 个 stage（`winners_bracket` 或单阶段）
- N 轮，每轮比赛数减半
- 可选季军赛（`thirdPlace: true`）

### 种子分布（标准 seeding）
```
numSlots = 2^ceil(log2(numTeams))
```
例如 6 队伍 → 8 slots → 2 个轮空。

种子分布规则（确保高种子分到不同半区）：
```
slot[0] = seed 1
slot[7] = seed 2
slot[3] = seed 3
slot[4] = seed 4
slot[1] = seed 5
slot[6] = seed 6
slot[2] = seed 7
slot[5] = seed 8
```

### 轮空（Bye）
- 当 `numTeams < numSlots`，多余 slot 的对手为 NULL
- 该比赛 status = `walkthrough`，winnerId = 唯一的队伍
- Third pass 自动将 winner 推进到 nextMatch

### 晋级链接
- 每场比赛的 `nextMatchId` 指向下一轮对应位置
- `position` 决定连线：`nextPosition = Math.floor(position / 2)`
- 胜者填入 nextMatch 的 team1 或 team2（按 team1 优先）

### 示例（6 队伍，8 slots）
```
R1P0: seed1 (轮空)          ─┐
R1P1: seed4 vs seed5         ├─> R2P0
R1P2: seed2 (轮空)          ─┐
R1P3: seed3 vs seed6         ├─> R2P1
                              └─> R3P0 (决赛)
```

---

## 2. 双败淘汰（Double Elimination）

**文件**：[double-elimination.ts](../../apps/api/src/generators/double-elimination.ts)

### 结构
3 个 stage：
- `winners_bracket`（胜者组）— 单败结构
- `losers_bracket`（败者组）— 败者在此继续，再败即淘汰
- `grand_final`（总决赛）— 胜者组冠军 vs 败者组冠军

### 核心规则
- 每支队伍必须输 **2 次**才淘汰
- 胜者组败者 → 降入败者组对应轮次
- 败者组败者 → 淘汰

### 败者组轮次规律（标准双败）
对于 `numSlots = 2^k` 的赛事，败者组共 `2k - 2` 轮：

| 败者组轮次 | 类型 | 场数 | 来源 |
|-----------|------|------|------|
| LR1 | 互打轮 | numSlots/4 | 胜者组 R1 败者两两配对 |
| LR2 | drop 轮 | numSlots/4 | LR1 胜者 vs 胜者组 R2 败者 |
| LR3 | 互打轮 | numSlots/8 | LR2 胜者两两配对 |
| LR4 | drop 轮 | numSlots/8 | LR3 胜者 vs 胜者组 R3 败者 |
| ... | ... | ... | ... |
| LR(2k-2) | 败者组决赛 | 1 | 接收胜者组决赛败者 |

轮次场数公式：`losersRoundsSize[lr] = numSlots / 2^(ceil(lr/2) + 1)`

### 链接逻辑（关键）

#### 败者组内部链接（nextMatchId）
- **奇数轮（互打）→ 偶数轮（drop）**：一对一晋升
- **偶数轮（drop）→ 奇数轮（互打）**：两场合并到下一轮同一场

#### 胜者组 → 败者组链接（nextLosersMatchId）
| 胜者组轮次 | 目标败者组轮次 | 链接方式 |
|-----------|---------------|---------|
| R1 | LR1 | 两两合并（targetPos = floor(i/2)） |
| R2 | LR2 | 一对一 drop（targetPos = i） |
| R3 | LR4 | 一对一 drop |
| ... | ... | ... |
| R(k) 决赛 | LR(2k-2) 败者组决赛 | 一对一 drop |

> **关键**：跳过 `walkthrough`（轮空）比赛，因为轮空比赛没有败者。

### 示例（6 队伍，8 slots，k=3）
```
胜者组：
  R1: seed1 BYE, seed4 vs seed5, seed2 BYE, seed3 vs seed6
  R2: seed1 vs (T4/T5), seed2 vs (T3/T6)
  R3: 决赛

败者组（2*3-2 = 4 轮）：
  LR1 (2场): 胜者组 R1 的 2 个真实败者两两配对
  LR2 (2场): LR1 胜者 vs 胜者组 R2 败者（一对一 drop）
  LR3 (1场): LR2 胜者互打
  LR4 (1场): LR3 胜者 vs 胜者组 R3 败者（败者组决赛）

总决赛：胜者组冠军 vs LR4 胜者
```

---

## 3. 瑞士轮（Swiss）

**文件**：[swiss.ts](../../apps/api/src/generators/swiss.ts)

### 特点
- 只生成**第 1 轮**，后续轮次动态生成
- 第 1 轮随机配对
- 每支队伍按积分分组，同分组内配对

### 第 1 轮生成
- 随机打乱队伍
- 两两配对，奇数队伍最后一个轮空（walkthrough）

### 后续轮次（`/api/v1/tournaments/:id/swiss/next-round`）
- 按当前积分排序分组
- 同分组内配对，避免重复对阵
- 所有比赛结束后才能生成下一轮

### 积分组
- `swissScoreGroup` 字段记录积分组（0 = 0 分组，1 = 1 分组...）

---

## 4. 循环赛（Round Robin）

**文件**：[round-robin.ts](../../apps/api/src/generators/round-robin.ts)

### 算法：标准 Circle Method（圆形轮转法）

参考：[Wikipedia - Round-robin tournament](https://en.wikipedia.org/wiki/Round-robin_tournament#Circle_method)

### 步骤
1. 奇数队伍补 BYE 占位（保证偶数）
2. 固定 1 号位，其余队伍围成圆形
3. 每轮：
   - 固定位 vs 圆形最后一个
   - 其余相邻两两配对
4. 每轮结束后圆形旋转一位

### 公式
```
n = 队伍数（补 BYE 后为偶数）
totalRounds = n - 1
matchesPerRound = n / 2

第 round 轮：
  pos=0: fixed vs rotation[n-2]
  pos=i (i>0): rotation[i-1] vs rotation[n-2-i]
```

### 轮空处理
- BYE 对手为 NULL
- status = `walkthrough`，winnerId = 真实队伍
- Third pass 推进 winner（但循环赛无 nextMatch，所以实际无效果）

### 示例（4 队伍）
```
R1: T1 vs T4, T2 vs T3
R2: T1 vs T3, T4 vs T2
R3: T1 vs T2, T3 vs T4
```

---

## 晋级推进机制

### 比分提交后（[matches.ts](../../apps/api/src/routes/matches.ts) PUT `/score`）

```
1. 统计 team1Wins / team2Wins
2. winsNeeded = ceil(boCount / 2)
3. 若 team1Wins >= winsNeeded 或 team2Wins >= winsNeeded：
   ├─ 设置 winnerId, loserId, status='completed'
   ├─ 若 nextMatchId 存在：
   │   └─ winner 填入 nextMatch.team1Id 或 team2Id（team1 优先）
   ├─ 若 nextLosersMatchId 存在（双败）：
   │   └─ loser 填入 losersMatch.team1Id 或 team2Id
   ├─ 更新 standings（循环赛/瑞士轮）
   └─ checkTournamentComplete()：若所有比赛 completed → 赛事 completed
```

### 轮空推进（生成时 Third pass）

```typescript
while (有变化) {
  for (每个 walkthrough 比赛 m) {
    if (m.winnerId && m.nextMatchId) {
      // 推进到 nextMatch 的空位
      if (nextMatch.team1Id 为空) → 填入 winner
      else if (nextMatch.team2Id 为空) → 填入 winner
    }
  }
}
```

循环处理是因为可能存在连续轮空（seed1 → R1 轮空 → R2 也可能轮空）。

---

## 积分榜更新（[standings.ts](../../apps/api/src/services/standings.ts)）

循环赛/瑞士轮比赛结束后调用 `updateStandings(tournamentId, stageId)`：

1. 查询该 stage 所有 completed 比赛
2. 重新计算每队 wins/losses/points/gameDifference
3. 按 (points DESC, gameDifference DESC) 排序
4. 更新 rank 字段

### 积分规则（默认）
- 胜：3 分
- 平：1 分
- 负：0 分

（实际实现见 `standings.ts`，可根据赛制调整）

---

## 常见问题排查

### "第一轮 TBD vs TBD"
- **原因**：轮空比赛 winner 未推进到下一轮
- **修复**：bracket.ts third pass 循环推进 walkthrough winner

### "败者组某轮显示 T2 vs T2"
- **原因**：旧 bug 数据残留
- **修复**：重置赛程后重新生成

### "胜者组败者没进败者组"
- **原因**：`nextLosersMatchId` 未正确设置
- **检查**：确认跳过了 walkthrough 比赛，确认 drop 轮 vs 互打轮的链接策略

### "双败总决赛对阵不对"
- **原因**：胜者组决赛败者未链接到败者组决赛
- **修复**：循环条件用 `wr <= winnersRounds`（包含胜者组决赛）
