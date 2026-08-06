import { redirect, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * 统一权限 helper：所有 +layout.server.ts / +page.server.ts 的服务端守卫共用。
 * - auth.ts 负责认证机制（Auth.js handle），这里负责「如何读会话 + 如何放行/拒绝」。
 */

export interface SessionUser {
	id: string;
	username: string;
	role: string;
}

/** 从 locals.auth() 读取当前会话用户；无会话/失败返回 null（不抛错） */
export async function getOptionalUser(event: RequestEvent): Promise<SessionUser | null> {
	const auth = (event.locals as any).auth as (() => Promise<any>) | undefined;
	if (!auth) return null;
	try {
		const session = await auth();
		const su = session?.user;
		if (su?.id) {
			return { id: su.id, username: su.name ?? '', role: su.role ?? 'user' };
		}
	} catch {
		// 会话解析失败按未登录处理
	}
	return null;
}

/** 读取用户（公开页用）：返回 { user, authenticated, role }，不抛错 */
export async function getSessionUser(event: RequestEvent) {
	const user = await getOptionalUser(event);
	return { authenticated: !!user, user, role: user?.role };
}

/** 要求登录：未登录重定向到登录页（带回跳）；返回 user */
export async function requireAuth(event: RequestEvent): Promise<SessionUser> {
	const user = await getOptionalUser(event);
	if (!user) {
		const from = event.url.pathname + event.url.search;
		throw redirect(302, `/login?redirect=${encodeURIComponent(from)}`);
	}
	return user;
}

/** 要求指定角色之一：未登录重定向；角色不符 403 */
export async function requireRole(event: RequestEvent, roles: string[]): Promise<SessionUser> {
	const user = await requireAuth(event);
	if (!roles.includes(user.role)) {
		throw error(403, `需要${roles.join(' / ')}权限`);
	}
	return user;
}

/** 要求系统管理员 */
export function requireAdmin(event: RequestEvent) {
	return requireRole(event, ['admin']);
}

/** 要求赛事管理者（admin 或 tournament_manager） */
export function requireTournamentManager(event: RequestEvent) {
	return requireRole(event, ['admin', 'tournament_manager']);
}
