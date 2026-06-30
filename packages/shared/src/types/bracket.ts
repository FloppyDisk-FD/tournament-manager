import type { TournamentFormat, TournamentStatus } from '../constants/tournament';
import type { MatchStatus, StageType } from '../constants/match';
import type { Team } from './team';

export interface BracketTeam {
  id: string;
  name: string;
  logo_url: string | null;
  seed: number | null;
}

export interface BracketMatch {
  id: string;
  bracket_pos: number | null;
  team1: BracketTeam | null;
  team2: BracketTeam | null;
  team1_score: number;
  team2_score: number;
  status: MatchStatus;
  round: number;
  position: number;
  games: {
    game_number: number;
    winner_id: string | null;
    map: string | null;
    duration: number | null;
  }[];
}

export interface BracketRound {
  round: number;
  name: string;
  matches: BracketMatch[];
}

export interface BracketStage {
  id: string;
  type: StageType;
  name: string;
  rounds: BracketRound[];
}

export interface BracketData {
  tournament: {
    id: string;
    name: string;
    format: TournamentFormat;
    status: TournamentStatus;
  };
  stages: BracketStage[];
}

export interface GenerateBracketRequest {
  seed_by: 'random' | 'manual';
  seed_order?: string[];
}
