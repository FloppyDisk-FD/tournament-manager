const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	// 写操作默认带幂等 key（组件可在操作开始时生成并复用，重试同 key 防重复创建）
	if (idempotencyKey || (method !== 'GET' && typeof crypto !== 'undefined' && crypto?.randomUUID)) {
		headers['Idempotency-Key'] = idempotencyKey ?? crypto.randomUUID();
	}
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		credentials: 'include',
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		let message = `请求失败 (${res.status})`;
		try {
			const json = JSON.parse(text);
			if (json?.error?.message) message = json.error.message;
			else if (typeof json?.error === 'string') message = json.error;
			else if (json?.message) message = json.message;
		} catch {}
		// 401 未授权：清除本地状态并跳转登录页
		if (res.status === 401) {
			if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
				window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
			}
			throw new Error('登录已过期，请重新登录');
		}
		throw new Error(message);
	}
	return res.json();
}

export const api = {
	get: <T = unknown>(path: string) => request<T>('GET', path),
	post: <T = unknown>(path: string, body?: unknown, key?: string) => request<T>('POST', path, body, key),
	put: <T = unknown>(path: string, body?: unknown, key?: string) => request<T>('PUT', path, body, key),
	del: <T = unknown>(path: string, body?: unknown, key?: string) => request<T>('DELETE', path, body, key),
};
