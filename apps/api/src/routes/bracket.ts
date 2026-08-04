import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../db';
import { tournaments, teams, stages, matches, games, standings, tournamentTeams } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { canManageTournament } from '../services/perm';
import { SingleElimGenerator } from '../generators/single-elimination';
import { DoubleElimGenerator } from '../generators/double-elimination';
import { SwissGenerator } from '../generators/swiss';
import { RoundRobinGenerator } from '../generators/round-robin';
import type { BracketSettings } from '../generators/types';

function getGenerator(format: string) {
  switch (format) {
    case 'single_elim': return new SingleElimGenerator();
    case 'double_elim': return new DoubleElimGenerator();
    case 'swiss': return new SwissGenerator();
    case 'round_robin': return new RoundRobinGenerator();
    default: throw new AppError('INVALID_FORMAT', `不支持的赛制: ${format}`);
  }
}

export const bracketRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
bracketRoutes.use('*', authMiddleware);
// 校验赛事 ID 为合法 UUID，避免非 UUID 字符串触发 DB 语法错误返回 500
bracketRoutes.use('/:id/*', async (c, next) => { requireUuid(c.req.param('id'), '赛事'); await next(); });

// ========== 公开路由 ==========
// 赛事回顾页数据（公开，分享用）
bracketRoutes.get('/:id/review', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const db = c.get('db');
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) throw new AppError('NOT_FOUND', '赛事不存在', 404);

  // 参赛队伍 + 种子
  const tt = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
  const teamIds = [...new Set(tt.map((x) => x.teamId))];
  const teamRows = teamIds.length ? await db.select().from(teams).where(inArray(teams.id, teamIds)) : [];
  const teamById = new Map(teamRows.map((x) => [x.id, x]));
  const seedByTeam = new Map(tt.map((x) => [x.teamId, x.seed]));

  // stages + matches
  const stageRows = await db.select().from(stages).where(eq(stages.tournamentId, id));
  const stageIds = stageRows.map((s) => s.id);
  const ms = stageIds.length ? await db.select().from(matches).where(inArray(matches.stageId, stageIds)) : [];
  const done = ms.filter((m) => m.status === 'completed' || m.status === 'walkthrough');

  // 每队胜负
  const record = new Map<string, { wins: number; losses: number }>();
  for (const m of done) {
    if (m.team1Id) {
      const r = record.get(m.team1Id) ?? { wins: 0, losses: 0 };
      if (m.winnerId === m.team1Id) r.wins += 1;
      else if (m.status === 'completed') r.losses += 1;
      record.set(m.team1Id, r);
    }
    if (m.team2Id) {
      const r = record.get(m.team2Id) ?? { wins: 0, losses: 0 };
      if (m.winnerId === m.team2Id) r.wins += 1;
      else if (m.status === 'completed') r.losses += 1;
      record.set(m.team2Id, r);
    }
  }

  // 最终排名
  let ranking: { label: string; teamId: string }[] = [];
  let championId: string | null = null;
  if (t.format === 'swiss' || t.format === 'round_robin') {
    const stds = await db.select().from(standings).where(eq(standings.tournamentId, id));
    stds.sort((a, b) => (b.points - a.points) || (b.gameDifference - a.gameDifference) || (b.wins - a.wins));
    stds.forEach((s, i) => {
      if (i === 0) championId = s.teamId;
      ranking.push({ label: String(i + 1), teamId: s.teamId });
    });
  } else {
    // 单败/双败：按淘汰轮次推导（冠军 → 决赛败者 → 半决赛败者…）
    const R = ms.reduce((mx, m) => Math.max(mx, m.round), 0);
    const finalMatch = ms.find((m) => m.round === R && m.status === 'completed' && m.winnerId && m.loserId);
    championId = finalMatch?.winnerId ?? null;
    const losersByRound = new Map<number, string[]>();
    for (const m of ms) {
      if (m.loserId && m.loserId !== championId) {
        const arr = losersByRound.get(m.round) ?? [];
        arr.push(m.loserId);
        losersByRound.set(m.round, arr);
      }
    }
    if (championId) ranking.push({ label: '1', teamId: championId });
    for (let r = R; r >= 1; r--) {
      const losers = losersByRound.get(r) ?? [];
      if (!losers.length) continue;
      const lo = 2 ** (R - r) + 1;
      const hi = 2 ** (R - r + 1);
      const label = lo === hi ? String(lo) : `${lo}-${hi}`;
      for (const teamId of losers) ranking.push({ label, teamId });
    }
  }

  const info = (tid: string | null) => {
    if (!tid) return null;
    const tm = teamById.get(tid);
    if (!tm) return null;
    const rec = record.get(tid) ?? { wins: 0, losses: 0 };
    return {
      teamId: tid,
      name: tm.name,
      logoEmoji: tm.logoEmoji,
      logoUrl: tm.logoUrl,
      seed: seedByTeam.get(tid) ?? null,
      wins: rec.wins,
      losses: rec.losses,
    };
  };

  // 数据亮点
  const totalScore = done.reduce((acc, m) => acc + (m.team1Score || 0) + (m.team2Score || 0), 0);
  const avgScore = done.length ? (totalScore / done.length).toFixed(1) : '0';

  // 决赛（单败取最后一轮）
  const R = ms.reduce((mx, m) => Math.max(mx, m.round), 0);
  const finalMatch = t.format === 'swiss' || t.format === 'round_robin'
    ? null
    : ms.find((m) => m.round === R && m.status === 'completed' && m.team1Id && m.team2Id) ?? null;

  return c.json({
    tournament: {
      id: t.id,
      name: t.name,
      format: t.format,
      status: t.status,
      game: t.game,
      boCount: t.boCount,
      startDate: t.startDate,
      endDate: t.endDate,
      createdAt: t.createdAt,
    },
    champion: info(championId),
    ranking: ranking.map((r) => ({ label: r.label, ...info(r.teamId) })),
    stats: { teamCount: tt.length, matchCount: done.length, totalScore, avgScore },
    final: finalMatch
      ? {
          team1Id: finalMatch.team1Id,
          team2Id: finalMatch.team2Id,
          team1Score: finalMatch.team1Score,
          team2Score: finalMatch.team2Score,
          winnerId: finalMatch.winnerId,
          team1: info(finalMatch.team1Id),
          team2: info(finalMatch.team2Id),
        }
      : null,
  });
});

bracketRoutes.get('/:id/bracket', async (c) => {
  const id = c.req.param('id');
  const tsRows = await c.get('db').select({
    tournament: { id: tournaments.id, name: tournaments.name, format: tournaments.format, status: tournaments.status },
    stage: stages,
  })
    .from(tournaments)
    .leftJoin(stages, eq(stages.tournamentId, tournaments.id))
    .where(eq(tournaments.id, id));

  if (tsRows.length === 0 || !tsRows[0].tournament) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }

  const tournament = tsRows[0].tournament;
  const tournamentStages = tsRows
    .map((r) => r.stage)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.order - b.order);
  const stageIds = tournamentStages.map((s) => s.id);

  if (stageIds.length === 0) {
    return c.json({ tournament, stages: [] });
  }

  const t1 = alias(teams, 't1');
  const t2 = alias(teams, 't2');
  const tt1 = alias(tournamentTeams, 'tt1');
  const tt2 = alias(tournamentTeams, 'tt2');
  const matchRows = await c.get('db').select({
    match: matches,
    game: games,
    team1: { id: t1.id, name: t1.name, logoUrl: t1.logoUrl, logoEmoji: t1.logoEmoji, seed: tt1.seed },
    team2: { id: t2.id, name: t2.name, logoUrl: t2.logoUrl, logoEmoji: t2.logoEmoji, seed: tt2.seed },
  })
    .from(matches)
    .leftJoin(t1, eq(t1.id, matches.team1Id))
    .leftJoin(t2, eq(t2.id, matches.team2Id))
    .leftJoin(tt1, and(eq(tt1.teamId, matches.team1Id), eq(tt1.tournamentId, tournament.id)))
    .leftJoin(tt2, and(eq(tt2.teamId, matches.team2Id), eq(tt2.tournamentId, tournament.id)))
    .leftJoin(games, eq(games.matchId, matches.id))
    .where(inArray(matches.stageId, stageIds));

  const matchMap = new Map<string, any>();
  const gamesByMatch = new Map<string, any[]>();
  for (const row of matchRows) {
    const m = row.match;
    if (!matchMap.has(m.id)) {
      matchMap.set(m.id, {
        id: m.id,
        stageId: m.stageId,
        bracket_pos: m.bracketPos,
        team1: row.team1 ? { id: row.team1.id, name: row.team1.name, logo_url: row.team1.logoUrl, logo_emoji: row.team1.logoEmoji, seed: row.team1.seed } : null,
        team2: row.team2 ? { id: row.team2.id, name: row.team2.name, logo_url: row.team2.logoUrl, logo_emoji: row.team2.logoEmoji, seed: row.team2.seed } : null,
        team1_score: m.team1Score,
        team2_score: m.team2Score,
        status: m.status,
        round: m.round,
        position: m.position,
        games: [],
      });
      gamesByMatch.set(m.id, matchMap.get(m.id).games);
    }
    if (row.game) {
      gamesByMatch.get(m.id)!.push({
        game_number: row.game.gameNumber,
        winner_id: row.game.winnerId,
        map: row.game.map,
        duration: row.game.duration,
      });
    }
  }

  const bracketStages = tournamentStages.map((stage) => {
    const stageMatches = [...matchMap.values()].filter((m) => m.stageId === stage.id);
    const roundNumbers = [...new Set(stageMatches.map((m) => m.round))].sort((a, b) => a - b);
    const rounds = roundNumbers.map((round) => {
      const roundMatches = stageMatches.filter((m) => m.round === round).sort((a, b) => a.position - b.position);
      return { round, name: `第${round}轮`, matches: roundMatches };
    });
    return { id: stage.id, type: stage.type, name: stage.name, rounds };
  });

  return c.json({ tournament, stages: bracketStages });
});

bracketRoutes.get('/:id/stages', async (c) => {
  const id = c.req.param('id');
  const result = await c.get('db').select().from(stages).where(eq(stages.tournamentId, id));
  return c.json(result);
});

bracketRoutes.get('/:id/matches', async (c) => {
  const id = c.req.param('id');
  const t1 = alias(teams, 't1');
  const t2 = alias(teams, 't2');
  const tt1 = alias(tournamentTeams, 'tt1');
  const tt2 = alias(tournamentTeams, 'tt2');
  const rows = await c.get('db').select({
    match: matches,
    stageType: stages.type,
    stageName: stages.name,
    stageOrder: stages.order,
    team1Name: t1.name,
    team1LogoUrl: t1.logoUrl,
    team1LogoEmoji: t1.logoEmoji,
    team1Seed: tt1.seed,
    team2Name: t2.name,
    team2LogoUrl: t2.logoUrl,
    team2LogoEmoji: t2.logoEmoji,
    team2Seed: tt2.seed,
  })
    .from(matches)
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .leftJoin(t1, eq(t1.id, matches.team1Id))
    .leftJoin(t2, eq(t2.id, matches.team2Id))
    .leftJoin(tt1, and(eq(tt1.teamId, matches.team1Id), eq(tt1.tournamentId, id)))
    .leftJoin(tt2, and(eq(tt2.teamId, matches.team2Id), eq(tt2.tournamentId, id)))
    .where(eq(stages.tournamentId, id));

  const result = rows
    .map((r) => ({
      id: r.match.id,
      stage_id: r.match.stageId,
      group_label: r.match.groupLabel,
      round: r.match.round,
      position: r.match.position,
      bracket_pos: r.match.bracketPos,
      team1_id: r.match.team1Id,
      team2_id: r.match.team2Id,
      winner_id: r.match.winnerId,
      team1_score: r.match.team1Score,
      team2_score: r.match.team2Score,
      status: r.match.status,
      scheduled_at: r.match.scheduledAt,
      team1: r.team1Name
        ? { id: r.match.team1Id, name: r.team1Name, logo_url: r.team1LogoUrl, logo_emoji: r.team1LogoEmoji, seed: r.team1Seed }
        : null,
      team2: r.team2Name
        ? { id: r.match.team2Id, name: r.team2Name, logo_url: r.team2LogoUrl, logo_emoji: r.team2LogoEmoji, seed: r.team2Seed }
        : null,
      stage_type: r.stageType,
      stage_name: r.stageName,
      stage_order: r.stageOrder,
    }))
    .sort((a, b) => {
      if (a.stage_order !== b.stage_order) return a.stage_order - b.stage_order;
      if (a.round !== b.round) return a.round - b.round;
      return a.position - b.position;
    });
  return c.json(result);
});

bracketRoutes.get('/:id/stages/:stageId/matches', async (c) => {
  const stageId = c.req.param('stageId');
  const result = await c.get('db').select().from(matches).where(eq(matches.stageId, stageId));
  return c.json(result);
});

bracketRoutes.get('/:id/standings', async (c) => {
  const id = c.req.param('id');
  const rows = await c.get('db').select({
    rank: standings.rank,
    groupLabel: standings.groupLabel,
    wins: standings.wins,
    losses: standings.losses,
    draws: standings.draws,
    points: standings.points,
    gameDifference: standings.gameDifference,
    roundPlayed: standings.roundPlayed,
    team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl },
  })
    .from(standings)
    .innerJoin(stages, eq(stages.id, standings.stageId))
    .leftJoin(teams, eq(teams.id, standings.teamId))
    .where(eq(stages.tournamentId, id));

  const result = rows
    .map((r) => ({
      rank: r.rank,
      team: r.team ? { id: r.team.id, name: r.team.name, logo_url: r.team.logoUrl } : null,
      group_label: r.groupLabel,
      wins: r.wins, losses: r.losses, draws: r.draws,
      points: r.points, game_difference: r.gameDifference, round_played: r.roundPlayed,
    }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return c.json(result);
});

bracketRoutes.get('/:id/standings/:groupLabel', async (c) => {
  const id = c.req.param('id');
  const groupLabel = c.req.param('groupLabel');
  const rows = await c.get('db').select({
    rank: standings.rank,
    wins: standings.wins,
    losses: standings.losses,
    draws: standings.draws,
    points: standings.points,
    gameDifference: standings.gameDifference,
    roundPlayed: standings.roundPlayed,
    team: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl },
  })
    .from(standings)
    .innerJoin(stages, eq(stages.id, standings.stageId))
    .leftJoin(teams, eq(teams.id, standings.teamId))
    .where(and(eq(stages.tournamentId, id), eq(standings.groupLabel, groupLabel)));

  const result = rows
    .map((r) => ({
      rank: r.rank,
      team: r.team ? { id: r.team.id, name: r.team.name, logo_url: r.team.logoUrl } : null,
      wins: r.wins, losses: r.losses, draws: r.draws,
      points: r.points, game_difference: r.gameDifference, round_played: r.roundPlayed,
    }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return c.json(result);
});

// ========== 管理员路由 ==========
bracketRoutes.post('/:id/reset', async (c) => {
  const id = c.req.param('id');
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  const stageRows = await c.get('db').select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, id));
  if (stageRows.length > 0) {
    const stageIds = stageRows.map((s) => s.id);
    const matchRows = await c.get('db').select({ id: matches.id }).from(matches).where(inArray(matches.stageId, stageIds));
    if (matchRows.length > 0) {
      const matchIds = matchRows.map((m) => m.id);
      await c.get('db').update(matches).set({ nextMatchId: null, nextLosersMatchId: null })
        .where(inArray(matches.id, matchIds));
      await c.get('db').delete(games).where(inArray(games.matchId, matchIds));
    }
    await c.get('db').delete(standings).where(inArray(standings.stageId, stageIds));
    await c.get('db').delete(matches).where(inArray(matches.stageId, stageIds));
    await c.get('db').delete(stages).where(inArray(stages.id, stageIds));
  }
  await c.get('db').update(tournaments).set({ status: 'draft' }).where(eq(tournaments.id, id));
  return c.json({ message: '赛程已重置' });
});

bracketRoutes.post('/:id/generate', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(user, tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  if (tournament.status !== 'draft') throw new AppError('BRACKET_ALREADY_GENERATED', '赛程已生成');

  const tournamentTeamsRows = await c.get('db').select({
    entry: tournamentTeams,
    team: teams,
  })
    .from(tournamentTeams)
    .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
    .where(eq(tournamentTeams.tournamentId, id));
  if (tournamentTeamsRows.length < 2) throw new AppError('INVALID_TEAM_COUNT', '至少需要2支队伍', 400);

  const tournamentTeamsList = tournamentTeamsRows.map((r) => ({
    id: r.team.id,
    name: r.team.name,
    logoUrl: r.team.logoUrl,
    logoEmoji: r.team.logoEmoji,
    seed: r.entry.seed,
    status: r.entry.status,
    tournamentId: id,
    ownerId: r.team.ownerId,
  }));

  const body = await c.req.json().catch(() => ({}));
  const data = (body ?? {}) as { seed_by?: string; seed_order?: string[] };

  let seededTeams = [...tournamentTeamsList];
  if (data.seed_by === 'manual' && data.seed_order) {
    seededTeams = data.seed_order
      .map((tid, i) => {
        const t = tournamentTeamsList.find((tt) => tt.id === tid);
        if (t) t.seed = i + 1;
        return t;
      })
      .filter(Boolean) as typeof tournamentTeamsList;
  } else {
    seededTeams.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    seededTeams.forEach((t, i) => { t.seed = i + 1; });
  }

  const settings: BracketSettings = {
    boCount: tournament.boCount,
    thirdPlace: tournament.thirdPlace,
    hasGroupStage: tournament.hasGroupStage,
    groupCount: tournament.groupCount,
    advancePerGroup: tournament.advancePerGroup,
    swissRounds: tournament.swissRounds,
    formatConfig: tournament.formatConfig as Record<string, unknown>,
  };

  const generator = getGenerator(tournament.format);
  const result = generator.generate(seededTeams, settings);

  // Insert stages
  const insertedStageIds: string[] = [];
  for (const stage of result.stages) {
    const [inserted] = await c.get('db').insert(stages).values({
      tournamentId: id,
      name: stage.name,
      type: stage.type,
      order: stage.order,
    }).returning();
    insertedStageIds.push(inserted.id);
  }

  // First pass: insert matches（占位 ID 后续替换）
  const placeholderToRealId = new Map<string, string>();
  const insertedMatchIds: string[] = [];

  for (let i = 0; i < result.matches.length; i++) {
    const match = result.matches[i];
    let stageId = insertedStageIds[0];
    if (match.stageId && typeof match.stageId === 'string' && match.stageId.startsWith('__stage_')) {
      const match_result = match.stageId.match(/^__stage_(\d+)__$/);
      if (match_result) {
        const stageIdx = parseInt(match_result[1], 10);
        if (insertedStageIds[stageIdx]) stageId = insertedStageIds[stageIdx];
      }
    }

    const [inserted] = await c.get('db').insert(matches).values({
      stageId,
      groupLabel: match.groupLabel,
      round: match.round,
      position: match.position,
      bracketPos: match.bracketPos,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      winnerId: match.winnerId,
      loserId: match.loserId,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      status: match.status,
      scheduledAt: match.scheduledAt,
      nextMatchId: null,
      nextLosersMatchId: null,
      swissScoreGroup: match.swissScoreGroup,
    }).returning();

    const placeholder = `__match_${i}__`;
    placeholderToRealId.set(placeholder, inserted.id);
    insertedMatchIds.push(inserted.id);
  }

  // Second pass: update nextMatchId / nextLosersMatchId
  for (let i = 0; i < result.matches.length; i++) {
    const match = result.matches[i];
    const updates: Record<string, any> = {};

    if (match.nextMatchId && typeof match.nextMatchId === 'string') {
      const realId = placeholderToRealId.get(match.nextMatchId);
      if (realId) updates.nextMatchId = realId;
    }
    if (match.nextLosersMatchId && typeof match.nextLosersMatchId === 'string') {
      const realId = placeholderToRealId.get(match.nextLosersMatchId);
      if (realId) updates.nextLosersMatchId = realId;
    }

    if (Object.keys(updates).length > 0) {
      await c.get('db').update(matches).set(updates).where(eq(matches.id, insertedMatchIds[i]));
    }
  }

  // Third pass: 推进 walkthrough（轮空）比赛的 winner
  let walkChanged = true;
  while (walkChanged) {
    walkChanged = false;
    const walkthroughMatches = await c.get('db').select().from(matches)
      .where(and(
        inArray(matches.stageId, insertedStageIds),
        eq(matches.status, 'walkthrough'),
      ));
    for (const m of walkthroughMatches) {
      if (!m.winnerId || !m.nextMatchId) continue;
      const [nextMatch] = await c.get('db').select().from(matches)
        .where(eq(matches.id, m.nextMatchId)).limit(1);
      if (!nextMatch) continue;
      if (!nextMatch.team1Id) {
        await c.get('db').update(matches).set({ team1Id: m.winnerId })
          .where(eq(matches.id, nextMatch.id));
        walkChanged = true;
      } else if (!nextMatch.team2Id && nextMatch.team1Id !== m.winnerId) {
        await c.get('db').update(matches).set({ team2Id: m.winnerId })
          .where(eq(matches.id, nextMatch.id));
        walkChanged = true;
      }
    }
  }

  // 循环赛/瑞士轮：初始化积分榜
  if (tournament.format === 'round_robin' || tournament.format === 'swiss') {
    const mainStage = insertedStageIds[0];
    const standingsRows = tournamentTeamsList.map((tt) => ({
      tournamentId: id,
      stageId: mainStage,
      teamId: tt.id,
      groupLabel: null,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      gameDifference: 0,
      roundPlayed: 0,
      rank: 0,
    }));
    if (standingsRows.length > 0) {
      await c.get('db').insert(standings).values(standingsRows);
    }
  }

  await c.get('db').update(tournaments).set({ status: 'ongoing' }).where(eq(tournaments.id, id));

  return c.json({ message: '赛程生成成功', stagesCount: result.stages.length, matchesCount: result.matches.length });
});

bracketRoutes.post('/:id/generate-next-round', async (c) => {
  const id = c.req.param('id');
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  if (tournament.format !== 'swiss') throw new AppError('INVALID_FORMAT', '仅瑞士轮支持逐轮生成');

  const tournamentTeamsRows = await c.get('db').select({ team: teams })
    .from(tournamentTeams)
    .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
    .where(eq(tournamentTeams.tournamentId, id));
  const tournamentTeamsList = tournamentTeamsRows.map((r) => r.team);
  const tournamentStages = await c.get('db').select().from(stages).where(eq(stages.tournamentId, id));
  const swissStage = tournamentStages.find((s) => s.type === 'swiss');
  if (!swissStage) throw new AppError('NOT_FOUND', '瑞士轮阶段不存在', 404);

  const stageMatches = await c.get('db').select().from(matches).where(eq(matches.stageId, swissStage.id));
  const currentRound = Math.max(...stageMatches.map((m) => m.round));
  const currentRoundMatches = stageMatches.filter((m) => m.round === currentRound);

  const incomplete = currentRoundMatches.filter((m) => m.status !== 'completed' && m.status !== 'walkthrough');
  if (incomplete.length > 0) throw new AppError('SWISS_ROUND_IN_PROGRESS', '当前轮次尚未结束');

  if (tournament.swissRounds && currentRound >= tournament.swissRounds) {
    throw new AppError('SWISS_COMPLETE', '已达到配置的轮次数');
  }

  const generator = new SwissGenerator();
  const standingsData = tournamentTeamsList.map((t) => {
    const teamMatches = stageMatches.filter((m) => m.winnerId === t.id || (m.team1Id === t.id || m.team2Id === t.id));
    const wins = teamMatches.filter((m) => m.winnerId === t.id).length;
    const losses = teamMatches.filter((m) => m.loserId === t.id).length;
    return { teamId: t.id, points: wins * 3, wins, losses };
  });

  const playedPairs = new Set<string>();
  for (const m of stageMatches) {
    if (m.team1Id && m.team2Id) {
      playedPairs.add([m.team1Id, m.team2Id].sort().join('-'));
    }
  }

  const newMatches = generator.generateNextRound(tournamentTeamsList, currentRound, standingsData, playedPairs);
  for (const match of newMatches) {
    await c.get('db').insert(matches).values({ ...match, stageId: swissStage.id });
  }

  return c.json({ message: `第${currentRound + 1}轮生成成功`, matchesCount: newMatches.length });
});
