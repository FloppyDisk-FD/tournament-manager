export const load = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') ?? '';
	let tournaments: any[] = [];
	let total = 0;
	try {
		// 拉全量（API 上限 100）供首页搜索索引与轮播使用
		const qs = status ? `?status=${encodeURIComponent(status)}&limit=100` : '?limit=100';
		const res = await fetch(`/api/v1/tournaments${qs}`, { credentials: 'include' });
		if (res.ok) {
			const data = await res.json();
			tournaments = data.items ?? [];
			total = data.total ?? 0;
		} else {
			console.error('[+page] API returned', res.status, await res.text().catch(() => ''));
		}
	} catch (err) {
		console.error('[+page] fetch failed:', err);
	}
	return { tournaments, total, currentStatus: status };
};
