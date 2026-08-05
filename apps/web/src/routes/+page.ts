export const load = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') ?? '';
	let tournaments: any[] = [];
	let allTournaments: any[] = [];
	let total = 0;
	try {
		// 列表：按当前状态筛选
		const qs = status ? `?status=${encodeURIComponent(status)}&limit=100` : '?limit=100';
		const [listRes, allRes] = await Promise.all([
			fetch(`/api/v1/tournaments${qs}`, { credentials: 'include' }),
			// 全量：轮播图与搜索索引不随选项卡变化
			fetch('/api/v1/tournaments?limit=100', { credentials: 'include' }),
		]);
		if (listRes.ok) {
			const data = await listRes.json();
			tournaments = data.items ?? [];
			total = data.total ?? 0;
		} else {
			console.error('[+page] API returned', listRes.status, await listRes.text().catch(() => ''));
		}
		if (allRes.ok) {
			const data = await allRes.json();
			allTournaments = data.items ?? [];
		} else {
			console.error('[+page] all API returned', allRes.status);
		}
	} catch (err) {
		console.error('[+page] fetch failed:', err);
	}
	return { tournaments, allTournaments, total, currentStatus: status };
};
