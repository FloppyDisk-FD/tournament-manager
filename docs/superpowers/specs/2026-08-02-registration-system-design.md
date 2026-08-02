# 报名系统设计（含站内通知 / 取消报名）

日期：2026-08-02
状态：已批准（登录后报名 + 固定字段 MVP + 站内通知 + pending 可取消）

## 目标

把"主办方单方面添加队伍"升级为"选手自助报名 + 主办方审核"：
- 登录用户提交报名（队伍名 + Logo + 选手名单）→ pending → admin 审核通过/拒绝
- 状态变化通过站内通知告知报名人
- pending 状态下报名人可自行取消

## 数据模型（新增 2 张表）

```
registrations
  id, tournament_id(FK), user_id(FK 报名人)
  team_name, logo_emoji, logo_url
  players: jsonb（[{player_name, player_role, game_id, avatar_url, is_captain}]）
  status: pending / approved / rejected
  note: text（拒绝原因）
  created_at, reviewed_at

notifications
  id, user_id(FK), type, title, message, link
  read: boolean, created_at
```

## API

### registrations 路由（新 routes/registrations.ts）
| 端点 | 权限 | 行为 |
|---|---|---|
| POST /tournaments/:id/registrations | 登录 | 校验 draft / 未满员 / 未重复 → 插入 pending → 发通知（报名已提交） |
| GET /tournaments/:id/registrations | 登录 | admin 全部；普通用户仅自己的 |
| GET /tournaments/:id/registrations/mine | 登录 | 我的报名状态 |
| POST .../:rid/approve | admin | 事务：创建 team + teamPlayers + tournamentTeams → approved → 通知报名人 |
| POST .../:rid/reject | admin | rejected + note → 通知报名人（含原因） |
| DELETE .../:rid | 报名本人 | 仅 pending 可取消（删除记录） |

### notifications 路由（新 routes/notifications.ts）
| 端点 | 权限 |
|---|---|
| GET /notifications | 我的通知（未读在前） |
| GET /notifications/unread-count | 未读数 |
| POST /notifications/:id/read | 标记已读 |
| POST /notifications/read-all | 全部已读 |

## 前端

- 公开赛事详情页：draft 且未满员 → "报名参赛"表单（队名 + Logo + 选手名单增删）；报名后显示状态徽章（待审核/已通过/已拒绝+原因）；pending 可"取消报名"
- admin 赛事详情页："报名审核"区块（pending 列表 + 通过/拒绝，拒绝填原因）
- 全局导航（+layout.svelte）：铃铛图标 + 未读角标 → 下拉通知列表 + 标记已读/全部已读
- constants：REGISTRATION_STATUS_MAP、通知类型文案

## 边界

- 满员判定：已入队 + pending/approved 报名数 ≥ maxTeams
- 重复报名：同一用户同一赛事仅一条 pending/approved
- 非 draft 赛事拒绝新报名；approve 时二次校验
- 取消：仅 pending；approved 需联系主办方退赛（留后续）

## 不做（YAGNI）

自定义报名字段、报名费/支付、通知推送（邮件/微信）、取消报名后的退赛流程
