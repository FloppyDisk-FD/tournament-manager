# 部署运维

## 本地开发

### 前置要求
- Node.js 20+
- pnpm 9+
- Bun 1.1+（后端运行时）
- Docker（可选，用于 PostgreSQL）

### 启动步骤

```bash
# 1. 克隆并安装依赖
git clone <repo-url>
cd tournament-manager
pnpm install

# 2. 启动 PostgreSQL
docker compose up -d postgres
# 或使用本地 PostgreSQL，创建数据库 tournament_manager

# 3. 配置环境变量
cp apps/api/.env.example apps/api/.env
# 编辑 apps/api/.env 设置 DATABASE_URL 和 JWT_SECRET

# 4. 数据库迁移
pnpm db:generate
pnpm db:migrate

# 5. 创建管理员账号
cd apps/api
bun run update-admin.ts  # 或参考下方手动创建

# 6. 启动开发服务
pnpm dev
# 前端: http://localhost:5174
# 后端: http://localhost:3001
```

### 默认管理员
- 用户名：`admin`
- 密码：`admin123`
- **生产环境务必修改密码**

## 环境变量

### 后端（`apps/api/.env`）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `DATABASE_URL` | ✅ | - | PostgreSQL 连接字符串 |
| `JWT_SECRET` | ✅ | - | JWT 签名密钥（生产环境必须改） |
| `PORT` | ❌ | 3001 | API 端口 |

**示例**：
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tournament_manager
JWT_SECRET=your-super-secret-key-change-in-production
PORT=3001
```

### 前端

前端通过 Vite proxy 将 `/api` 转发到后端，无需额外环境变量。

[apps/web/vite.config.ts](../../apps/web/vite.config.ts)：
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

## 数据库

### Drizzle 配置

[apps/api/drizzle.config.ts](../../apps/api/drizzle.config.ts)：
```typescript
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Neon pooler 兼容：禁用 prepared statements
  // preparedStatements: false
});
```

### 迁移命令

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate

# 手动迁移（在 apps/api 目录）
bun run src/db/migrate.ts
```

### Neon / 云数据库注意事项

使用 Neon（带 pooler）时：
1. 连接字符串用 pooler 地址（`-pooler.xxx.neon.tech`）
2. **必须**禁用 prepared statements（`db/index.ts` 中 `preparedStatements: false`）
3. 否则会出现 cache miss 和额外延迟

### 数据库重建

```bash
# 警告：会清空所有数据
cd apps/api
bun run src/db/rebuild.ts
```

重建后**必须重新登录**，因为用户 ID 会变化，旧 JWT cookie 指向不存在的用户。

## Docker 部署

### PostgreSQL（[docker-compose.yml](../../docker-compose.yml)）
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tournament_manager
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
```

### 完整容器化（参考）

后端 Dockerfile（示例）：
```dockerfile
FROM oven/bun:1 as base
WORKDIR /app
COPY package.json bun.lockb ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN bun install
COPY . .
EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
```

前端构建后部署到 Cloudflare Pages / Vercel / Netlify。

## 生产部署方案

### 推荐方案
- **数据库**：Neon / Supabase（托管 PostgreSQL）
- **后端**：Railway / Fly.io（Bun 运行时）
- **前端**：Cloudflare Pages / Vercel
- **CDN**：Cloudflare

### 环境变量（生产）
```env
DATABASE_URL=postgres://user:pass@ep.xxx.neon.tech/db?sslmode=require
JWT_SECRET=<strong-random-string-at-least-32-chars>
PORT=3001
```

### 前端构建
```bash
cd apps/web
pnpm build
# 生成 .svelte-kit/output 或 build/
```

部署时设置环境变量 `API_URL` 指向后端域名（如需）。

### CORS 配置
[apps/api/src/index.ts](../../apps/api/src/index.ts)：
```typescript
.use(cors({
  origin: ['https://yourdomain.com'],  // 生产环境改这里
  credentials: true,
}))
```

## 运维操作

### 创建/重置管理员

方法 1：脚本
```bash
cd apps/api
bun run update-admin.ts
```

方法 2：手动 SQL
```sql
-- 生成 bcrypt hash（在 Node 中）
-- const hash = await bcrypt.hash('newpassword', 10);
UPDATE users SET password_hash = '<hash>' WHERE username = 'admin';
```

### 数据备份
```bash
# 导出
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 恢复
psql $DATABASE_URL < backup_20260628.sql
```

### 日志查看

后端日志输出到 stdout：
```bash
# 开发模式
bun run src/index.ts

# 生产（PM2/systemd）
journalctl -u tournament-api -f
```

错误格式：`[API Error] ERROR_CODE error.message`

## 性能优化

### 已知优化
1. **N+1 查询消除**：`/bracket` 从 4 次查询合并为 2 次 JOIN
2. **Neon pooler**：禁用 prepared statements
3. **SSR 数据预取**：`+page.ts` load 函数避免客户端二次请求

### 可选优化
1. **应用层缓存**：对 `/bracket`、`/standings` 做内存缓存（5-10s TTL）
2. **数据库区域**：选离用户近的数据库区域
3. **连接池**：生产环境用 PgBouncer

## 故障排查

### 启动失败

| 症状 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED 5432` | PostgreSQL 未启动 | `docker compose up -d postgres` |
| `authentication failed` | DATABASE_URL 密码错误 | 检查 .env |
| `relation does not exist` | 未执行迁移 | `pnpm db:migrate` |
| `port 3001 in use` | 端口被占用 | 改 PORT 或杀进程 |

### 前端无法访问 API

1. 检查后端是否运行：`curl http://localhost:3001/api/v1/health`
2. 检查 Vite proxy 配置（`vite.config.ts`）
3. 检查浏览器 Network 面板的请求 URL 和响应

### 登录后操作失败（401）

- **原因**：数据库重建后用户 ID 变化，旧 cookie 失效
- **解决**：清除浏览器 cookie 或重新登录

### 比分提交 500

- **原因**：可能 `nextMatchId` 指向不存在的比赛
- **排查**：检查后端日志 `[API Error]` 输出
- **修复**：重置赛程重新生成

### 赛程生成失败

| 错误 | 原因 |
|------|------|
| `UNAUTHORIZED 请先登录` | cookie 过期，重新登录 |
| `BRACKET_ALREADY_GENERATED 赛程已生成` | 赛事已生成过，先重置 |
| `INVALID_TEAM_COUNT 至少需要2支队伍` | 队伍不足，先添加队伍 |
| `TOURNAMENT_ALREADY_STARTED` | 赛事非 draft，无法操作 |
