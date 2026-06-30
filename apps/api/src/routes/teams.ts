import { Elysia } from 'elysia';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { teams, teamPlayers, tournaments, tournamentTeams } from '../db/schema';
import { AppError } from '../middleware/error';
import { authPlugin, requireAdmin } from '../middleware/auth';

// 全局队伍库路由（/api/v1/teams）
export const globalTeamRoutes = new Elysia({ prefix: '/api/v1/teams' })
  .use(authPlugin)
  .use(requireAdmin)
  // 列出所有全局队伍（tournamentId 为 null）+ 关联选手
  .get('/', async () => {
    const allTeams = await db.select().from(teams).where(isNull(teams.tournamentId));
    const teamIds = allTeams.map((t) => t.id);
    if (teamIds.length === 0) return [];
    const players = await db.select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
    const playersByTeam = new Map<string, typeof players>();
    for (const p of players) {
      const arr = playersByTeam.get(p.teamId) ?? [];
      arr.push(p);
      playersByTeam.set(p.teamId, arr);
    }
    return allTeams.map((t) => ({ ...t, players: playersByTeam.get(t.id) ?? [] }));
  })
  // 创建全局队伍
  .post('/', async ({ body, set }) => {
    const data = body as any;
    const [team] = await db.insert(teams).values({
      name: data.name,
      logoUrl: data.logo_url,
      logoEmoji: data.logo_emoji,
      tournamentId: null as any,
    }).returning();

    if (data.players && Array.isArray(data.players) && data.players.length > 0) {
      await db.insert(teamPlayers).values(
        data.players.map((p: any) => ({
          teamId: team.id,
          playerName: p.player_name,
          playerRole: p.player_role,
          gameId: p.game_id,
          avatarEmoji: p.avatar_emoji,
          isCaptain: p.is_captain ?? false,
        })),
      );
    }
    set.status = 201;
    return team;
  })
  // 更新全局队伍（含选手）
  .put('/:teamId', async ({ params, body }) => {
    const data = body as any;
    const [updated] = await db.update(teams).set({
      name: data.name,
      logoUrl: data.logo_url,
      logoEmoji: data.logo_emoji,
    }).where(and(eq(teams.id, params.teamId), isNull(teams.tournamentId))).returning();
    if (!updated) throw new AppError('NOT_FOUND', '队伍不存在', 404);

    // 选手更新：全量替换
    if (data.players && Array.isArray(data.players)) {
      await db.delete(teamPlayers).where(eq(teamPlayers.teamId, params.teamId));
      if (data.players.length > 0) {
        await db.insert(teamPlayers).values(
          data.players.map((p: any) => ({
            teamId: params.teamId,
            playerName: p.player_name,
            playerRole: p.player_role,
            gameId: p.game_id,
            avatarEmoji: p.avatar_emoji,
            isCaptain: p.is_captain ?? false,
          })),
        );
      }
    }
    return updated;
  })
  .delete('/:teamId', async ({ params }) => {
    const [existing] = await db.select().from(teams).where(and(eq(teams.id, params.teamId), isNull(teams.tournamentId))).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', '队伍不存在', 404);
    await db.delete(teamPlayers).where(eq(teamPlayers.teamId, params.teamId));
    await db.delete(tournamentTeams).where(eq(tournamentTeams.teamId, params.teamId));
    await db.delete(teams).where(eq(teams.id, params.teamId));
    return { message: '队伍已删除' };
  });

// 赛事内队伍路由（/api/v1/tournaments/:id/teams）
export const teamRoutes = new Elysia({ prefix: '/api/v1/tournaments/:id/teams' })
  .use(authPlugin)
  // 列出赛事队伍（JOIN tournament_teams + teams + players）
  .get('/', async ({ params }) => {
    const rows = await db.select({
      entry: tournamentTeams,
      team: teams,
    })
      .from(tournamentTeams)
      .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
      .where(eq(tournamentTeams.tournamentId, params.id));

    if (rows.length === 0) return [];
    const teamIds = rows.map((r) => r.team.id);
    const players = await db.select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
    const playersByTeam = new Map<string, typeof players>();
    for (const p of players) {
      const arr = playersByTeam.get(p.teamId) ?? [];
      arr.push(p);
      playersByTeam.set(p.teamId, arr);
    }
    return rows.map((r) => ({
      id: r.team.id,
      name: r.team.name,
      logo_url: r.team.logoUrl,
      logo_emoji: r.team.logoEmoji,
      seed: r.entry.seed,
      status: r.entry.status,
      group_label: r.entry.groupLabel,
      players: playersByTeam.get(r.team.id) ?? [],
    }));
  })
  .use(requireAdmin)
  // 从全局队伍库批量加入赛事
  .post('/import', async ({ params, body, set }) => {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
    if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

    const data = body as { team_ids: string[] };
    if (!data.team_ids || data.team_ids.length === 0) throw new AppError('INVALID_INPUT', '未选择队伍');

    const existingEntries = await db.select().from(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, params.id), inArray(tournamentTeams.teamId, data.team_ids)));
    const existingIds = new Set(existingEntries.map((e) => e.teamId));
    const newTeamIds = data.team_ids.filter((id) => !existingIds.has(id));

    const currentCount = (await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, params.id))).length;
    if (currentCount + newTeamIds.length > tournament.maxTeams) {
      throw new AppError('TEAM_LIMIT_EXCEEDED', '加入会超出队伍上限');
    }

    if (newTeamIds.length === 0) {
      set.status = 200;
      return { message: '队伍已在赛事中', added: 0 };
    }

    const inserted = await db.insert(tournamentTeams).values(
      newTeamIds.map((id, i) => ({
        tournamentId: params.id,
        teamId: id,
        seed: currentCount + i + 1,
      })),
    ).returning();

    set.status = 201;
    return { message: '队伍已加入赛事', added: inserted.length };
  })
  // 快速创建临时队伍并加入赛事（不进全局库）
  .post('/', async ({ params, body, set }) => {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
    if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

    const data = body as any;
    const teamCount = (await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, params.id))).length;
    if (teamCount >= tournament.maxTeams) throw new AppError('TEAM_LIMIT_EXCEEDED', '队伍数已达上限');

    // 创建队伍（绑定 tournamentId，兼容旧逻辑）+ 关联表
    const [team] = await db.insert(teams).values({
      tournamentId: params.id,
      name: data.name,
      logoUrl: data.logo_url,
      logoEmoji: data.logo_emoji,
    }).returning();
    await db.insert(tournamentTeams).values({
      tournamentId: params.id,
      teamId: team.id,
      seed: teamCount + 1,
    });

    if (data.players && Array.isArray(data.players) && data.players.length > 0) {
      await db.insert(teamPlayers).values(
        data.players.map((p: any) => ({
          teamId: team.id,
          playerName: p.player_name,
          playerRole: p.player_role,
          gameId: p.game_id,
          avatarEmoji: p.avatar_emoji,
          isCaptain: p.is_captain ?? false,
        })),
      );
    }

    set.status = 201;
    return team;
  })
  .post('/batch', async ({ params, body, set }) => {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).limit(1);
    if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
    if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

    const data = body as { names: string[] };
    if (!data.names || data.names.length === 0) throw new AppError('INVALID_INPUT', '队伍名称不能为空');
    const teamCount = (await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, params.id))).length;
    if (teamCount + data.names.length > tournament.maxTeams) {
      throw new AppError('TEAM_LIMIT_EXCEEDED', '批量添加会超出队伍上限');
    }

    const inserted = await db.insert(teams).values(
      data.names.map((name) => ({
        tournamentId: params.id,
        name,
      })),
    ).returning();
    await db.insert(tournamentTeams).values(
      inserted.map((t, i) => ({
        tournamentId: params.id,
        teamId: t.id,
        seed: teamCount + i + 1,
      })),
    );

    set.status = 201;
    return inserted;
  })
  .put('/:teamId', async ({ params, body }) => {
    const data = body as any;
    // 更新队伍基本信息
    const [updated] = await db.update(teams).set({
      name: data.name,
      logoUrl: data.logo_url,
      logoEmoji: data.logo_emoji,
    }).where(eq(teams.id, params.teamId)).returning();
    if (!updated) throw new AppError('NOT_FOUND', '队伍不存在', 404);

    // 更新赛事内 seed/status
    if (data.seed !== undefined || data.status || data.group_label !== undefined) {
      await db.update(tournamentTeams).set({
        seed: data.seed,
        status: data.status,
        groupLabel: data.group_label,
      }).where(and(eq(tournamentTeams.teamId, params.teamId), eq(tournamentTeams.tournamentId, params.id)));
    }

    // 选手更新：全量替换
    if (data.players && Array.isArray(data.players)) {
      await db.delete(teamPlayers).where(eq(teamPlayers.teamId, params.teamId));
      if (data.players.length > 0) {
        await db.insert(teamPlayers).values(
          data.players.map((p: any) => ({
            teamId: params.teamId,
            playerName: p.player_name,
            playerRole: p.player_role,
            gameId: p.game_id,
            avatarEmoji: p.avatar_emoji,
            isCaptain: p.is_captain ?? false,
          })),
        );
      }
    }
    return updated;
  })
  .delete('/:teamId', async ({ params }) => {
    // 从赛事移除（不删全局队伍，除非它绑定了该赛事）
    const [entry] = await db.select().from(tournamentTeams)
      .where(and(eq(tournamentTeams.teamId, params.teamId), eq(tournamentTeams.tournamentId, params.id))).limit(1);
    if (!entry) throw new AppError('NOT_FOUND', '队伍不在此赛事中', 404);

    await db.delete(tournamentTeams).where(eq(tournamentTeams.id, entry.id));

    // 如果队伍绑定了此赛事（旧数据），删除它及其选手
    const [team] = await db.select().from(teams).where(eq(teams.id, params.teamId)).limit(1);
    if (team && team.tournamentId === params.id) {
      await db.delete(teamPlayers).where(eq(teamPlayers.teamId, params.teamId));
      await db.delete(teams).where(eq(teams.id, params.teamId));
    }
    return { message: '队伍已移除' };
  });
