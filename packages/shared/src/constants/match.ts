export const MATCH_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  WALKTHROUGH: 'walkthrough',
} as const;

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

export const STAGE_TYPE = {
  GROUP: 'group',
  WINNERS_BRACKET: 'winners_bracket',
  LOSERS_BRACKET: 'losers_bracket',
  GRAND_FINAL: 'grand_final',
  ROUND_ROBIN: 'round_robin',
  SWISS: 'swiss',
} as const;

export type StageType = (typeof STAGE_TYPE)[keyof typeof STAGE_TYPE];

export const TEAM_STATUS = {
  ACTIVE: 'active',
  ELIMINATED: 'eliminated',
  WITHDRAWN: 'withdrawn',
} as const;

export type TeamStatus = (typeof TEAM_STATUS)[keyof typeof TEAM_STATUS];
