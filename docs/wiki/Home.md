# Tournament Manager Wiki

欢迎来到 Tournament Manager 项目 wiki。这是一个面向电竞/体育赛事的开源赛事管理系统，支持四种主流赛制，提供从赛事创建到对阵生成、比分录入、积分排名的完整流程。

## 快速导航

| 文档 | 内容 |
|------|------|
| [架构概览](./Architecture) | 技术栈、Monorepo 结构、数据流 |
| [数据库设计](./Database-Schema) | 表结构、枚举、关系图 |
| [赛制算法](./Tournament-Formats) | 单败/双败/瑞士轮/循环赛的生成与晋级规则 |
| [API 参考](./API-Reference) | 全部 REST 端点、请求/响应格式 |
| [前端指南](./Frontend-Guide) | 路由、组件、状态管理、设计系统 |
| [部署运维](./Deployment) | 本地开发、Docker、环境变量、迁移 |
| [常见问题](./FAQ) | 已知坑点与排查思路 |

## 核心特性

- **4 种赛制**：单败淘汰、双败淘汰、瑞士轮、循环赛
- **全局队伍库**：跨赛事复用队伍与选手档案
- **自动晋级**：比分提交后自动推进胜者/败者到下一轮
- **积分榜**：循环赛/瑞士轮实时积分排名
- **对阵图**：可视化 bracket，支持胜者高亮、进行中标识
- **SSR + 类型安全**：SvelteKit 服务端渲染 + Elysia 端到端类型

## 技术栈速览

- **后端**：ElysiaJS (Bun) + Drizzle ORM + PostgreSQL
- **前端**：SvelteKit 5 (runes) + shadcn-svelte + Tailwind CSS
- **Monorepo**：Turborepo + pnpm workspaces
- **设计系统**：Swiss International Style（黑白极简、严格网格）

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动 PostgreSQL（Docker）
docker compose up -d postgres

# 配置环境变量
cp apps/api/.env.example apps/api/.env

# 数据库迁移
pnpm db:generate && pnpm db:migrate

# 启动开发服务（前后端并行）
pnpm dev
```

- 前端：http://localhost:5174
- 后端：http://localhost:3001
- 默认管理员：`admin` / `admin123`
