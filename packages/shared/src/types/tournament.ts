import type { TournamentFormat, TournamentStatus } from '../constants/tournament';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string;
  cover_image: string | null;
  status: TournamentStatus;
  created_by: string;
  created_at: Date;
  start_date: Date | null;
  end_date: Date | null;
  format: TournamentFormat;
  team_size: number;
  max_teams: number;
  bo_count: number;
  has_group_stage: boolean;
  group_count: number | null;
  advance_per_group: number | null;
  third_place: boolean;
  swiss_rounds: number | null;
  format_config: Record<string, unknown> | null;
}

export interface CreateTournamentRequest {
  name: string;
  description: string;
  game: string;
  format: TournamentFormat;
  team_size: number;
  max_teams: number;
  bo_count: number;
  has_group_stage?: boolean;
  group_count?: number;
  advance_per_group?: number;
  third_place?: boolean;
  swiss_rounds?: number;
  format_config?: Record<string, unknown>;
}

export interface UpdateTournamentRequest extends Partial<CreateTournamentRequest> {
  description?: string;
  cover_image?: string;
  start_date?: string;
  end_date?: string;
  status?: TournamentStatus;
}
