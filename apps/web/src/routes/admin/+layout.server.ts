import { redirect, error } from '@sveltejs/kit';

/**
 * admin 树守卫：不仅校验已登录，还校验角色为 admin。
 *
 * 直接解码 cookie 里的 JWT 不验签是不安全的（可伪造 role），
 * 这里复用后端 /auth/me 端点做真实校验：
 * - 401/失败 → 未登录或 token 无效 → 重定向登录
 * - 200 但 role 非 admin → 403
 * （真正的写操作安全边界仍在 API 的 requireAdmin，此处负责 UI 层拦截）
 */
export const load = async ({ cookies, fetch }) => {
	const token = cookies.get('auth');
	if (!token) {
		throw redirect(302, '/login');
	}

	let role: string | undefined;
	try {
		// SSR fetch 自动携带请求 cookie，经 handleFetch 转发到 API
		const res = await fetch('/api/v1/auth/me');
		if (!res.ok) {
			throw redirect(302, '/login');
		}
		const me = await res.json();
		role = me?.role;
	} catch (err) {
		// 避免把 redirect 错误吞掉重定向成 500
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw redirect(302, '/login');
	}

	if (role !== 'admin') {
		throw error(403, '需要管理员权限');
	}

	return { authenticated: true };
};
