import { requireTournamentManager } from '$lib/server/permissions';

/**
 * admin 树守卫：校验 Auth.js 会话 + 角色。
 * - 无会话 → 重定向登录
 * - 角色非 admin/tournament_manager → 403
 * （真正的写操作安全边界仍在 API 的 requireAdmin / canManageTournament）
 */
export const load = async (event) => {
	const user = await requireTournamentManager(event);
	return { authenticated: true, role: user.role, user: { id: user.id, username: user.username, role: user.role } };
};
