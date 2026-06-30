export const TOURNAMENT_FORMAT = {
  SINGLE_ELIM: 'single_elim',
  DOUBLE_ELIM: 'double_elim',
  SWISS: 'swiss',
  ROUND_ROBIN: 'round_robin',
} as const;

export type TournamentFormat = (typeof TOURNAMENT_FORMAT)[keyof typeof TOURNAMENT_FORMAT];

export const TOURNAMENT_STATUS = {
  DRAFT: 'draft',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];
