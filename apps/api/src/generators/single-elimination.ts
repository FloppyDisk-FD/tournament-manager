import type { Team, Match } from '../db/schema';
import type { BracketGenerator, GenerateResult, BracketSettings } from './types';

function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function standardSeeding(numSlots: number): number[] {
  const seeds: number[] = [1, 2];
  let round = 2;
  while (round < numSlots) {
    const newSeeds: number[] = [];
    for (const seed of seeds) {
      const opponent = round * 2 + 1 - seed;
      newSeeds.push(seed, opponent);
    }
    seeds.length = 0;
    seeds.push(...newSeeds);
    round *= 2;
  }
  return seeds;
}

export class SingleElimGenerator implements BracketGenerator {
  generate(teams: Team[], settings: BracketSettings): GenerateResult {
    const numTeams = teams.length;
    const numSlots = nextPowerOf2(numTeams);
    const totalRounds = Math.log2(numSlots);
    const seededOrder = standardSeeding(numSlots);

    const stage = {
      tournamentId: '',
      type: 'winners_bracket' as const,
      name: '淘汰赛',
      order: 0,
    };

    const matches: Omit<Match, 'id'>[] = [];
    const matchMap = new Map<string, number>(); // "round-position" -> index in matches

    // Generate all rounds
    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = numSlots / Math.pow(2, round);

      for (let pos = 0; pos < matchesInRound; pos++) {
        const bracketPos = Math.pow(2, totalRounds - 1) - 1 + pos + (round > 1 ? 0 : 0);
        // bracket_pos: 0=final, 1-2=semi, 3-6=quarter, 7-14=round1 of 16...
        const bp = pos + Math.pow(2, totalRounds - round) - 1;

        const match: Omit<Match, 'id'> = {
          stageId: '',
          groupLabel: null,
          round,
          position: pos,
          bracketPos: bp,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
          team1Score: 0,
          team2Score: 0,
          status: 'pending',
          scheduledAt: null,
          nextMatchId: null,
          nextLosersMatchId: null,
          swissScoreGroup: null,
        };

        // First round: assign teams by seeding
        if (round === 1) {
          const seed1 = seededOrder[pos * 2];
          const seed2 = seededOrder[pos * 2 + 1];

          const team1 = teams.find((t) => t.seed === seed1);
          const team2 = teams.find((t) => t.seed === seed2);

          if (team1) match.team1Id = team1.id;
          if (team2) match.team2Id = team2.id;

          // Walkthrough (bye) handling
          if (team1 && !team2) {
            match.status = 'walkthrough';
            match.winnerId = team1.id;
          }
          if (!team1 && team2) {
            match.status = 'walkthrough';
            match.winnerId = team2.id;
          }
        }

        matches.push(match);
        matchMap.set(`${round}-${pos}`, matches.length - 1);
      }
    }

    // Link matches: set nextMatchId
    for (let round = 1; round < totalRounds; round++) {
      const matchesInRound = numSlots / Math.pow(2, round);
      for (let pos = 0; pos < matchesInRound; pos++) {
        const currentIdx = matchMap.get(`${round}-${pos}`)!;
        const nextPos = Math.floor(pos / 2);
        const nextIdx = matchMap.get(`${round + 1}-${nextPos}`)!;
        matches[currentIdx].nextMatchId = `__match_${nextIdx}__` as any;
      }
    }

    // Third place match
    if (settings.thirdPlace && totalRounds >= 2) {
      const semiRound = totalRounds - 1;
      matches.push({
        stageId: '',
        groupLabel: null,
        round: totalRounds,
        position: 1,
        bracketPos: null,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        loserId: null,
        team1Score: 0,
        team2Score: 0,
        status: 'pending',
        scheduledAt: null,
        nextMatchId: null,
        nextLosersMatchId: null,
        swissScoreGroup: null,
      });

      // Link semi-final losers to third place match
      const thirdPlaceIdx = matches.length - 1;
      for (let pos = 0; pos < 2; pos++) {
        const semiIdx = matchMap.get(`${semiRound}-${pos}`)!;
        // Losers of semi go to third place match
        // We'll set nextLosersMatchId for the semi-finals
        matches[semiIdx].nextLosersMatchId = `__match_${thirdPlaceIdx}__` as any;
      }
    }

    return { stages: [stage], matches };
  }
}
