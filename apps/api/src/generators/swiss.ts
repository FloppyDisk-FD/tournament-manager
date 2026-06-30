import type { Team, Match, Stage } from '../db/schema';
import type { BracketGenerator, GenerateResult, BracketSettings } from './types';

export class SwissGenerator implements BracketGenerator {
  generate(teams: Team[], _settings: BracketSettings): GenerateResult {
    // Swiss only generates round 1; subsequent rounds generated dynamically
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const matches: Omit<Match, 'id'>[] = [];

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      matches.push({
        stageId: '',
        groupLabel: null,
        round: 1,
        position: Math.floor(i / 2),
        bracketPos: null,
        team1Id: shuffled[i].id,
        team2Id: shuffled[i + 1].id,
        winnerId: null,
        loserId: null,
        team1Score: 0,
        team2Score: 0,
        status: 'pending',
        scheduledAt: null,
        nextMatchId: null,
        nextLosersMatchId: null,
        swissScoreGroup: 0, // All start at 0 points
      });
    }

    // Odd team gets a bye
    if (shuffled.length % 2 !== 0) {
      const lastTeam = shuffled[shuffled.length - 1];
      matches.push({
        stageId: '',
        groupLabel: null,
        round: 1,
        position: matches.length,
        bracketPos: null,
        team1Id: lastTeam.id,
        team2Id: null,
        winnerId: lastTeam.id,
        loserId: null,
        team1Score: 0,
        team2Score: 0,
        status: 'walkthrough',
        scheduledAt: null,
        nextMatchId: null,
        nextLosersMatchId: null,
        swissScoreGroup: 0,
      });
    }

    const stage = {
      tournamentId: '',
      type: 'swiss' as const,
      name: '瑞士轮',
      order: 0,
    };

    return { stages: [stage], matches };
  }

  /** Generate next round based on current standings - called from API */
  generateNextRound(
    teams: Team[],
    currentRound: number,
    standings: { teamId: string; points: number; wins: number; losses: number }[],
    playedPairs: Set<string>,
  ): Omit<Match, 'id'>[] {
    // Sort by points descending
    const sorted = [...standings].sort((a, b) => b.points - a.points);
    const matched = new Set<string>();
    const matches: Omit<Match, 'id'>[] = [];

    for (const entry of sorted) {
      if (matched.has(entry.teamId)) continue;

      // Find closest points opponent not yet matched and not played before
      let opponent: typeof entry | null = null;
      for (const candidate of sorted) {
        if (candidate.teamId === entry.teamId) continue;
        if (matched.has(candidate.teamId)) continue;
        const pairKey = [entry.teamId, candidate.teamId].sort().join('-');
        if (playedPairs.has(pairKey)) continue;
        opponent = candidate;
        break; // Greedy: first valid match
      }

      if (opponent) {
        matched.add(entry.teamId);
        matched.add(opponent.teamId);

        const team1 = teams.find((t) => t.id === entry.teamId)!;
        matches.push({
          stageId: '',
          groupLabel: null,
          round: currentRound + 1,
          position: matches.length,
          bracketPos: null,
          team1Id: entry.teamId,
          team2Id: opponent.teamId,
          winnerId: null,
          loserId: null,
          team1Score: 0,
          team2Score: 0,
          status: 'pending',
          scheduledAt: null,
          nextMatchId: null,
          nextLosersMatchId: null,
          swissScoreGroup: entry.points,
        });
      }
    }

    return matches;
  }
}
