import { Hono } from 'hono';
import { eq, ilike, and, sql, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { tournaments, stages, matches, games, standings, tournamentTeams } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { canCreateTournament, canManageTournament } from '../services/perm';

export const tournamentRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();

// 全局中间件：解析 cookie 挂载 user
tournamentRoutes.use('*', authMiddleware);

// ========== 公开路由 ==========
tournamentRoutes.get('/', async (c) => {
  const query = c.req.query();
  const user = c.get('user');
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query.status) conditions.push(eq(tournaments.status, query.status as any));
  if (query.game) conditions.push(ilike(tournaments.game, `%${query.game}%`));
  // 我的赛事：赛事管理者只看自己创建的（admin 看全部）
  if (query.mine === '1' && user && user.role !== 'admin') {
    conditions.push(eq(tournaments.createdBy, user.id));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    c.get('db').select().from(tournaments).where(where).limit(limit).offset(offset).orderBy(sql`${tournaments.createdAt} DESC`),
    c.get('db').select({ count: sql<number>`count(*)` }).from(tournaments).where(where),
  ]);

  return c.json({
    items,
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

tournamentRoutes.get('/:id', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  return c.json(tournament);
});

// ========== 管理员路由 ==========
tournamentRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  if (!canCreateTournament(user)) {
    throw new AppError('FORBIDDEN', '需要赛事管理者或系统管理员权限', 403);
  }
  const data = await c.req.json();
  const [tournament] = await c.get('db').insert(tournaments).values({
    name: data.name,
    description: data.description || '',
    game: data.game,
    format: data.format,
    teamSize: data.team_size || 5,
    maxTeams: data.max_teams || 16,
    boCount: data.bo_count || 3,
    hasGroupStage: data.has_group_stage || false,
    groupCount: data.group_count,
    advancePerGroup: data.advance_per_group,
    thirdPlace: data.third_place || false,
    swissRounds: data.swiss_rounds,
    formatConfig: data.format_config,
    coverImage: data.cover_image || data.coverImage,
    liveUrl: data.live_url,
    entryFee: data.entry_fee ?? 0,
    createdBy: user.id,
  }).returning();

  c.status(201);
  return c.json(tournament);
});

tournamentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法修改');
  }

  const data = await c.req.json();
  const [updated] = await c.get('db').update(tournaments).set({
    name: data.name,
    description: data.description,
    game: data.game,
    format: data.format,
    teamSize: data.team_size,
    maxTeams: data.max_teams,
    boCount: data.bo_count,
    hasGroupStage: data.has_group_stage,
    groupCount: data.group_count,
    advancePerGroup: data.advance_per_group,
    thirdPlace: data.third_place,
    swissRounds: data.swiss_rounds,
    formatConfig: data.format_config,
    coverImage: data.cover_image,
    liveUrl: data.live_url,
    entryFee: data.entry_fee,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
  }).where(eq(tournaments.id, id)).returning();

  return c.json(updated);
});

tournamentRoutes.put('/:id/live', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  const data = await c.req.json();
  const [updated] = await c.get('db').update(tournaments)
    .set({ liveUrl: data.live_url ?? null })
    .where(eq(tournaments.id, id))
    .returning();
  return c.json(updated);
});

// 报名费设置（仅 draft 期可改，报名开始后锁定）
tournamentRoutes.put('/:id/fee', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  if (existing.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，报名费不可修改', 400);
  const data = await c.req.json();
  const fee = Number(data.entry_fee ?? 0);
  if (!Number.isFinite(fee) || fee < 0) throw new AppError('INVALID_INPUT', '报名费无效', 400);
  const [updated] = await c.get('db').update(tournaments)
    .set({ entryFee: Math.round(fee) })
    .where(eq(tournaments.id, id)).returning();
  return c.json(updated);
});

tournamentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法删除');
  }
  // 级联删除所有关联数据
  const stageRows = await c.get('db').select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, id));
  if (stageRows.length > 0) {
    const stageIds = stageRows.map((s) => s.id);
    const matchRows = await c.get('db').select({ id: matches.id }).from(matches).where(inArray(matches.stageId, stageIds));
    if (matchRows.length > 0) {
      const matchIds = matchRows.map((m) => m.id);
      await c.get('db').update(matches).set({ nextMatchId: null, nextLosersMatchId: null }).where(inArray(matches.id, matchIds));
      await c.get('db').delete(games).where(inArray(games.matchId, matchIds));
    }
    await c.get('db').delete(standings).where(inArray(standings.stageId, stageIds));
    await c.get('db').delete(matches).where(inArray(matches.stageId, stageIds));
    await c.get('db').delete(stages).where(inArray(stages.id, stageIds));
  }
  await c.get('db').delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
  await c.get('db').delete(tournaments).where(eq(tournaments.id, id));
  return c.json({ message: '赛事已删除' });
});
