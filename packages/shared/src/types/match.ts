import type { MatchStatus, StageType } from '../constants/match';

export interface Match {
  id: string;
  stage_id: string;
  group_label: string | null;
  round: number;
  position: number;
  bracket_pos: number | null;
  team1_id: string | null;
  team2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  team1_score: number;
  team2_score: number;
  status: MatchStatus;
  scheduled_at: Date | null;
  next_match_id: string | null;
  next_losers_match_id: string | null;
  swiss_score_group: number | null;
}

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  winner_id: string | null;
  score: Record<string, unknown> | null;
  duration: number | null;
  map: string | null;
  vod_url: string | null;
}

export interface Stage {
  id: string;
  tournament_id: string;
  type: StageType;
  name: string;
  order: number;
}

export interface SubmitScoreRequest {
  games: {
    game_number: number;
    winner_id: string;
    map?: string;
    duration?: number;
  }[];
}
