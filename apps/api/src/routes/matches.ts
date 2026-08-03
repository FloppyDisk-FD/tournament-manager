import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { matches, games, teams, stages, tournaments } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { canManageTournament } from '../services/perm';
import { updateStandings } from '../services/standings';

/** 检查赛事是否全部比赛结束，若是则将赛事状态更新为 completed */
async function checkTournamentComplete(db: Db, tournamentId: string) {
  const tournamentStages = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, tournamentId));
  if (tournamentStages.length === 0) return;
  const stageIds = tournamentStages.map((s) => s.id);
  const allMatches = await db.select({ status: matches.status }).from(matches).where(inArray(matches.stageId, stageIds));
  const hasIncomplete = allMatches.some((m) => m.status === 'pending' || m.status === 'in_progress');
  if (!hasIncomplete && allMatches.length > 0) {
    await db.update(tournaments).set({ status: 'completed' }).where(eq(tournaments.id, tournamentId));
  }
}

export const matchRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
matchRoutes.use('*', authMiddleware);

// ========== 公开路由 ==========
matchRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [match] = await c.get('db').select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) throw new AppError('NOT_FOUND', '比赛不存在', 404);

  const matchGames = await c.get('db').select().from(games).where(eq(games.matchId, id));
  return c.json({ ...match, games: matchGames });
});

// ========== 管理路由（赛事管理者或系统管理员） ==========
// 校验当前用户对该比赛所属赛事有管理权
matchRoutes.use('/:id/*', async (c, next) => {
  const id = c.req.param('id');
  const db = c.get('db');
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) throw new AppError('NOT_FOUND', '比赛不存在', 404);
  const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  const [tournament] = stage
    ? await db.select().from(tournaments).where(eq(tournaments.id, stage.tournamentId)).limit(1)
    : [];
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  await next();
});

matchRoutes.put('/:id/score', async (c) => {
  const id = c.req.param('id');
  const [match] = await c.get('db').select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) throw new AppError('NOT_FOUND', '比赛不存在', 404);
  if (match.status === 'completed') throw new AppError('MATCH_COMPLETED', '比赛已结束');

  const [stage] = await c.get('db').select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  if (!stage) throw new AppError('NOT_FOUND', '阶段不存在', 404);

  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, stage.tournamentId)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);

  const data = await c.req.json() as { games: { game_number: number; winner_id: string; map?: string; duration?: number }[] };

  // Upsert games
  for (const g of data.games) {
    const existing = await c.get('db').select().from(games).where(
      and(eq(games.matchId, id), eq(games.gameNumber, g.game_number)),
    ).limit(1);

    if (existing.length > 0) {
      await c.get('db').update(games).set({
        winnerId: g.winner_id,
        map: g.map,
        duration: g.duration,
      }).where(eq(games.id, existing[0].id));
    } else {
      await c.get('db').insert(games).values({
        matchId: id,
        gameNumber: g.game_number,
        winnerId: g.winner_id,
        map: g.map,
        duration: g.duration,
      });
    }
  }

  const allGames = await c.get('db').select().from(games).where(eq(games.matchId, id));
  const team1Wins = allGames.filter((g) => g.winnerId === match.team1Id).length;
  const team2Wins = allGames.filter((g) => g.winnerId === match.team2Id).length;
  const winsNeeded = Math.ceil(tournament.boCount / 2);

  const updates: any = { team1Score: team1Wins, team2Score: team2Wins };

  if (team1Wins >= winsNeeded || team2Wins >= winsNeeded) {
    const winnerId = team1Wins >= winsNeeded ? match.team1Id : match.team2Id;
    const loserId = winnerId === match.team1Id ? match.team2Id : match.team1Id;
    updates.winnerId = winnerId;
    updates.loserId = loserId;
    updates.status = 'completed';

    // 推进胜者到下一轮
    if (match.nextMatchId) {
      const [nextMatch] = await c.get('db').select().from(matches).where(eq(matches.id, match.nextMatchId)).limit(1);
      if (nextMatch) {
        if (!nextMatch.team1Id) {
          await c.get('db').update(matches).set({ team1Id: winnerId }).where(eq(matches.id, nextMatch.id));
        } else if (!nextMatch.team2Id) {
          await c.get('db').update(matches).set({ team2Id: winnerId }).where(eq(matches.id, nextMatch.id));
        }
      }
    }

    // 双败：败者降入败者组
    if (match.nextLosersMatchId) {
      const [losersMatch] = await c.get('db').select().from(matches).where(eq(matches.id, match.nextLosersMatchId)).limit(1);
      if (losersMatch) {
        if (!losersMatch.team1Id) {
          await c.get('db').update(matches).set({ team1Id: loserId }).where(eq(matches.id, losersMatch.id));
        } else if (!losersMatch.team2Id) {
          await c.get('db').update(matches).set({ team2Id: loserId }).where(eq(matches.id, losersMatch.id));
        }
      }
    }

    // 更新积分榜
    await updateStandings(c.get('db'), tournament.id, match.stageId);
  } else if (data.games.length > 0) {
    // 已录入比分但未决出胜负 → 比赛进行中
    updates.status = 'in_progress';
  }

  await c.get('db').update(matches).set(updates).where(eq(matches.id, id));

  // 比赛决出后，检查整个赛事是否结束
  if (updates.status === 'completed') {
    await checkTournamentComplete(c.get('db'), tournament.id);
  }
  return c.json({ message: '比分已更新', match_decided: updates.status === 'completed' });
});

matchRoutes.put('/:id/schedule', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json() as { scheduled_at: string };
  await c.get('db').update(matches).set({ scheduledAt: new Date(data.scheduled_at) }).where(eq(matches.id, id));
  return c.json({ message: '比赛时间已设置' });
});
