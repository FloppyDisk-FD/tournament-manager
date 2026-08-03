import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Db } from '../db';
import { tournamentTeams, teams, tournaments } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { canManageTournament } from '../services/perm';

/** 队伍签到路由（/api/v1/tournaments/:id/checkins） */
export const checkinRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
checkinRoutes.use('*', authMiddleware, requireAuth);
checkinRoutes.use('/:id/*', async (c, next) => { requireUuid(c.req.param('id'), '赛事'); await next(); });

/** 查询赛事下全部队伍的签到状态（含队伍信息） */
async function listCheckins(db: Db, tournamentId: string) {
  return db.select({
    entry: tournamentTeams,
    team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl, logoEmoji: teams.logoEmoji, ownerId: teams.ownerId },
  })
    .from(tournamentTeams)
    .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
    .where(eq(tournamentTeams.tournamentId, tournamentId))
    .orderBy(tournamentTeams.seed);
}

// 签到状态列表 + 统计（赛事管理者/系统管理员）
checkinRoutes.get('/:id/checkins', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const db = c.get('db');
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权查看该赛事', 403);

  const rows = await listCheckins(db, id);
  const checkedCount = rows.filter((r) => r.entry.checkedIn).length;
  return c.json({
    teams: rows.map((r) => ({
      entryId: r.entry.id,
      teamId: r.team.id,
      name: r.team.name,
      logoUrl: r.team.logoUrl,
      logoEmoji: r.team.logoEmoji,
      seed: r.entry.seed,
      checkedIn: r.entry.checkedIn,
      checkedInAt: r.entry.checkedInAt,
    })),
    stats: { total: rows.length, checked: checkedCount },
  });
});

// 我的参赛队伍 + 签到状态（扫码签到页用，后端按登录身份鉴权）
checkinRoutes.get('/:id/checkins/mine', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');
  const rows = await db.select({
    entry: tournamentTeams,
    team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl, logoEmoji: teams.logoEmoji },
  })
    .from(tournamentTeams)
    .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
    .where(and(eq(tournamentTeams.tournamentId, id), eq(teams.ownerId, user.id)));
  return c.json(rows.map((r) => ({
    teamId: r.team.id,
    name: r.team.name,
    logoUrl: r.team.logoUrl,
    logoEmoji: r.team.logoEmoji,
    seed: r.entry.seed,
    checkedIn: r.entry.checkedIn,
    checkedInAt: r.entry.checkedInAt,
  })));
});

// 主办方标记/取消签到（toggle）
checkinRoutes.post('/:id/checkins/team/:teamId', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const teamId = requireUuid(c.req.param('teamId'), '队伍');
  const db = c.get('db');
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);

  const [entry] = await db.select().from(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId))).limit(1);
  if (!entry) throw new AppError('NOT_FOUND', '队伍不在该赛事中', 404);

  const checkedIn = !entry.checkedIn;
  await db.update(tournamentTeams).set({
    checkedIn,
    checkedInAt: checkedIn ? new Date() : null,
  }).where(eq(tournamentTeams.id, entry.id));

  return c.json({ message: checkedIn ? '已签到' : '已取消签到', checkedIn });
});

// 队长自助签到：队伍 owner 且队伍在该赛事
checkinRoutes.post('/:id/checkins/self/:teamId', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const teamId = requireUuid(c.req.param('teamId'), '队伍');
  const user = c.get('user')!;
  const db = c.get('db');

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new AppError('NOT_FOUND', '队伍不存在', 404);
  if (team.ownerId !== user.id) throw new AppError('FORBIDDEN', '只能为自己拥有的队伍签到', 403);

  const [entry] = await db.select().from(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), eq(tournamentTeams.teamId, teamId))).limit(1);
  if (!entry) throw new AppError('NOT_FOUND', '队伍不在该赛事中', 404);

  const checkedIn = !entry.checkedIn;
  await db.update(tournamentTeams).set({
    checkedIn,
    checkedInAt: checkedIn ? new Date() : null,
  }).where(eq(tournamentTeams.id, entry.id));

  return c.json({ message: checkedIn ? '签到成功' : '已取消签到', checkedIn });
});
