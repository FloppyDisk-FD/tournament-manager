import { Hono } from 'hono';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { registrations, tournaments, teams, teamPlayers, tournamentTeams, users, payments } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { canManageTournament } from '../services/perm';
import { notify } from '../services/notify';

/** 选手自助报名路由（/api/v1/tournaments/:id/registrations） */
export const registrationRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
registrationRoutes.use('*', authMiddleware, requireAuth);
registrationRoutes.use('/:id/*', async (c, next) => { requireUuid(c.req.param('id'), '赛事'); await next(); });

/** 计算某赛事已占用队伍数（已入队 + 待审/已通过报名） */
async function occupiedCount(db: Db, tournamentId: string) {
  const [teamCount] = await db.select({ n: sql<number>`count(*)` }).from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournamentId));
  const [regCount] = await db.select({ n: sql<number>`count(*)` }).from(registrations)
    .where(and(
      eq(registrations.tournamentId, tournamentId),
      inArray(registrations.status, ['pending', 'approved']),
    ));
  return Number(teamCount?.n ?? 0) + Number(regCount?.n ?? 0);
}

// 报名（登录用户，从自己拥有的队伍中选择）
registrationRoutes.post('/:id/registrations', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_CLOSED', '赛事不在报名期', 400);

  const body = await c.req.json() as { team_id?: string };
  const teamId = body.team_id;
  if (!teamId) throw new AppError('INVALID_INPUT', '请选择队伍', 400);

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new AppError('NOT_FOUND', '队伍不存在', 404);
  if (team.ownerId !== user.id) throw new AppError('FORBIDDEN', '只能使用自己拥有的队伍报名', 403);
  if (team.tournamentId) throw new AppError('INVALID_INPUT', '该队伍已加入其它赛事，无法报名', 400);

  // 队伍是否已在该赛事
  const [existingEntry] = await db.select().from(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId))).limit(1);
  if (existingEntry) throw new AppError('ALREADY_REGISTERED', '该队伍已在赛事中', 400);

  // 同一用户同一赛事仅一条 pending/approved 报名
  const dup = await db.select().from(registrations)
    .where(and(
      eq(registrations.tournamentId, id),
      eq(registrations.userId, user.id),
      inArray(registrations.status, ['pending', 'approved']),
    )).limit(1);
  if (dup.length > 0) throw new AppError('ALREADY_REGISTERED', '你已报名过该赛事', 400);

  // 满员校验
  if (await occupiedCount(db, id) >= tournament.maxTeams) {
    throw new AppError('TEAM_LIMIT_EXCEEDED', '赛事队伍名额已满', 400);
  }

  const players = await db.select().from(teamPlayers).where(eq(teamPlayers.teamId, teamId));
  const [reg] = await db.insert(registrations).values({
    tournamentId: id,
    userId: user.id,
    teamId,
    teamName: team.name,
    logoEmoji: team.logoEmoji,
    logoUrl: team.logoUrl,
    players: players as any,
  }).returning();

  // 报名费 > 0：同步生成支付订单（模拟网关，provider='mock'）
  let payment = null;
  if (tournament.entryFee > 0) {
    [payment] = await db.insert(payments).values({
      registrationId: reg.id,
      tournamentId: id,
      userId: user.id,
      amount: tournament.entryFee,
      provider: 'mock',
    }).returning();
  }

  await notify(db, user.id, 'registration', '报名已提交',
    `《${tournament.name}》报名已提交，队伍「${team.name}」${payment ? '请完成支付后等待审核。' : '等待主办方审核。'}`, `/tournaments/${id}`, c.env);

  c.status(201);
  return c.json({ ...reg, payment });
});

// 报名列表：赛事管理者/系统管理员看全部，普通用户仅自己的
registrationRoutes.get('/:id/registrations', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  const where = canManageTournament(user, tournament)
    ? eq(registrations.tournamentId, id)
    : and(eq(registrations.tournamentId, id), eq(registrations.userId, user.id));

  const rows = await db.select({
    registration: registrations,
    payment: payments,
    user: { id: users.id, username: users.username },
  })
    .from(registrations)
    .leftJoin(users, eq(users.id, registrations.userId))
    .leftJoin(payments, eq(payments.registrationId, registrations.id))
    .where(where)
    .orderBy(registrations.createdAt);

  return c.json(rows.map((r) => ({
    ...r.registration,
    applicant: r.user ? { id: r.user.id, username: r.user.username } : null,
    payment: r.payment ?? null,
  })));
});

// 我的报名（公开详情页状态展示）
registrationRoutes.get('/:id/registrations/mine', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const rows = await c.get('db').select({ registration: registrations, payment: payments })
    .from(registrations)
    .leftJoin(payments, eq(payments.registrationId, registrations.id))
    .where(and(eq(registrations.tournamentId, id), eq(registrations.userId, user.id)))
    .orderBy(registrations.createdAt);
  return c.json(rows.map((r) => ({ ...r.registration, payment: r.payment ?? null })));
});

// 取消报名（本人，仅 pending）
registrationRoutes.delete('/:id/registrations/:rid', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const rid = requireUuid(c.req.param('rid'), '报名');
  const user = c.get('user')!;

  const [reg] = await c.get('db').select().from(registrations)
    .where(and(eq(registrations.id, rid), eq(registrations.tournamentId, id), eq(registrations.userId, user.id)))
    .limit(1);
  if (!reg) throw new AppError('NOT_FOUND', '报名不存在', 404);
  if (reg.status !== 'pending') throw new AppError('CANNOT_CANCEL', '仅待审核的报名可取消', 400);

  // 已支付报名需先退款，禁止直接取消
  const [pay] = await c.get('db').select().from(payments).where(eq(payments.registrationId, rid)).limit(1);
  if (pay && pay.status === 'paid') throw new AppError('PAYMENT_PAID', '该报名已支付，取消请联系主办方', 400);

  await c.get('db').delete(registrations).where(eq(registrations.id, rid));
  return c.json({ message: '报名已取消' });
});

// ===== 审核（赛事管理者或系统管理员） =====
registrationRoutes.use('/:id/registrations/:rid/*', async (c, next) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!canManageTournament(user, tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  await next();
});

// 通过：把队伍加入赛事（队伍已存在，复用）
registrationRoutes.post('/:id/registrations/:rid/approve', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const rid = requireUuid(c.req.param('rid'), '报名');
  const db = c.get('db');

  const [reg] = await db.select().from(registrations)
    .where(and(eq(registrations.id, rid), eq(registrations.tournamentId, id))).limit(1);
  if (!reg) throw new AppError('NOT_FOUND', '报名不存在', 404);
  if (reg.status !== 'pending') throw new AppError('ALREADY_REVIEWED', '该报名已处理', 400);

  // 收费赛事：未完成支付不可通过
  const [pay] = await db.select().from(payments).where(eq(payments.registrationId, rid)).limit(1);
  if (pay && pay.status !== 'paid') throw new AppError('PAYMENT_REQUIRED', '该报名尚未完成支付', 400);

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_CLOSED', '赛事不在报名期', 400);
  if (await occupiedCount(db, id) >= tournament.maxTeams) {
    throw new AppError('TEAM_LIMIT_EXCEEDED', '赛事队伍名额已满', 400);
  }

  if (!reg.teamId) throw new AppError('INVALID_INPUT', '报名缺少队伍', 400);
  const teamId = reg.teamId;

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new AppError('NOT_FOUND', '队伍已不存在', 404);

  await db.transaction(async (tx) => {
    const [existingEntry] = await tx.select().from(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId))).limit(1);
    if (!existingEntry) {
      const [entry] = await tx.select({ n: sql<number>`count(*)` }).from(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, id));
      await tx.insert(tournamentTeams).values({
        tournamentId: id,
        teamId,
        seed: Number(entry?.n ?? 0) + 1,
      });
    }
    await tx.update(registrations).set({ status: 'approved', reviewedAt: new Date() })
      .where(eq(registrations.id, rid));
  });

  await notify(db, reg.userId, 'registration', '报名已通过',
    `《${tournament.name}》报名已通过，队伍「${team.name}」已加入赛事。`, `/tournaments/${id}`, c.env);

  return c.json({ message: '报名已通过', teamId: reg.teamId });
});

// 拒绝
registrationRoutes.post('/:id/registrations/:rid/reject', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const rid = requireUuid(c.req.param('rid'), '报名');
  const db = c.get('db');

  const [reg] = await db.select().from(registrations)
    .where(and(eq(registrations.id, rid), eq(registrations.tournamentId, id))).limit(1);
  if (!reg) throw new AppError('NOT_FOUND', '报名不存在', 404);
  if (reg.status !== 'pending') throw new AppError('ALREADY_REVIEWED', '该报名已处理', 400);

  const body = await c.req.json().catch(() => ({})) as { note?: string };
  await db.update(registrations).set({
    status: 'rejected',
    note: (body.note ?? '').trim() || null,
    reviewedAt: new Date(),
  }).where(eq(registrations.id, rid));

  await notify(db, reg.userId, 'registration', '报名被拒绝',
    `《${reg.teamName}》报名未通过${body.note ? `：${body.note}` : ''}。`, `/tournaments/${id}`, c.env);

  return c.json({ message: '报名已拒绝' });
});
