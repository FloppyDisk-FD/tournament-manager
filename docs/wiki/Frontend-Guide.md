# 前端指南

## 技术栈

- **框架**：SvelteKit 5（runes 语法）
- **UI**：shadcn-svelte + Tailwind CSS
- **设计系统**：Swiss International Style（黑白极简）
- **API 代理**：Vite proxy `/api` → `http://localhost:3001`

## 路由结构

```
src/routes/
├── +layout.server.ts          # 根 SSR 鉴权
├── +layout.svelte             # 根布局（Toast 挂载、导航）
├── +page.svelte               # 首页（赛事列表）
├── +page.ts                   # 首页 SSR load
├── login/
│   └── +page.svelte           # 登录页
├── tournaments/
│   └── [id]/
│       ├── +page.svelte       # 赛事详情（对阵/积分/赛程 tab）
│       ├── +page.ts           # SSR load
│       └── bracket/
│           ├── +page.svelte   # 对阵图
│           └── +page.ts
└── admin/
    ├── +layout.server.ts      # 管理员鉴权
    ├── +layout.svelte         # 管理布局
    ├── +page.svelte           # 管理概览（统计）
    ├── +page.ts
    ├── teams/
    │   ├── +page.svelte       # 全局队伍库管理
    │   └── +page.ts
    └── tournaments/
        ├── +page.svelte       # 赛事列表
        ├── +page.ts
        ├── new/
        │   └── +page.svelte   # 新建赛事
        └── [id]/
            ├── +page.svelte   # 赛事详情/编辑
            ├── +page.ts
            ├── matches/
            │   ├── +page.svelte # 比赛管理（录入比分）
            │   └── +page.ts
            └── teams/
                ├── +page.svelte # 赛事队伍管理
                └── +page.ts
```

## 状态管理

### Svelte 5 Runes 约束

- `$state` / `$derived` / `$effect` **只能**在 `.svelte` 或 `.svelte.ts` 文件中使用
- 跨模块共享响应式状态：必须用 `$derived(getX())` 建立订阅
- 导入 store 时必须带 `.svelte` 扩展名

```typescript
// ✅ 正确
import { getToasts } from '$lib/stores/toast.svelte';
let toasts = $derived(getToasts());

// ❌ 错误（不建立响应式订阅）
import { getToasts } from '$lib/stores/toast';
const toasts = getToasts();
```

### Store 模式（`.svelte.ts`）

```typescript
// $lib/stores/toast.svelte.ts
let toasts = $state<Toast[]>([]);
export function getToasts() { return toasts; }
export function pushToast(t: Toast) { toasts.push(t); }
```

### 认证状态

- **SSR**：`+layout.server.ts` 读取 cookie 判断登录态，传递 `data.user` 给页面
- **客户端**：`auth.svelte.ts` store 管理 `currentUser`
- **关键**：不要用模块级 `$state` 在 SSR 时存储用户，会导致状态不一致

## API 调用

### Client（[lib/api/client.ts](../../apps/web/src/lib/api/client.ts)）

```typescript
import { api } from '$lib/api/client';

// 自动携带 cookie（credentials: 'include'）
const tournaments = await api.get<Tournament[]>('/tournaments');
await api.post('/tournaments', { name: '...', format: 'single_elim' });
```

**特性**：
- 自动 `credentials: 'include'`
- 401 自动跳转登录页（带 redirect 参数）
- 错误消息提取自 `error.message`，中文友好

### SSR Load 函数

```typescript
// +page.ts
export async function load({ fetch, url }) {
  const status = url.searchParams.get('status') || '';
  const res = await fetch(`/api/v1/tournaments/?status=${status}`);
  const data = await res.json();
  return { tournaments: data.items };
}
```

> **必须**用 `event.fetch` 而非全局 `fetch`（SSR 环境要求）。

## 设计系统（Swiss International Style）

### 核心原则
- 严格网格系统
- 无衬线字体（`font-sans`）
- 客观信息传递
- 大量留白
- 黑白为主，克制色彩

### Tailwind 类映射

| 组件 | 必须包含的类 |
|------|-------------|
| **Button** | `rounded-none font-sans font-bold transition-opacity duration-150 active:opacity-70` |
| **Card** | `rounded-none border border-black bg-white` |
| **Input** | `rounded-none border border-black font-sans focus:outline-none` |
| **Section** | `py-12 md:py-24 lg:py-32` |
| **Hero** | `text-5xl md:text-7xl lg:text-9xl font-black tracking-tight` |
| **H1** | `text-4xl md:text-6xl font-black tracking-tight` |
| **H2** | `text-3xl md:text-4xl font-bold tracking-tight` |

### 禁止使用的类

```
font-serif, font-mono
rounded-lg, rounded-xl, rounded-2xl, rounded-3xl, rounded-full
shadow-sm, shadow-md, shadow-lg, shadow-xl, shadow-2xl
bg-gradient-*
italic
border-dashed, border-dotted
```

### 字体大小层级

| 层级 | 类 |
|------|-----|
| Hero | `text-5xl md:text-7xl lg:text-9xl` |
| H1 | `text-4xl md:text-6xl` |
| H2 | `text-3xl md:text-4xl` |
| H3 | `text-2xl md:text-3xl` |
| Body | `text-base md:text-lg` |
| Caption | `text-sm` |
| Label | `text-xs uppercase tracking-widest` |

## 动效系统（[app.css](../../apps/web/src/app.css)）

### 动画类
| 类名 | 用途 |
|------|------|
| `animate-enter` | 元素入场（fade + slide up） |
| `animate-enter-scale` | 弹窗入场（fade + scale） |
| `animate-flash` | 提交后高亮闪烁 |
| `animate-pop` | 比分弹跳（scale 1.08x） |
| `status-dot` | 状态点脉冲（opacity 变化） |
| `press` | 按钮按压（active:scale-95） |
| `hover-lift` | 卡片悬停上浮 |
| `link-underline` | 链接下划线动画 |
| `skeleton` | 骨架屏加载 |

### 设计原则
- **单一 easing**：`cubic-bezier(0.22, 1, 0.36, 1)`
- **三档时长**：120ms（快）/ 180ms（基础）/ 280ms（慢）
- **只用 transform + opacity**（GPU 加速）
- **克制**：Linear 风格，不张扬

### 无障碍
- `prefers-reduced-motion` 支持
- `focus-visible` 环
- `skip-link` 跳转主内容
- `aria-live` / `aria-selected` / `aria-label`

## 组件

### Toast（[lib/components/Toast.svelte](../../apps/web/src/lib/components/Toast.svelte)）
```typescript
import { success, error, info } from '$lib/stores/toast.svelte';
success('赛程生成成功');
error('登录失败');
info('提示信息');
```

### Skeleton（[lib/components/Skeleton.svelte](../../apps/web/src/lib/components/Skeleton.svelte)）
```svelte
<Skeleton variant="tournament-card" />
<Skeleton variant="match-row" />
<Skeleton variant="stat-cell" />
```

## 关键页面说明

### 首页（`/`）
- SSR load 读取赛事列表（按 status 过滤）
- 卡片 stagger 入场
- 筛选按钮用 `goto()` 更新 URL 触发重新加载

### 赛事详情（`/tournaments/[id]`）
- Tab 切换：赛程 / 积分榜 / 对阵图
- 切换时显示 skeleton 加载态
- 循环赛/瑞士轮显示积分榜 tab

### 对阵图（`/tournaments/[id]/bracket`）
- 按 stage 分组渲染（胜者组/败者组/总决赛）
- 胜者 `font-black`，败者 `opacity-40`
- 进行中比赛左侧 2px 红色色条
- 冠军纯排版展示（大字号 + 标签）

### 比赛管理（`/admin/tournaments/[id]/matches`）
- 按 stage → round 分组
- 比分录入：每局选择胜者，提交后 count-pop 动效
- 状态显示：
  - `completed` → "已结束"
  - `pending` + 两队齐全 → "录入比分" 按钮
  - `pending` + 有 TBD → "待定" 标签

### 管理概览（`/admin`）
- 统计卡片：赛事总数、进行中、已结束、队伍总数
- stagger 入场 + `tabular-nums`

## 常见坑点

### 1. SSR 列表为空
- **原因**：用 `onMount` + 客户端 fetch，catch 静默吞错
- **修复**：用 `+page.ts` load 函数 SSR 获取数据

### 2. Toast 不显示
- **原因**：`const toasts = getToasts()` 不建立响应式订阅
- **修复**：`let toasts = $derived(getToasts())`

### 3. 字段名不匹配
- **原因**：Drizzle ORM 返回 camelCase，前端读 snake_case
- **修复**：兼容写法 `t.coverImage ?? t.cover_image`

### 4. 模块级 `$state` 导致 SSR 不一致
- **原因**：SSR 时 `currentUser` 为 null，客户端 hydrate 后才填充
- **修复**：用 `+layout.server.ts` + `data.user` 判断登录态

### 5. 导入 store 缺少扩展名
- **原因**：SvelteKit 要求 `.svelte.ts` 显式扩展名
- **修复**：`import { x } from '$lib/stores/auth.svelte'`
