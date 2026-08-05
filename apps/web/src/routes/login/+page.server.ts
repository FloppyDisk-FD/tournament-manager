import { signIn } from '$lib/server/auth';
import type { Actions } from './$types';

/**
 * 登录/注册表单处理（Auth.js 集成）：
 * - 登录：使用 Auth.js 的 signIn Action（credentials provider 原生处理）
 * - 注册：先调 Hono /auth/register 建用户（含角色三选一），再跳登录
 */
export const actions: Actions = {
	login: signIn,
	register: async ({ request, fetch }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const role = String(form.get('role') ?? 'user');
		if (!username || !password) {
			return { error: '请输入用户名和密码' };
		}
		if (!['tournament_manager', 'team_manager', 'user'].includes(role)) {
			return { error: '无效的角色' };
		}
		try {
			const res = await fetch('/api/v1/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password, role }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				return { error: data?.error?.message ?? '注册失败' };
			}
		} catch {
			return { error: '注册失败，请重试' };
		}
		// 注册成功 → 引导到登录页（用户已填好表单，前端自动带参提交登录）
		return { registered: true };
	},
};
