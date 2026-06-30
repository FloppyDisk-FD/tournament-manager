# API 参考

Base URL: `http://localhost:3001/api/v1`

所有端点返回 JSON。错误响应统一格式：

```json
{ "error": { "code": "ERROR_CODE", "message": "中文错误描述" } }
```

## 认证机制

- 登录后通过 httpOnly cookie (`auth`) 携带 JWT
- 前端 `credentials: 'include'` 自动携带
- 受保护端点需 `requireAdmin` 中间件
- 401 响应前端会自动跳转登录页

---

## 认证 `/auth`

### POST `/auth/register`
注册新用户。

**请求**：
```json
{ "username": "string", "password": "string" }
```
**响应** 201：
```json
{ "id": "uuid", "username": "string", "role": "user" }
```

### POST `/auth/login`
登录。

**请求**：
```json
{ "username": "admin", "password": "admin123" }
```
**响应** 200：
```json
{ "id": "uuid", "username": "string", "role": "admin" }
```
Set-Cookie: `auth=<jwt>; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`

### POST `/auth/logout`
登出，清除 cookie。

**响应**：`{ "message": "已登出" }`

### GET `/auth/me`
获取当前登录用户。

**响应** 200：
```json
{ "id": "uuid", "username": "string", "role": "admin", "avatarUrl": null }
```
**响应** 401（未登录）：
```json
{ "error": "未登录" }
```

---

## 赛事 `/tournaments`

### GET `/tournaments`
分页查询赛事列表（公开）。

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码，默认 1 |
| `limit` | number | 每页条数，默认 20，最大 100 |
| `status` | string | 按状态过滤 |
| `game` | string | 按游戏名模糊搜索 |

**响应**：
```json
{
  "items": [Tournament],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET `/tournaments/:id`
获取赛事详情（公开）。

**响应**：`Tournament`

### POST `/tournaments` 🔒
创建赛事。

**请求**（snake_case）：
```json
{
  "name": "2026 春季赛",
  "description": "描述",
  "game": "League of Legends",
  "format": "single_elim",
  "team_size": 5,
  "max_teams": 16,
  "bo_count": 3,
  "has_group_stage": false,
  "group_count": null,
  "advance_per_group": null,
  "third_place": false,
  "swiss_rounds": null,
  "format_config": null,
  "cover_image": "https://..."
}
```
**响应** 201：`Tournament`

> **注意**：`cover_image` 和 `coverImage` 都接受（兼容）。

### PUT `/tournaments/:id` 🔒
更新赛事（仅 draft 状态可改）。

**请求**：同 POST。**响应**：`Tournament`

### DELETE `/tournaments/:id` 🔒
删除赛事（仅 draft 状态可删）。级联删除所有关联数据。

**响应**：`{ "message": "赛事已删除" }`

---

## 赛事队伍 `/tournaments/:id/teams`

### GET `/tournaments/:id/teams`（公开）
列出赛事内队伍（含选手）。

**响应**：
```json
[{
  "id": "uuid",
  "name": "队伍名",
  "logo_url": "https://...",
  "logo_emoji": "🎮",
  "seed": 1,
  "status": "active",
  "group_label": null,
  "players": [{ "playerName": "Faker", "isCaptain": true, ... }]
}]
```

### POST `/tournaments/:id/teams` 🔒
快速创建临时队伍并加入赛事（不进全局库）。

**请求**：
```json
{
  "name": "临时队",
  "logo_emoji": "🎮",
  "logo_url": "https://...",
  "players": [{ "player_name": "选手", "player_role": "中单", "is_captain": true }]
}
```

### POST `/tournaments/:id/teams/import` 🔒
从全局队伍库批量加入赛事。

**请求**：`{ "team_ids": ["uuid", "uuid"] }`
**响应** 201：`{ "message": "队伍已加入赛事", "added": 2 }`

### POST `/tournaments/:id/teams/batch` 🔒
批量创建队伍（仅名称）。

**请求**：`{ "names": ["队1", "队2", "队3"] }`

### PUT `/tournaments/:id/teams/:teamId` 🔒
更新队伍信息（含 seed、status、选手）。

### DELETE `/tournaments/:id/teams/:teamId` 🔒
从赛事移除队伍（全局队伍保留，仅删关联）。

---

## 全局队伍库 `/teams` 🔒

所有端点需管理员权限。

### GET `/teams`
列出所有全局队伍（`tournament_id IS NULL`），含选手。

### POST `/teams`
创建全局队伍。

**请求**：
```json
{
  "name": "T1",
  "logo_emoji": "🏆",
  "logo_url": "https://...",
  "players": [{
    "player_name": "Faker",
    "player_role": "中单",
    "game_id": "faker123",
    "avatar_emoji": "👑",
    "is_captain": true
  }]
}
```

### PUT `/teams/:teamId`
更新全局队伍（选手全量替换）。

### DELETE `/teams/:teamId`
删除全局队伍及其所有关联（选手、tournament_teams）。

---

## 赛程 `/tournaments/:id`

### GET `/tournaments/:id/bracket`（公开）
获取完整对阵图（含 stages、rounds、matches、teams、games）。

**响应**：
```json
{
  "tournament": { "id": "uuid", "name": "...", "format": "...", "status": "..." },
  "stages": [{
    "id": "uuid",
    "type": "winners_bracket",
    "name": "胜者组",
    "rounds": [{
      "round": 1,
      "name": "第1轮",
      "matches": [{
        "id": "uuid",
        "stageId": "uuid",
        "bracket_pos": 0,
        "team1": { "id": "uuid", "name": "T1", "logo_url": "...", "seed": 1 },
        "team2": null,
        "team1_score": 0,
        "team2_score": 0,
        "status": "pending",
        "round": 1,
        "position": 0,
        "games": []
      }]
    }]
  }]
}
```

> matches 在每个 round 内按 `position` 升序排列。

### GET `/tournaments/:id/matches`（公开）
获取赛事所有比赛（扁平结构，含 stageType/stageName/stageOrder/team1Name/team2Name）。

**响应**：按 `stageOrder → round → position` 排序的 Match[]。

### GET `/tournaments/:id/stages`（公开）
获取赛事所有阶段。

### GET `/tournaments/:id/stages/:stageId/matches`（公开）
获取某阶段的所有比赛。

### GET `/tournaments/:id/standings`（公开）
获取积分榜（循环赛/瑞士轮）。

**响应**（按 rank 升序）：
```json
[{
  "rank": 1,
  "team": { "id": "uuid", "name": "T1", "logo_url": "..." },
  "group_label": null,
  "wins": 3, "losses": 0, "draws": 0,
  "points": 9, "game_difference": 6, "round_played": 3
}]
```

### GET `/tournaments/:id/standings/:groupLabel`（公开）
获取某小组积分榜。

### POST `/tournaments/:id/generate` 🔒
生成赛程（仅 draft 状态）。

**请求**（可选）：
```json
{
  "seed_by": "manual",
  "seed_order": ["team_uuid_1", "team_uuid_2", ...]
}
```
**响应** 200：
```json
{ "message": "赛程生成成功", "stagesCount": 3, "matchesCount": 14 }
```

### POST `/tournaments/:id/reset` 🔒
重置赛程（删除所有 stages/matches/games/standings，赛事回到 draft）。

### POST `/tournaments/:id/swiss/next-round` 🔒
瑞士轮生成下一轮（所有当前轮比赛完成后调用）。

---

## 比赛 `/matches`

### GET `/matches/:id`（公开）
获取比赛详情（含 games）。

### PUT `/matches/:id/score` 🔒
提交比分。

**请求**：
```json
{
  "games": [
    { "game_number": 1, "winner_id": "team_uuid", "map": "召唤师峡谷", "duration": 2400 },
    { "game_number": 2, "winner_id": "team_uuid", "map": "扭曲丛林", "duration": 1800 }
  ]
}
```
**响应**：
```json
{ "message": "比分已更新", "match_decided": true }
```

> 若达到 `ceil(boCount/2)` 胜局，自动决出胜者，推进到下一轮，更新积分榜，检查赛事完成状态。

### PUT `/matches/:id/schedule` 🔒
设置比赛时间。

**请求**：`{ "scheduled_at": "2026-07-01T10:00:00Z" }`

---

## 健康检查

### GET `/health`
**响应**：`{ "status": "ok" }`

---

## 错误代码

| code | message | HTTP |
|------|---------|------|
| `VALIDATION_ERROR` | 参数校验失败 | 400 |
| `INVALID_TEAM_COUNT` | 至少需要2支队伍 | 400 |
| `INVALID_INPUT` | 输入无效 | 400 |
| `TEAM_LIMIT_EXCEEDED` | 超出队伍上限 | 400 |
| `UNAUTHORIZED` | 请先登录 | 401 |
| `INVALID_CREDENTIALS` | 用户名或密码错误 | 401 |
| `FORBIDDEN` | 需要管理员权限 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `USERNAME_TAKEN` | 用户名已被占用 | 409 |
| `BRACKET_ALREADY_GENERATED` | 赛程已生成 | 400 |
| `TOURNAMENT_ALREADY_STARTED` | 赛事已开始 | 400 |
| `MATCH_COMPLETED` | 比赛已结束 | 400 |
| `INTERNAL_ERROR` | 内部错误 | 500 |
