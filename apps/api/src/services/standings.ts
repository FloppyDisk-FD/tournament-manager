import { eq, and } from 'drizzle-orm';
import type { Db } from '../db';
import { standings, matches, stages } from '../db/schema';

export async function updateStandings(db: Db, tournamentId: string, stageId: string) {
  const stage = (await db.select().from(stages).where(eq(stages.id, stageId)))[0];
  if (!stage) return;

  const stageMatches = await db.select().from(matches).where(eq(matches.stageId, stageId));
  const teamIds = new Set<string>();
  for (const m of stageMatches) {
    if (m.team1Id) teamIds.add(m.team1Id);
    if (m.team2Id) teamIds.add(m.team2Id);
  }

  for (const teamId of teamIds) {
    const teamMatches = stageMatches.filter(
      (m) => (m.team1Id === teamId || m.team2Id === teamId) &&
             (m.status === 'completed' || m.status === 'walkthrough'),
    );

    const wins = teamMatches.filter((m) => m.winnerId === teamId).length;
    const losses = teamMatches.filter((m) => m.loserId === teamId).length;
    const draws = 0; // No draws in current design
    const points = wins * 3 + draws * 1;
    const gameDifference = teamMatches.reduce((acc, m) => {
      if (m.team1Id === teamId) return acc + m.team1Score - m.team2Score;
      return acc + m.team2Score - m.team1Score;
    }, 0);

    const existing = await db.select().from(standings).where(
      and(eq(standings.teamId, teamId), eq(standings.stageId, stageId)),
    ).limit(1);

    if (existing.length > 0) {
      await db.update(standings).set({
        wins, losses, draws, points, gameDifference,
        roundPlayed: teamMatches.length,
      }).where(eq(standings.id, existing[0].id));
    } else {
      await db.insert(standings).values({
        tournamentId,
        stageId,
        teamId,
        groupLabel: null,
        wins, losses, draws, points, gameDifference,
        roundPlayed: teamMatches.length,
      });
    }
  }

  // Update ranks
  const allStandings = await db.select().from(standings).where(eq(standings.stageId, stageId));
  allStandings.sort((a, b) => b.points - a.points || b.gameDifference - a.gameDifference);
  for (let i = 0; i < allStandings.length; i++) {
    await db.update(standings).set({ rank: i + 1 }).where(eq(standings.id, allStandings[i].id));
  }
}
