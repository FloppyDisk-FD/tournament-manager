# 常见问题（FAQ）

## 赛制相关

### Q: 单败赛事第一轮为什么有轮空？
A: 标准 seeding 规则。`numSlots = 2^ceil(log2(numTeams))`，例如 6 队伍 → 8 slots → 2 个轮空。高种子（seed 1、seed 2）获得轮空，这是标准做法，确保高种子在 bracket 中分到不同半区。

### Q: 双败赛事的败者组为什么轮次比胜者组多？
A: 标准双败规则：每支队伍必须输 2 次才淘汰。对于 `numSlots = 2^k` 的赛事，败者组共 `2k - 2` 轮。例如 8 队伍（k=3）→ 胜者组 3 轮 + 败者组 4 轮 + 总决赛 1 场。

### Q: 双败总决赛为什么不是胜者组冠军直接夺冠？
A: 标准双败规则下，败者组冠军必须赢一次胜者组冠军才公平（因为胜者组冠军还没输过）。本系统当前实现的是"单场总决赛"：胜者组冠军 vs 败者组冠军，一场定胜负。如需"双场总决赛"（败者组冠军需赢两场），需扩展 grand_final 为 BO1 的 bracket reset 机制。

### Q: 瑞士轮怎么生成下一轮？
A: 瑞士轮只生成第 1 轮（随机配对）。后续轮次需在所有当前轮比赛完成后，调用 `/api/v1/tournaments/:id/swiss/next-round` 动态生成。系统按积分分组，同分组内配对，避免重复对阵。

### Q: 循环赛为什么会出现轮空？
A: 奇数队伍时标准 Circle Method 会补一个 BYE 占位，对应轮次该队伍轮空。轮空比赛 status = `walkthrough`，winnerId 自动设为真实队伍。

## 操作相关

### Q: 创建赛事后无法管理？
A: 检查是否已登录管理员账号。数据库重建后旧 cookie 会失效，需重新登录 http://localhost:5174/login（admin/admin123）。

### Q: 比分提交后下一轮对阵没更新？
A: 检查后端日志。可能原因：
1. `nextMatchId` 未正确设置（赛程生成 bug）
2. nextMatch 的 team1/team2 都已占用（数据异常）
3. 比赛未达到 `ceil(boCount/2)` 胜局

### Q: 删除赛事失败（外键约束）？
A: 赛事有关联数据时必须按依赖顺序删除。系统已在 DELETE 端点实现级联删除，如果仍失败可能是旧版本代码。依赖顺序：清 matches 自引用 → 删 games → 删 standings → 删 matches → 删 stages → 删 tournament_teams → 删 tournaments。

### Q: 积分榜不显示？
A: 循环赛/瑞士轮生成赛程时会初始化空积分榜。如果赛事是在添加初始化逻辑前创建的，需要**重置赛程后重新生成**。

### Q: banner 图不显示？
A: Drizzle ORM 返回 camelCase（`coverImage`），前端需用兼容写法 `t.coverImage ?? t.cover_image`。所有显示 banner 的页面都已修复。

### Q: 第一轮比赛都是"待赛"，无法录入？
A: 已修复。原 bug 是条件分支顺序错误：`isWaiting`（pending + 有两队）截断了录入按钮。修复后：有两支队伍的 pending 比赛显示"录入比分"按钮。

## 前端相关

### Q: Toast 通知不显示？
A: Svelte 5 跨模块响应式必须用 `$derived`。检查 [Toast.svelte](../../apps/web/src/lib/components/Toast.svelte) 是否用 `let toasts = $derived(getToasts())`，不能用 `const toasts = getToasts()`。

### Q: 列表页空白？
A: 用 `+page.ts` SSR load 函数替代 `onMount` + 客户端 fetch。`onMount` 方式的 catch 会静默吞错，导致空白且无错误提示。

### Q: 登录状态丢失？
A: 不要用模块级 `$state` 存储 `currentUser`，SSR 时会为 null 导致 hydrate 不一致。用 `+layout.server.ts` 读取 cookie 判断登录态。

## 数据库相关

### Q: `eq(field, null)` 查不到数据？
A: SQL 中 `= NULL` 永不匹配。必须用 `isNull(field)`：
```typescript
// ❌ 错误
db.select().from(teams).where(eq(teams.tournamentId, null));
// ✅ 正确
db.select().from(teams).where(isNull(teams.tournamentId));
```

### Q: Drizzle 插入空数组报 500？
A: `db.insert(teamPlayers).values([])` 会触发错误。添加长度守卫：
```typescript
if (players.length > 0) {
  await db.insert(teamPlayers).values(players);
}
```

### Q: Neon 数据库连接不稳定？
A: Neon pooler（PgBouncer 事务模式）与 prepared statements 不兼容。在 [db/index.ts](../../apps/api/src/db/index.ts) 中设置 `preparedStatements: false`。

## 性能相关

### Q: 赛程图加载很慢？
A: 已优化。原 `/bracket` 端点有 N+1 查询（4 次查询），优化为 2 次 JOIN 查询，从 10s 降到 1.2s。如仍慢，检查：
1. 数据库区域是否离用户太远
2. 是否启用了 prepared statements（Neon 需禁用）
3. 可加应用层缓存（5-10s TTL）

### Q: 首页卡片加载后无限转圈？
A: 已修复。原用 `onMount` + fetch 静默失败。改用 `+page.ts` SSR load 后数据直接在 HTML 中。

## 已知限制

1. **无双场总决赛**：双败 grand final 是单场，未实现 bracket reset
2. **无小组赛阶段**：`hasGroupStage` 字段存在但未实现生成器
3. **无实时更新**：比分提交后需手动刷新查看新对阵
4. **瑞士轮无避免重复对阵的严格保证**：当前按积分分组，同组内可能重复
5. **无用户端**：当前只有管理员后台，普通用户（`role: user`）无任何页面
