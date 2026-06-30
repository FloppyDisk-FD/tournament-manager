import type { Team, Stage, Match } from '../db/schema';

export type { Team, Stage, Match };

export interface GenerateResult {
  stages: Omit<Stage, 'id'>[];
  matches: Omit<Match, 'id'>[];
}

export interface BracketGenerator {
  generate(teams: Team[], settings: BracketSettings): GenerateResult;
}

export interface BracketSettings {
  boCount: number;
  thirdPlace: boolean;
  hasGroupStage: boolean;
  groupCount: number | null;
  advancePerGroup: number | null;
  swissRounds: number | null;
  formatConfig: Record<string, unknown> | null;
}
