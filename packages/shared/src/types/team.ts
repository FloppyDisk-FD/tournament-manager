import type { TeamStatus } from '../constants/match';

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  seed: number | null;
  logo_url: string | null;
  status: TeamStatus;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_name: string;
  player_role: string | null;
}

export interface CreateTeamRequest {
  name: string;
  seed?: number;
  logo_url?: string;
  players?: { player_name: string; player_role?: string }[];
}
