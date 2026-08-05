import type { RequestEvent } from '@sveltejs/kit';

/**
 * 读取 Auth.js 会话（SvelteKit 服务端）。
 * 通过 auth 的 locals 获取 session（由 Auth.js handle 注入）。
 */
export const load = async (event: RequestEvent) => {
	// Auth.js 通过 handle 挂载 event.locals.auth()
	const auth = (event.locals as any).auth as (() => Promise<any>) | undefined;
	let user: { id: string; username: string; role: string } | null = null;
	try {
		const session = auth ? await auth() : null;
		const su = session?.user;
		if (su?.id) {
			user = { id: su.id, username: su.name ?? '', role: su.role ?? 'user' };
		}
	} catch {
		user = null;
	}
	return { authenticated: !!user, user, role: user?.role };
};
