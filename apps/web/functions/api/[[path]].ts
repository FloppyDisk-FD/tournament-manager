/**
 * Pages Function: /api/* → API Worker (service binding)
 *
 * 通过 service binding 把 /api/* 请求转发给 tournament-manager-api Worker。
 * - 同域转发，浏览器看到的始终是 Pages 域名，cookie 不跨域，无需 CORS
 * - 需要在 Pages 项目 Settings > Functions > Service bindings 添加：
 *     API → tournament-manager-api
 *
 * 部署配置（Pages dashboard 或 wrangler.toml）：
 *   [[pages.services]]
 *   binding = "API"
 *   service = "tournament-manager-api"
 */

interface Env {
	API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (c) => {
	const url = new URL(c.request.url);
	// 透传完整请求（method/headers/body 不变），仅 URL 域名由 service binding 决定
	const apiReq = new Request(url, c.request);
	return c.env.API.fetch(apiReq);
};
