import { Elysia } from 'elysia';
import { eq, ilike, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { tournaments, stages, matches, games, standings, tournamentTeams, teamPlayers } from '../db/schema';
import { AppError } from '../middleware/error';
import { authPlugin, requireAdmin } from '../middleware/auth';

export const tournamentRoutes = new Elysia({ prefix: '/api/v1/tournaments' })
  .use(authPlugin)
  .get('/', async ({ query }) => {
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

    return {
      items,
      total: Number(countResult[0].count),
      page,
      limit,
    };
  })
  .get('/:id', async ({ params }) => {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!tournament) {
      throw new AppError('NOT_FOUND', '赛事不存在', 404);
    }
    return tournament;
  })
  .use(requireAdmin)
  .post('/', async ({ body, user, set }) => {
    const data = body as any;
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

    set.status = 201;
    return tournament;
  })
  .put('/:id', async ({ params, body, user }) => {
    const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!existing) {
      throw new AppError('NOT_FOUND', '赛事不存在', 404);
    }
    if (existing.status !== 'draft') {
      throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法修改');
    }

    const data = body as any;
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
    }).where(eq(tournaments.id, params.id)).returning();

    return updated;
  })
  .delete('/:id', async ({ params }) => {
    const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!existing) {
      throw new AppError('NOT_FOUND', '赛事不存在', 404);
    }
    if (existing.status !== 'draft') {
      throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法删除');
    }
    // 级联删除所有关联数据
    const stageRows = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, params.id));
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
    // 删除赛事队伍关联（tournamentTeams）
    await db.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, params.id));
    await db.delete(tournaments).where(eq(tournaments.id, params.id));
    return { message: '赛事已删除' };
  });
