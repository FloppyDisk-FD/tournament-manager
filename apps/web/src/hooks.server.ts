/**
 * SvelteKit 服务端 hooks：在 Cloudflare Pages 上通过 service binding 转发 /api/* 给 API Worker。
 *
 * - handle:  拦截浏览器直接发起的 /api/* 请求，通过 service binding 转发
 * - handleFetch: 拦截 SSR load 函数中的 event.fetch('/api/*')，
 *                直接通过 service binding 转发，避免发起真实 HTTP 子请求
 *                （子请求在 Pages 环境下不稳定，会导致 SSR 间歇性失败）
 *
 * 本地开发（vite dev）时：
 * - SvelteKit/adapter 会用 miniflare 模拟 platform.env（含 API binding），
 *   但该模拟 Fetcher 与 Node 的 Request 不兼容（new Request(Request) 会抛错），
 *   因此 dev 模式下一律跳过 service binding，改走本地 API 的 HTTP 端口。
 * - 浏览器 /api/* 请求由 vite proxy 转发，不经过 handle。
 */
import { dev } from '$app/environment';
import type { Handle, HandleFetch } from '@sveltejs/kit';

/** 本地 API 端口（与 vite.config.ts 的 proxy 目标一致） */
const LOCAL_API = 'http://localhost:3001';

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
	if (dev) {
		// 本地开发：/api/* 由 vite proxy 处理，SvelteKit handle 不介入
		return resolve(event);
	}

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

	if (dev) {
		// 本地开发：改写 URL 为本地 API 端口，使 origin 与页面不同，
		// SvelteKit 才会发真实 HTTP 请求（同 origin 会走内部路由导致 404）。
		const apiUrl = new URL(url.pathname + url.search, LOCAL_API);
		return fetch(new Request(apiUrl, request));
	}

	const api = event.platform?.env?.API;
	if (!api) {
		return fetch(request);
	}

	const body = request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null;
	const apiReq = buildApiRequest(request.method, request.headers, body, url.pathname, url.search);
	return api.fetch(apiReq);
};
