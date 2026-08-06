export const load = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') ?? '';
	let tournaments: any[] = [];
	let total = 0;
	try {
		// 单次全量请求：轮播图 / 列表共用同一份数据，状态筛选在客户端执行
		const res = await fetch('/api/v1/tournaments?limit=100', { credentials: 'include' });
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
	return { tournaments, allTournaments: tournaments, total, currentStatus: status };
};
