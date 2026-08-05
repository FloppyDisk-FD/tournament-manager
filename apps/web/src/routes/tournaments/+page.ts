import type { PageLoad } from './$types';

/**
 * 公开赛事发现页：SSR 初始数据（支持 query 参数：q/status/game/format/fee/page）
 */
export const load: PageLoad = async ({ url, fetch }) => {
	const params = new URLSearchParams();
	const q = url.searchParams.get('q') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const game = url.searchParams.get('game') ?? '';
	const format = url.searchParams.get('format') ?? '';
	const fee = url.searchParams.get('fee') ?? '';
	const page = url.searchParams.get('page') ?? '1';

	if (q) params.set('q', q);
	if (status) params.set('status', status);
	if (game) params.set('game', game);
	if (format) params.set('format', format);
	if (fee) params.set('fee', fee);
	params.set('page', page);
	params.set('limit', '12');

	try {
		const res = await fetch(`/api/v1/tournaments?${params.toString()}`);
		if (!res.ok) throw new Error('加载失败');
		const data = await res.json();
		return {
			tournaments: data.items ?? [],
			total: data.total ?? 0,
			page: Number(page) || 1,
			limit: data.limit ?? 12,
			filters: { q, status, game, format, fee },
		};
	} catch {
		return { tournaments: [], total: 0, page: 1, limit: 12, filters: { q, status, game, format, fee } };
	}
};
