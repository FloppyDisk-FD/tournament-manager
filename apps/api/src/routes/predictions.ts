import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Db } from '../db';
import { predictions, matches, stages, tournaments, users } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';

/** 预测/竞猜路由（/api/v1/tournaments/:id/predictions） */
export const predictionRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
predictionRoutes.use('*', authMiddleware, requireAuth);

// 校验比赛归属并返回（含队伍）
async function getMatchOfTournament(db: Db, tournamentId: string, matchId: string) {
  const rows = await db.select({
    match: matches,
    team1Id: matches.team1Id,
    team2Id: matches.team2Id,
    stageId: matches.stageId,
  })
    .from(matches)
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .where(and(eq(matches.id, matchId), eq(stages.tournamentId, tournamentId)))
    .limit(1);
  if (rows.length === 0) throw new AppError('NOT_FOUND', '比赛不存在', 404);
  return rows[0];
}

// 获取赛事所有比赛的预测统计（含我的选择）
predictionRoutes.get('/:id/predictions', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');

  const [t] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) throw new AppError('NOT_FOUND', '赛事不存在', 404);

  const [voteRows, matchRows] = await Promise.all([
    db.select({
      matchId: predictions.matchId,
      winnerTeamId: predictions.winnerTeamId,
      userId: predictions.userId,
    })
      .from(predictions)
      .innerJoin(matches, eq(matches.id, predictions.matchId))
      .innerJoin(stages, eq(stages.id, matches.stageId))
      .where(eq(stages.tournamentId, id)),
    db.select({
      id: matches.id,
      team1Id: matches.team1Id,
      team2Id: matches.team2Id,
    })
      .from(matches)
      .innerJoin(stages, eq(stages.id, matches.stageId))
      .where(eq(stages.tournamentId, id)),
  ]);

  const stats: Record<string, { team1Votes: number; team2Votes: number; total: number; myPick: string | null }> = {};
  for (const m of matchRows) {
    let team1Votes = 0;
    let team2Votes = 0;
    let myPick: string | null = null;
    for (const v of voteRows) {
      if (v.matchId !== m.id) continue;
      if (v.userId === user.id) myPick = v.winnerTeamId;
      if (v.winnerTeamId === m.team1Id) team1Votes += 1;
      else if (v.winnerTeamId === m.team2Id) team2Votes += 1;
    }
    stats[m.id] = { team1Votes, team2Votes, total: team1Votes + team2Votes, myPick };
  }
  return c.json(stats);
});

// 竞猜排行榜：预测正确的比赛数 = 积分，按积分排序（同分按命中率，参与场次少者优先）
predictionRoutes.get('/:id/predictions/leaderboard', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');

  const [t] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) throw new AppError('NOT_FOUND', '赛事不存在', 404);

  // 该赛事所有已结束比赛的预测（join 比赛结果 + 用户信息）
  const rows = await db.select({
    userId: predictions.userId,
    winnerTeamId: predictions.winnerTeamId,
    matchWinnerId: matches.winnerId,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  })
    .from(predictions)
    .innerJoin(matches, eq(matches.id, predictions.matchId))
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .innerJoin(users, eq(users.id, predictions.userId))
    .where(and(eq(stages.tournamentId, id), eq(matches.status, 'completed')));

  const agg = new Map<string, {
    userId: string; username: string; displayName: string | null; avatarUrl: string | null;
    correct: number; votes: number;
  }>();
  for (const r of rows) {
    let e = agg.get(r.userId);
    if (!e) {
      e = { userId: r.userId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl, correct: 0, votes: 0 };
      agg.set(r.userId, e);
    }
    e.votes += 1;
    if (r.winnerTeamId && r.matchWinnerId && r.winnerTeamId === r.matchWinnerId) e.correct += 1;
  }

  const leaderboard = [...agg.values()]
    .sort((a, b) => b.correct - a.correct || a.votes - b.votes)
    .map((e, i) => ({ rank: i + 1, ...e }));

  const mine = leaderboard.find((e) => e.userId === user.id) ?? null;
  return c.json({ leaderboard, myRank: mine?.rank ?? null, myScore: mine?.correct ?? 0, myVotes: mine?.votes ?? 0 });
});

// 投票 / 改票（同场次同一用户仅一条，upsert）
predictionRoutes.post('/:id/predictions', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');

  const body = await c.req.json().catch(() => null);
  const matchId = body?.match_id ?? body?.matchId;
  const winnerTeamId = body?.winner_team_id ?? body?.winnerTeamId;
  if (!matchId || !winnerTeamId) throw new AppError('BAD_REQUEST', '缺少 match_id 或 winner_team_id', 400);

  const [t] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!t) throw new AppError('NOT_FOUND', '赛事不存在', 404);

  const row = await getMatchOfTournament(db, id, matchId);
  const m = row.match;
  if (!m.team1Id || !m.team2Id) throw new AppError('BAD_REQUEST', '比赛双方未确定，暂不能预测', 400);
  if (m.status === 'completed' || m.status === 'walkthrough') {
    throw new AppError('MATCH_FINISHED', '比赛已结束，不能再预测', 400);
  }
  if (winnerTeamId !== m.team1Id && winnerTeamId !== m.team2Id) {
    throw new AppError('BAD_REQUEST', '只能预测比赛双方之一', 400);
  }

  const [existing] = await db.select({ id: predictions.id }).from(predictions)
    .where(and(eq(predictions.matchId, matchId), eq(predictions.userId, user.id)))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(predictions)
      .set({ winnerTeamId })
      .where(eq(predictions.id, existing.id))
      .returning();
    return c.json(updated);
  }

  const [created] = await db.insert(predictions)
    .values({ matchId, userId: user.id, winnerTeamId })
    .returning();
  return c.json(created, 201);
});

// 撤销我的预测
predictionRoutes.delete('/:id/predictions', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const user = c.get('user')!;
  const db = c.get('db');
  const body = await c.req.json().catch(() => null);
  const matchId = body?.match_id ?? body?.matchId;
  if (!matchId) throw new AppError('BAD_REQUEST', '缺少 match_id', 400);
  await db.delete(predictions)
    .where(and(eq(predictions.matchId, matchId), eq(predictions.userId, user.id)));
  return c.json({ ok: true });
});
