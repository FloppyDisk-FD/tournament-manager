import { redirect, error } from '@sveltejs/kit';

/**
 * admin 树守卫：校验 Auth.js 会话 + 角色。
 * - 无会话 → 重定向登录
 * - 角色非 admin/tournament_manager → 403
 * （真正的写操作安全边界仍在 API 的 requireAdmin / canManageTournament）
 */
export const load = async (event) => {
	const auth = (event.locals as any).auth as (() => Promise<any>) | undefined;
	let session = null;
	try {
		session = auth ? await auth() : null;
	} catch {
		session = null;
	}
	const user = session?.user;
	if (!user?.id) {
		throw redirect(302, '/login');
	}
	const role = user.role ?? 'user';
	if (role !== 'admin' && role !== 'tournament_manager') {
		throw error(403, '需要赛事管理者或系统管理员权限');
	}
	return { authenticated: true, role, user: { id: user.id, username: user.name ?? '', role } };
};
