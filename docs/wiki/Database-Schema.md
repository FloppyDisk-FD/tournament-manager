# 数据库设计

PostgreSQL 16，通过 Drizzle ORM 定义 schema（[apps/api/src/db/schema.ts](../../apps/api/src/db/schema.ts)）。

## ER 关系图

```
users ──< tournaments >── tournament_teams >── teams ──< team_players
                       │                         │
                       ├──< stages ──< matches ──< games
                       │                │
                       │                ├── winner_id ──> teams
                       │                ├── loser_id ──> teams
                       │                ├── next_match_id (self-ref)
                       │                └── next_losers_match_id (self-ref)
                       │
                       └──< standings >── teams
```

## 枚举类型

### `role`
| 值 | 说明 |
|----|------|
| `admin` | 管理员，可创建/修改/删除赛事 |
| `user` | 普通用户（预留） |

### `tournament_status`
| 值 | 说明 | 可执行操作 |
|----|------|-----------|
| `draft` | 草稿 | 编辑、删除、添加队伍、生成赛程 |
| `ongoing` | 进行中 | 录入比分、重置赛程 |
| `completed` | 已结束 | 只读 |
| `cancelled` | 已取消 | 只读 |

### `tournament_format`
| 值 | 说明 | 生成器 |
|----|------|--------|
| `single_elim` | 单败淘汰 | `SingleElimGenerator` |
| `double_elim` | 双败淘汰 | `DoubleElimGenerator` |
| `swiss` | 瑞士轮 | `SwissGenerator` |
| `round_robin` | 循环赛 | `RoundRobinGenerator` |

### `team_status`
| 值 | 说明 |
|----|------|
| `active` | 活跃 |
| `eliminated` | 已淘汰 |
| `withdrawn` | 已退赛 |

### `stage_type`
| 值 | 说明 | 用于 |
|----|------|------|
| `group` | 小组赛 | 小组赛阶段 |
| `winners_bracket` | 胜者组 | 双败 |
| `losers_bracket` | 败者组 | 双败 |
| `grand_final` | 总决赛 | 双败 |
| `round_robin` | 循环赛 | 循环赛 |
| `swiss` | 瑞士轮 | 瑞士轮 |

### `match_status`
| 值 | 说明 |
|----|------|
| `pending` | 待赛（队伍已确定或待定） |
| `in_progress` | 进行中（预留） |
| `completed` | 已结束（已决出胜者） |
| `walkthrough` | 轮空（自动晋级） |

## 表结构

### `users` — 用户
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `username` | varchar(50) UNIQUE | 用户名 |
| `password_hash` | varchar | bcrypt 哈希 |
| `role` | role | `admin` / `user` |
| `avatar_url` | varchar | 头像 URL |
| `created_at` | timestamp | |

### `tournaments` — 赛事
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `name` | varchar(200) | 赛事名 |
| `description` | text | 描述 |
| `game` | varchar(100) | 游戏名 |
| `cover_image` | varchar | banner 图 URL |
| `status` | tournament_status | 默认 `draft` |
| `created_by` | uuid FK → users | 创建者 |
| `created_at` | timestamp | |
| `start_date` | timestamp | 开始时间 |
| `end_date` | timestamp | 结束时间 |
| `format` | tournament_format | 赛制 |
| `team_size` | integer | 每队人数，默认 5 |
| `max_teams` | integer | 最大队伍数，默认 16 |
| `bo_count` | integer | BO 局数，默认 3（BO3） |
| `has_group_stage` | boolean | 是否有小组赛 |
| `group_count` | integer | 小组数 |
| `advance_per_group` | integer | 每组出线数 |
| `third_place` | boolean | 是否设季军赛 |
| `swiss_rounds` | integer | 瑞士轮轮数 |
| `format_config` | jsonb | 扩展配置 |

### `teams` — 全局队伍库
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `tournament_id` | uuid FK → tournaments, **nullable** | NULL = 全局队伍 |
| `name` | varchar(100) | 队名 |
| `seed` | integer | 种子号 |
| `logo_url` | varchar | Logo 图片 URL |
| `logo_emoji` | varchar(10) | Logo emoji |
| `status` | team_status | 默认 `active` |

> **注意**：`tournament_id` 为 NULL 时表示全局队伍，可被多个赛事复用。赛事内的 seed/status 记录在 `tournament_teams`。

### `tournament_teams` — 赛事-队伍关联
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `tournament_id` | uuid FK → tournaments | |
| `team_id` | uuid FK → teams | |
| `seed` | integer | 赛事内种子号 |
| `status` | team_status | 赛事内状态 |
| `group_label` | varchar(20) | 小组标签（A/B/C...） |

### `team_players` — 选手档案
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `team_id` | uuid FK → teams | |
| `player_name` | varchar(50) | 选手名 |
| `player_role` | varchar(30) | 位置/角色 |
| `game_id` | varchar(50) | 游戏内 ID |
| `avatar_emoji` | varchar(10) | 头像 emoji |
| `is_captain` | boolean | 是否队长 |

### `stages` — 赛事阶段
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `tournament_id` | uuid FK → tournaments | |
| `type` | stage_type | 阶段类型 |
| `name` | varchar(50) | 显示名（胜者组/败者组/总决赛） |
| `order` | integer | 排序 |

### `matches` — 比赛
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `stage_id` | uuid FK → stages | |
| `group_label` | varchar(20) | 小组标签 |
| `round` | integer | 轮次 |
| `position` | integer | 轮内位置（用于排序与连线） |
| `bracket_pos` | integer | bracket 绘制位置 |
| `team1_id` | uuid FK → teams, nullable | 队伍1 |
| `team2_id` | uuid FK → teams, nullable | 队伍2 |
| `winner_id` | uuid FK → teams, nullable | 胜者 |
| `loser_id` | uuid FK → teams, nullable | 败者 |
| `team1_score` | integer | 队伍1 局分，默认 0 |
| `team2_score` | integer | 队伍2 局分，默认 0 |
| `status` | match_status | 默认 `pending` |
| `scheduled_at` | timestamp | 计划时间 |
| `next_match_id` | uuid self-ref, nullable | 胜者晋级到此比赛 |
| `next_losers_match_id` | uuid self-ref, nullable | 败者降入此比赛（双败） |
| `swiss_score_group` | integer | 瑞士轮积分组 |

> **自引用字段**：`next_match_id` 和 `next_losers_match_id` 是 matches 表的自引用外键。删除赛程时必须先清除这些自引用，否则会触发外键约束错误。

### `games` — 单局
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `match_id` | uuid FK → matches | |
| `game_number` | integer | 局次（1, 2, 3...） |
| `winner_id` | uuid FK → teams, nullable | 该局胜者 |
| `score` | jsonb | 详细比分 |
| `duration` | integer | 时长（秒） |
| `map` | varchar(100) | 地图 |
| `vod_url` | varchar | 录像链接 |

### `standings` — 积分榜
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | |
| `tournament_id` | uuid FK → tournaments | |
| `stage_id` | uuid FK → stages | |
| `team_id` | uuid FK → teams | |
| `group_label` | varchar(20) | 小组标签 |
| `wins` | integer | 胜场，默认 0 |
| `losses` | integer | 负场，默认 0 |
| `draws` | integer | 平场，默认 0 |
| `points` | integer | 积分，默认 0 |
| `game_difference` | integer | 净胜局，默认 0 |
| `round_played` | integer | 已赛轮次，默认 0 |
| `rank` | integer | 排名 |

> **初始化**：循环赛/瑞士轮生成赛程时，会为每支队伍插入一条 0 值记录，确保积分榜生成后即可显示。

## 约束与索引

- **唯一约束**：`users.username`
- **外键**：所有 FK 默认无级联删除（需手动按依赖顺序删除）
- **NULL 语义**：`teams.tournament_id` 为 NULL 表示全局队伍，查询时必须用 `isNull()` 而非 `eq(field, null)`（SQL `= NULL` 永不匹配）

## 删除依赖顺序

删除赛事时必须按以下顺序（见 [tournaments.ts](../../apps/api/src/routes/tournaments.ts) DELETE 端点）：

```
1. 清除 matches 自引用 (next_match_id, next_losers_match_id)
2. 删除 games (引用 matches)
3. 删除 standings (引用 stages)
4. 删除 matches (引用 stages)
5. 删除 stages (引用 tournaments)
6. 删除 tournament_teams (引用 tournaments)
7. 删除 tournaments
```
