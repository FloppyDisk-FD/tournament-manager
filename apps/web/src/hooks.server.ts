/**
 * SvelteKit 服务端 hooks：在 Cloudflare Pages 上通过 service binding 转发 /api/* 给 API Worker。
 *
 * - handle:  拦截浏览器直接发起的 /api/* 请求，通过 service binding 转发
 * - handleFetch: 拦截 SSR load 函数中的 event.fetch('/api/*')，
 *                直接通过 service binding 转发，避免发起真实 HTTP 子请求
 *                （子请求在 Pages 环境下不稳定，会导致 SSR 间歇性失败）
 *
 * 本地开发（vite dev）时 platform.env 不存在，两者都回退到 vite proxy。
 */
import type { Handle, HandleFetch } from '@sveltejs/kit';

/** 构造转发给 API Worker 的 Request（service binding 只关心 pathname + search） */
function buildApiRequest(method: string, headers: Headers, body: ReadableStream<Uint8Array> | null, pathname: string, search: string): Request {
	const targetUrl = `https://internal${pathname}${search}`;
	const init: RequestInit = { method, headers };
	if (method !== 'GET' && method !== 'HEAD' && body) {
		init.body = body;
		(init as RequestInit & { duplex: 'half' }).duplex = 'half';
	}
	return new Request(targetUrl, init);
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (!pathname.startsWith('/api/')) {
		return resolve(event);
	}

	const api = event.platform?.env?.API;
	if (!api) {
		return resolve(event);
	}

	const req = buildApiRequest(
		event.request.method,
		event.request.headers,
		event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.body : null,
		pathname,
		event.url.search,
	);
	return api.fetch(req);
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	// 注意：handleFetch 的 event 是页面请求的 event（如首页 /），
	// request 才是 load 函数里 fetch 的实际请求（如 /api/v1/tournaments）。
	// 必须用 request.url 判断，不能用 event.url。
	const url = new URL(request.url);
	if (!url.pathname.startsWith('/api/')) {
		return fetch(request);
	}

	const api = event.platform?.env?.API;
	if (!api) {
		return fetch(request);
	}

	const body = request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null;
	const apiReq = buildApiRequest(request.method, request.headers, body, url.pathname, url.search);
	return api.fetch(apiReq);
};
