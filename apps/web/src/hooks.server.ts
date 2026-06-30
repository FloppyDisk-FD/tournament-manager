/**
 * SvelteKit 服务端 hooks：在 Cloudflare Pages 上通过 service binding 转发 /api/* 给 API Worker。
 *
 * 背景：adapter-cloudflare 生成的 _worker.js 会覆盖 functions/ 目录，
 * Pages Function 方案不可用。正确做法是在 SvelteKit 层拦截 /api/*，
 * 通过 event.platform.env.API（service binding）转发请求。
 *
 * - 同域转发，浏览器看到的始终是 Pages 域名，cookie 不跨域，无需 CORS
 * - 本地开发（vite dev）时 platform.env 不存在，跳过本 hook，回退到 vite proxy
 */
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// 只拦截 /api/* 请求
	if (!pathname.startsWith('/api/')) {
		return resolve(event);
	}

	// 本地开发没有 platform.env，交给 vite proxy 处理
	const api = event.platform?.env?.API;
	if (!api) {
		return resolve(event);
	}

	// service binding fetch 只关心 pathname + search，域名任意
	// 用 https://internal 占位，避免 Pages 域名带非标准端口导致 Worker 路由解析异常
	const targetUrl = `https://internal${pathname}${event.url.search}`;

	// 读取请求体（GET/DELETE 通常无 body，stream 不能重复消费，故按需构造）
	const init: RequestInit = {
		method: event.request.method,
		headers: event.request.headers,
	};

	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		// stream body 需要 duplex 标志
		init.body = event.request.body;
		(init as RequestInit & { duplex: 'half' }).duplex = 'half';
	}

	const apiReq = new Request(targetUrl, init);
	return api.fetch(apiReq);
};
