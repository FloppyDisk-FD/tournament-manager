/**
 * Pages Function: /api/* → API Worker (service binding)
 *
 * 通过 service binding 把 /api/* 请求转发给 tournament-manager-api Worker。
 * - 同域转发，浏览器看到的始终是 Pages 域名，cookie 不跨域，无需 CORS
 * - 需要在 Pages 项目 Settings > Functions > Service bindings 添加：
 *     API → tournament-manager-api
 */

interface Env {
	API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (c) => {
	const url = new URL(c.request.url);
	// service binding fetch 只关心 pathname + search，域名任意
	// 用 http://internal 占位，避免 Pages 域名带非标准端口导致 Worker 路由解析异常
	const targetUrl = `https://internal${url.pathname}${url.search}`;
	const apiReq = new Request(targetUrl, {
		method: c.request.method,
		headers: c.request.headers,
		body: c.request.body,
		duplex: 'half',
	});
	return c.env.API.fetch(apiReq);
};
