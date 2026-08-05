import { browser } from '$app/environment';
import { page } from '$app/state';

/**
 * Auth.js 会话访问：
 * - 用户信息来自 +layout.server.ts 的 load（data.user / data.role）
 * - 组件内通过 $app/state 的 page.data 读取（SSR 就绪，无内存 store 竞态）
 */
export interface AuthUser {
	id: string;
	username: string;
	role: string;
}

export function getUser(): AuthUser | null {
	const data = page.data as any;
	return data?.user ?? null;
}

export function isLoggedIn() {
	return !!getUser();
}

export function isAdmin() {
	return getUser()?.role === 'admin';
}

export function isTournamentManager() {
	const r = getUser()?.role;
	return r === 'admin' || r === 'tournament_manager';
}

/** 登出：调 Auth.js 的 signOut 端点后刷新页面 */
export async function logout() {
	if (!browser) return;
	// Auth.js signOut：先 POST /auth/signout 清 session，再回首页
	await fetch('/auth/signout', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ callbackUrl: '/' }),
	});
	window.location.href = '/';
}
