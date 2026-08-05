import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import { AUTH_SECRET } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

/**
 * Auth.js 配置：
 * - Credentials 登录：调用 Hono API /auth/login 校验（沿用 users 表 + bcrypt）
 * - JWT session：role 经 jwt callback 注入 token，供 Hono 侧共享 secret 验证
 * - 注册走自定义 /auth/register 端点（保留角色三选一）
 *
 * 懒初始化（lazy config）：SvelteKitAuth 支持传入 async (event) => 配置，
 * 从 event.url.origin 取当前站点地址，供 authorize 拼 API 地址。
 * 生产（Pages Worker）：同域 /api/* 经 service binding 转发（hooks.server.ts handleFetch）；
 * 本地 dev：同域 /api/* 由 vite proxy 转发到本地 API。
 */
export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
	const origin = event.url.origin;
	return {
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
						// 同域 /api/*：生产经 service binding 转发，本地经 vite proxy 转发
						const apiBase = process.env.API_BASE_URL ?? '';
						const url = apiBase ? `${apiBase}/auth/login` : `${origin}/api/v1/auth/login`;
						const res = await fetch(url, {
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
	};
});

/** 供 SvelteKit 服务端 load 读取当前会话用户（含 role） */
export function sessionUser(session: any) {
	return session?.user ?? null;
}
