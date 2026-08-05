import type { PageLoad } from './$types';

/**
 * 公开赛事发现页：SSR 拉全量赛事（≤100），客户端 flexsearch 即时过滤 + 筛选。
 * 服务端只负责初始数据与 SEO；搜索/筛选/分页全在浏览器执行。
 */
export const load: PageLoad = async ({ url, fetch }) => {
	// 保留 query 参数以支持分享链接/SEO 深链
	const q = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const format = url.searchParams.get('format') ?? '';
	const fee = url.searchParams.get('fee') ?? '';

	try {
		const res = await fetch('/api/v1/tournaments?limit=100');
		if (!res.ok) throw new Error('加载失败');
		const data = await res.json();
		return {
			tournaments: data.items ?? [],
			total: data.total ?? 0,
			filters: { q, status, format, fee },
		};
	} catch {
		return { tournaments: [], total: 0, filters: { q, status, format, fee } };
	}
};
