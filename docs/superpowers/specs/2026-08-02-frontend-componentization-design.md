# 前端组件化设计（通用组件 + 逻辑抽取）

日期：2026-08-02
状态：已批准（范围：抽取 + 全站替换）

## 背景与目标

前端目前只有 3 个组件（`Button` / `Skeleton` / `Toast`），页面间存在大量复制的 UI 模式与业务映射逻辑，后续功能开发（签到、报名、通知等）将不断新增页面，重复会持续膨胀。本次组件化的目标是：

- 抽取通用展示组件，替换现有页面的重复模式，消除复制粘贴
- 将业务映射逻辑（状态/赛制文案、日期格式化）收敛为独立模块，供组件与页面复用
- 为后续功能迭代提供统一、可复用的组件基础

## 现状统计（重复模式证据）

| 模式 | 出现量 |
|---|---|
| 卡片 `border border-black bg-white` | 26 处 |
| 空状态（暂无/尚未/请先返回） | 16 处 |
| 输入框 `px-3 py-2 text-sm bg-white focus:outline-none` | 10 处 |
| 返回链接 | 7 处 |
| `statusMap` 复制定义 | 6 份 |
| `formatMap` 复制定义 | 5 份 |

## 组件清单（约 10 个，全部纯展示、收 props）

| 组件 | 职责 | 关键 props |
|---|---|---|
| `Card` | 黑边框白底容器 | `class`、`hover`(bool)、children |
| `Input` | 输入框统一 | `bind:value`、`type`、`placeholder`、`class`、rest props |
| `Select` | 下拉框统一 | `bind:value`、options、class |
| `Label` | 表单标签 | `for`、children |
| `StatusBadge` | 状态徽章（读 constants statusMap） | `status` |
| `EmptyState` | 空状态（图标+标题+描述） | `icon`(component)、`title`、`description` |
| `PageHeader` | 页头（标题+副标题+右侧操作区） | `title`、`subtitle`、`en`、children(操作区) |
| `StatCard` | 统计卡片 | `label`、`value`、`accent`(bool) |
| `BackLink` | 返回链接 | `href`、children |
| `Button` | 已有组件，保留不动 | — |

## 逻辑模块

```
$lib/constants/tournament.ts   → formatMap、statusMap（含徽章配色 class）
$lib/utils/format.ts           → formatDate()、formatDateTime()
```

- `statusMap`：draft/ongoing/completed/cancelled → 中文文案 + 徽章配色（从现有 6 份实现中取一致版本收敛）
- `formatMap`：4 种赛制 → 中文文案
- 所有组件**不内联业务映射**，一律从 constants/utils 导入（关注点分离）

## 目录结构

```
apps/web/src/lib/
  components/   现有 Button/Skeleton/Toast + 新增组件 + index.ts（barrel 统一导出）
  constants/    tournament.ts（新增）
  utils/        format.ts（新增）、normalize.ts（已有）
```

## 迁移策略

1. 先建 `constants` 与 `utils/format`，再建组件（组件依赖逻辑模块）
2. 逐页替换：9 个路由页面（admin 概览 / 赛事列表 / 创建赛事 / 赛事详情 / 比赛管理 / 队伍库 / 赛事内队伍 / 赛事详情公开页 / 队伍详情公开页）的重复模式换成组件
3. **每替换完一页跑一次 `svelte-check` 验证**，无新增错误再继续
4. 最后全量 `vite build` + 人工核对 git diff 确认视觉 class 等价

## 范围边界（不做的事）

- 不碰布局级代码：导航栏、侧边栏（留在 `+layout.svelte`，不抽组件）
- 不强行拆分赛程图内部结构（elim / rr / swiss 三种视图结构特殊，仅抽可复用片段如比赛卡片）
- 不引入新依赖、不改变任何交互行为
- 纯重构：替换后视觉与重构前一致

## 风险控制

- 组件全部为纯展示（无业务状态），替换零行为变更
- 逐页验证 + 最终 build
- git 可完整回退
