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

  // Update ranks — T.Lets 规则：积分 → 胜负场次差 → 净胜分 → 对战胜负 (head-to-head)
  // 构建对战矩阵：h2h[a][b] > 0 表示 a 在对阵 b 的比赛中净胜场次占优
  const h2h = new Map<string, Map<string, number>>();
  for (const m of stageMatches) {
    if (m.status !== 'completed' && m.status !== 'walkthrough') continue;
    if (!m.team1Id || !m.team2Id || !m.winnerId) continue; // 轮空不算对战胜负
    const winner = m.winnerId;
    const loser = m.team1Id === winner ? m.team2Id : m.team1Id;
    if (!h2h.has(winner)) h2h.set(winner, new Map());
    if (!h2h.has(loser)) h2h.set(loser, new Map());
    h2h.get(winner)!.set(loser, (h2h.get(winner)!.get(loser) ?? 0) + 1);
    h2h.get(loser)!.set(winner, (h2h.get(loser)!.get(winner) ?? 0) - 1);
  }

  const allStandings = await db.select().from(standings).where(eq(standings.stageId, stageId));
  allStandings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const winDiff = (b.wins - b.losses) - (a.wins - a.losses);
    if (winDiff !== 0) return winDiff;
    if (b.gameDifference !== a.gameDifference) return b.gameDifference - a.gameDifference;
    // 对战胜负：a 对 b 净胜为正 → a 排前
    return -((h2h.get(a.teamId)?.get(b.teamId) ?? 0) || 0);
  });
  for (let i = 0; i < allStandings.length; i++) {
    await db.update(standings).set({ rank: i + 1 }).where(eq(standings.id, allStandings[i].id));
  }
}
