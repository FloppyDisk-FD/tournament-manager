import { Hono } from 'hono';
import { eq, ilike, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { tournaments, stages, matches, games, standings, tournamentTeams } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, requireAdmin } from '../middleware/auth';

export const tournamentRoutes = new Hono<{ Variables: { user: any | null } }>();

// 全局中间件：解析 cookie 挂载 user
tournamentRoutes.use('*', authMiddleware);

// ========== 公开路由 ==========
tournamentRoutes.get('/', async (c) => {
  const query = c.req.query();
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query.status) conditions.push(eq(tournaments.status, query.status as any));
  if (query.game) conditions.push(ilike(tournaments.game, `%${query.game}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db.select().from(tournaments).where(where).limit(limit).offset(offset).orderBy(sql`${tournaments.createdAt} DESC`),
    db.select({ count: sql<number>`count(*)` }).from(tournaments).where(where),
  ]);

  return c.json({
    items,
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

tournamentRoutes.get('/:id', async (c) => {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, c.req.param('id'))).limit(1);
  if (!tournament) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  return c.json(tournament);
});

// ========== 管理员路由 ==========
tournamentRoutes.post('/', requireAdmin, async (c) => {
  const data = await c.req.json();
  const user = c.get('user')!;
  const [tournament] = await db.insert(tournaments).values({
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
    createdBy: user.id,
  }).returning();

  c.status(201);
  return c.json(tournament);
});

tournamentRoutes.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法修改');
  }

  const data = await c.req.json();
  const [updated] = await db.update(tournaments).set({
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
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
  }).where(eq(tournaments.id, id)).returning();

  return c.json(updated);
});

tournamentRoutes.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法删除');
  }
  // 级联删除所有关联数据
  const stageRows = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, id));
  if (stageRows.length > 0) {
    const stageIds = stageRows.map((s) => s.id);
    const matchRows = await db.select({ id: matches.id }).from(matches).where(inArray(matches.stageId, stageIds));
    if (matchRows.length > 0) {
      const matchIds = matchRows.map((m) => m.id);
      await db.update(matches).set({ nextMatchId: null, nextLosersMatchId: null }).where(inArray(matches.id, matchIds));
      await db.delete(games).where(inArray(games.matchId, matchIds));
    }
    await db.delete(standings).where(inArray(standings.stageId, stageIds));
    await db.delete(matches).where(inArray(matches.stageId, stageIds));
    await db.delete(stages).where(inArray(stages.id, stageIds));
  }
  await db.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
  await db.delete(tournaments).where(eq(tournaments.id, id));
  return c.json({ message: '赛事已删除' });
});
