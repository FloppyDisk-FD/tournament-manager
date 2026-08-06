import type { RequestEvent } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/permissions';

/**
 * 全局 layout：读取 Auth.js 会话（公开页可用，未登录不抛错）。
 * 会话读取逻辑统一在 $lib/server/permissions.ts。
 */
export const load = async (event: RequestEvent) => {
	return getSessionUser(event);
};
