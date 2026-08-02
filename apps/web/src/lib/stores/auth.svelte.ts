import { api } from '$lib/api/client';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

let currentUser = $state<{ id: string; username: string; role: string } | null>(null);

export function getUser() {
	return currentUser;
}

export async function fetchUser() {
	if (!browser) return;
	try {
		const user = await api.get<{ id: string; username: string; role: string } | null>('/auth/me');
		if (user) {
			currentUser = user;
		}
	} catch {
		// 未登录或网络错误，不清除已有状态
	}
}

export async function login(username: string, password: string) {
	currentUser = await api.post<{ id: string; username: string; role: string }>('/auth/login', { username, password });
	return currentUser;
}

export async function register(username: string, password: string, role = 'user') {
	currentUser = await api.post<{ id: string; username: string; role: string }>('/auth/register', { username, password, role });
	return currentUser;
}

export async function logout() {
	await api.post('/auth/logout');
	currentUser = null;
	goto('/login');
}

export function isLoggedIn() {
	return currentUser !== null;
}

export function isAdmin() {
	return currentUser?.role === 'admin';
}
