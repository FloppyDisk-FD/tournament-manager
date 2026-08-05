import { json } from '@sveltejs/kit';

/** 公开路由（静态部分） */
const STATIC_ROUTES = [
	'',
	'/tournaments',
	'/tournaments/archived',
	'/login',
	'/faq',
	'/privacy',
	'/terms',
];

/**
 * 动态 sitemap.xml（SSR）。
 * 静态公开路由 + 已发布赛事详情页（从 API 拉取）。
 * 生产域名通过 env PUBLIC_SITE_URL 注入（部署时配置）。
 */
export async function GET({ url, fetch }) {
	const base = (process.env.PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');

	let tournamentUrls: string[] = [];
	try {
		const res = await fetch(`${base}/api/v1/tournaments?limit=100`);
		if (res.ok) {
			const data = await res.json();
			const list = Array.isArray(data) ? data : data?.tournaments ?? [];
			tournamentUrls = list
				.filter((t: any) => t?.id)
				.map((t: any) => `<url><loc>${base}/tournaments/${t.id}</loc></url>`);
		}
	} catch {
		// API 不可用时仅返回静态路由
	}

	const staticXml = STATIC_ROUTES.map(
		(r) => `<url><loc>${base}${r}</loc></url>`,
	).join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${tournamentUrls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
