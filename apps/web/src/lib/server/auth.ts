import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { AUTH_SECRET } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

/**
 * Auth.js 配置：
 * - Credentials 登录：调用 Hono API /auth/login 校验（沿用 users 表 + bcrypt）
 * - JWT session：role 经 jwt callback 注入 token，供 Hono 侧共享 secret 验证
 * - 注册走自定义 /auth/register 端点（保留角色三选一）
 */
export const { handle, signIn, signOut } = SvelteKitAuth({
	secret: AUTH_SECRET,
	session: { strategy: 'jwt' },
	trustHost: true,
	providers: [
		Credentials({
			name: 'Credentials',
			credentials: {
				username: { label: '用户名', type: 'text' },
				password: { label: '密码', type: 'password' },
			},
			async authorize(credentials) {
				const username = String(credentials?.username ?? '');
				const password = String(credentials?.password ?? '');
				if (!username || !password) return null;
				try {
					// 调用 Hono API 校验（cookie 无关，直接 POST）
					const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
					const res = await fetch(`${apiBase}/auth/login`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ username, password }),
					});
					if (!res.ok) return null;
					const user = await res.json();
					return { id: user.id, name: user.username, role: user.role };
				} catch {
					return null;
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			// 登录时把 role 注入 token
			if (user) {
				token.role = (user as any).role;
				token.id = user.id;
			}
			return token;
		},
		async session({ session, token }) {
			// 会话对象带 role/id，前端可直接读
			if (session.user) {
				(session.user as any).id = token.id as string;
				(session.user as any).role = token.role as string;
			}
			return session;
		},
	},
	pages: {
		signIn: '/login',
	},
});

/** 供 SvelteKit 服务端 load 读取当前会话用户（含 role） */
export function sessionUser(session: any) {
	return session?.user ?? null;
}
