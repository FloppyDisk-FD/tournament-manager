import type { AuthUser } from '../middleware/auth';

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

/** 赛事管理权：系统管理员，或赛事管理者且 created_by = 我 */
export function canManageTournament(
  user: AuthUser | null,
  tournament: { createdBy: string } | null | undefined,
): boolean {
  if (!user || !tournament) return false;
  if (user.role === 'admin') return true;
  return user.role === 'tournament_manager' && tournament.createdBy === user.id;
}

/** 队伍管理权：系统管理员，或队伍 owner（拥有即管理，不限角色） */
export function canManageTeam(
  user: AuthUser | null,
  team: { ownerId: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!team?.ownerId && team.ownerId === user.id;
}

/** 是否可创建赛事（系统管理员或赛事管理者） */
export function canCreateTournament(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'tournament_manager';
}

/** 是否可创建队伍（系统管理员或队伍管理员） */
export function canCreateTeam(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'team_manager';
}
