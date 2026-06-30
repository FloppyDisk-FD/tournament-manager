# 架构概览

## 技术栈

### 后端 (`apps/api`)
- **运行时**：Bun
- **框架**：ElysiaJS
- **ORM**：Drizzle ORM (PostgreSQL)
- **认证**：JWT (httpOnly cookie) + bcryptjs
- **端口**：3001

### 前端 (`apps/web`)
- **框架**：SvelteKit 5（使用 runes: `$state` / `$derived` / `$effect`）
- **UI**：shadcn-svelte + Tailwind CSS
- **设计语言**：Swiss International Style
- **端口**：5174（Vite dev server）

### 共享包 (`packages/shared`)
- 跨前后端共享的类型定义与常量
- 包含 `TournamentFormat`、`MatchStatus`、`StageType` 等枚举

### 工具链
- **Monorepo**：Turborepo + pnpm workspaces
- **构建**：Vite (前端)、Bun (后端)
- **数据库**：PostgreSQL 16

## Monorepo 结构

```
tournament-manager/
├── apps/
│   ├── api/                    # 后端服务
│   │   ├── src/
│   │   │   ├── db/            # 数据库连接、schema、迁移
│   │   │   ├── generators/    # 赛制生成器（4 种）
│   │   │   ├── middleware/    # auth、error 中间件
│   │   │   ├── routes/        # API 路由
│   │   │   ├── services/      # 业务服务（standings）
│   │   │   └── index.ts       # 入口
│   │   ├── drizzle.config.ts
│   │   └── .env
│   └── web/                    # 前端应用
│       ├── src/
│       │   ├── lib/           # api client、stores、components
│       │   └── routes/        # SvelteKit 路由（页面）
│       └── vite.config.ts
├── packages/
│   └── shared/                # 共享类型与常量
│       └── src/
│           ├── constants/     # 枚举常量
│           └── types/         # TypeScript 类型
├── docker-compose.yml          # PostgreSQL 容器
├── turbo.json                  # Turborepo 任务配置
└── pnpm-workspace.yaml
```

## 数据流

### 请求链路

```
浏览器 ──(cookie)──> SvelteKit SSR (event.fetch) ──> Elysia API ──> PostgreSQL
                              │
                              └──> 渲染 HTML 返回浏览器
```

### 认证流程

1. 登录：`POST /api/v1/auth/login` → 验证 bcrypt → 签发 JWT → 写入 httpOnly cookie（`sameSite: Lax`, 7 天）
2. 请求：浏览器自动携带 cookie → Elysia `authPlugin` 解析 JWT → 注入 `user` 到上下文
3. 鉴权：`requireAdmin` 中间件检查 `user.role === 'admin'`
4. SSR：`+layout.server.ts` 同步读取 cookie 判断登录态，避免阻塞渲染

### 赛程生成流程

```
1. 创建赛事 (draft)
2. 添加队伍到赛事 (tournament_teams)
3. 调用 /generate：
   ├─ 选择生成器 (SingleElim/DoubleElim/Swiss/RoundRobin)
   ├─ 生成 stages + matches（含占位 ID）
   ├─ First pass：插入 matches 到数据库
   ├─ Second pass：用真实 ID 替换 nextMatchId 占位符
   ├─ Third pass：推进 walkthrough（轮空）胜者到下一轮
   └─ 循环赛/瑞士轮：初始化空积分榜
4. 赛事状态 → ongoing
```

### 比分提交流程

```
1. 管理员录入每局游戏胜者
2. PUT /matches/:id/score：
   ├─ Upsert games 记录
   ├─ 统计 team1Wins / team2Wins
   ├─ 达到 boCount/2+1 → 决出胜者
   ├─ 胜者推进到 nextMatch.team1Id 或 team2Id
   ├─ 双败：败者推进到 nextLosersMatchId
   ├─ 更新 standings（循环赛/瑞士轮）
   └─ 检查赛事是否全部结束 → completed
```

## 关键设计决策

### 为什么用全局队伍库而非每赛事独立队伍？
- 避免重复录入相同队伍
- 选手档案（gameId、队长标识）跨赛事复用
- `teams.tournamentId` 为 NULL 表示全局队伍，`tournament_teams` 关联表记录赛事内的 seed/status

### 为什么禁用 Drizzle prepared statements？
- Neon pooler（PgBouncer 事务模式）与 prepared statements 不兼容
- 会导致 cache miss 和额外延迟
- 配置：`db/index.ts` 中 `preparedStatements: false`

### 为什么用 SSR load 函数而非 onMount？
- `onMount` + 客户端 fetch 会导致首屏空白、SEO 差、错误被静默吞掉
- `+page.ts` load 函数在服务端执行，HTML 直接包含数据
- 使用 `event.fetch` 而非全局 `fetch`（SSR 环境要求）

### Svelte 5 runes 约束
- `$state` / `$derived` / `$effect` 只能在 `.svelte` 或 `.svelte.ts` 文件中使用
- 跨模块共享响应式状态：必须用 `$derived(getX())` 建立订阅，不能直接赋值
- 典型坑：`const toasts = getToasts()` 不建立响应式订阅，Toast 不更新

## 性能优化记录

| 端点 | 优化前 | 优化后 | 手段 |
|------|--------|--------|------|
| `/bracket` | 10852ms | 1251ms | inArray + leftJoin 消除 N+1 |
| `/matches` | 5732ms | 671ms | 合并 4 次查询为 1 次 JOIN |
| `/standings` | 1232ms | 657ms | JOIN + 禁用 prepared statements |
