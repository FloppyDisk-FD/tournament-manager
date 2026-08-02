# 角色权限体系 + 报名改造设计

日期：2026-08-02
状态：已批准（方案 A：赛事管理者复用 /admin）

## 角色模型

```
admin（系统管理员）—— 最高权限，管理一切
tournament_manager（赛事管理者）—— 管理自己创建的赛事（tournaments.created_by）
team_manager（队伍管理员）—— 管理自己拥有的队伍（teams.owner_id）
user（普通用户）—— 浏览 + 用自己队伍报名
```

注册时三选一：赛事管理者 / 队伍管理员 / 普通用户（admin 仅系统脚本/既有账号）。

## 数据模型改动（迁移）

- `users.role` 枚举扩展：`admin | tournament_manager | team_manager | user`
- `teams.owner_id` 新增列（FK users，可空）——队伍归属

## 权限判定（services/perm.ts）

| 操作 | 允许 |
|---|---|
| 系统级管理（全局队伍库、全部赛事） | admin |
| 创建赛事 | admin 或 tournament_manager（created_by = 创建者） |
| 管理赛事（审核报名/管理队伍/录比分） | admin 或 (tournament_manager 且 created_by = 我) |
| 创建队伍 | 任意登录用户（owner_id = 我） |
| 管理队伍（队员增删改） | admin 或 owner_id = 我（拥有即管理，不限角色） |
| 报名 | 登录用户，从自己拥有的队伍中选择 |

## 报名改造

- 报名提交 `{ team_id }`：从我的队伍（GET /my/teams）选择
- 无队伍 → 引导创建队伍（owner = 我）
- 审核通过 → 插入 tournamentTeams（复用已有队伍，不再新建）

## 前端

- 注册页：三个角色单选（radio 卡片）
- /admin 守卫：admin 或 tournament_manager；赛事列表只显示自己创建的；详情操作 API 校验 created_by
- 用户后台 /dashboard：我的报名 / 我的队伍（队员管理）/ 我的赛事（管理者入口）
- 导航：登录后"我的后台"入口
- 报名表单：下拉选择我的队伍

## 不做（YAGNI）

admin 指派赛事管理者、多管理员共管队伍、角色变更流程
