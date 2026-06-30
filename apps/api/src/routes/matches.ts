import { Elysia } from 'elysia';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { matches, games, teams, stages, tournaments } from '../db/schema';
import { AppError } from '../middleware/error';
import { authPlugin, requireAdmin } from '../middleware/auth';
import { updateStandings } from '../services/standings';

/** 检查赛事是否全部比赛结束，若是则将赛事状态更新为 completed */
async function checkTournamentComplete(tournamentId: string) {
  const tournamentStages = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, tournamentId));
  if (tournamentStages.length === 0) return;
  const stageIds = tournamentStages.map((s) => s.id);
  const allMatches = await db.select({ status: matches.status }).from(matches).where(inArray(matches.stageId, stageIds));
  // 还有未结束的比赛（pending 或 in_progress），赛事不结束
  const hasIncomplete = allMatches.some((m) => m.status === 'pending' || m.status === 'in_progress');
  if (!hasIncomplete && allMatches.length > 0) {
    await db.update(tournaments).set({ status: 'completed' }).where(eq(tournaments.id, tournamentId));
  }
}

export const matchRoutes = new Elysia({ prefix: '/api/v1/matches' })
  .use(authPlugin)
  .get('/:id', async ({ params }) => {
    const [match] = await db.select().from(matches).where(eq(matches.id, params.id)).limit(1);
    if (!match) throw new AppError('NOT_FOUND', '比赛不存在', 404);

    const matchGames = await db.select().from(games).where(eq(games.matchId, params.id));
    return { ...match, games: matchGames };
  })
  .use(requireAdmin)
  .put('/:id/score', async ({ params, body }) => {
    const [match] = await db.select().from(matches).where(eq(matches.id, params.id)).limit(1);
    if (!match) throw new AppError('NOT_FOUND', '比赛不存在', 404);
    if (match.status === 'completed') throw new AppError('MATCH_COMPLETED', '比赛已结束');

    // Get tournament info for boCount and tournamentId
    const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
    if (!stage) throw new AppError('NOT_FOUND', '阶段不存在', 404);

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, stage.tournamentId)).limit(1);
    if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);

    const data = body as { games: { game_number: number; winner_id: string; map?: string; duration?: number }[] };

    // Upsert games
    for (const g of data.games) {
      const existing = await db.select().from(games).where(
        and(eq(games.matchId, params.id), eq(games.gameNumber, g.game_number)),
      ).limit(1);

      if (existing.length > 0) {
        await db.update(games).set({
          winnerId: g.winner_id,
          map: g.map,
          duration: g.duration,
        }).where(eq(games.id, existing[0].id));
      } else {
        await db.insert(games).values({
          matchId: params.id,
          gameNumber: g.game_number,
          winnerId: g.winner_id,
          map: g.map,
          duration: g.duration,
        });
      }
    }

    // Count wins per team
    const team1Wins = data.games.filter((g) => g.winner_id === match.team1Id).length;
    const team2Wins = data.games.filter((g) => g.winner_id === match.team2Id).length;
    const winsNeeded = Math.ceil(tournament.boCount / 2);

    // Update match score
    const updates: any = { team1Score: team1Wins, team2Score: team2Wins };

    // Check if match is decided
    if (team1Wins >= winsNeeded || team2Wins >= winsNeeded) {
      const winnerId = team1Wins >= winsNeeded ? match.team1Id : match.team2Id;
      const loserId = winnerId === match.team1Id ? match.team2Id : match.team1Id;
      updates.winnerId = winnerId;
      updates.loserId = loserId;
      updates.status = 'completed';

      // Advance winner to next match
      if (match.nextMatchId) {
        const [nextMatch] = await db.select().from(matches).where(eq(matches.id, match.nextMatchId)).limit(1);
        if (nextMatch) {
          // Determine which slot to fill (team1 or team2)
          if (!nextMatch.team1Id) {
            await db.update(matches).set({ team1Id: winnerId }).where(eq(matches.id, nextMatch.id));
          } else if (!nextMatch.team2Id) {
            await db.update(matches).set({ team2Id: winnerId }).where(eq(matches.id, nextMatch.id));
          }
        }
      }

      // In double elim: advance loser to losers bracket
      if (match.nextLosersMatchId) {
        const [losersMatch] = await db.select().from(matches).where(eq(matches.id, match.nextLosersMatchId)).limit(1);
        if (losersMatch) {
          if (!losersMatch.team1Id) {
            await db.update(matches).set({ team1Id: loserId }).where(eq(matches.id, losersMatch.id));
          } else if (!losersMatch.team2Id) {
            await db.update(matches).set({ team2Id: loserId }).where(eq(matches.id, losersMatch.id));
          }
        }
      }

      // Update standings
      await updateStandings(tournament.id, match.stageId);
    }

    await db.update(matches).set(updates).where(eq(matches.id, params.id));

    // 比赛决出后，检查整个赛事是否结束
    if (updates.status === 'completed') {
      await checkTournamentComplete(tournament.id);
    }
    return { message: '比分已更新', match_decided: updates.status === 'completed' };
  })
  .put('/:id/schedule', async ({ params, body }) => {
    const data = body as { scheduled_at: string };
    await db.update(matches).set({ scheduledAt: new Date(data.scheduled_at) }).where(eq(matches.id, params.id));
    return { message: '比赛时间已设置' };
  });
