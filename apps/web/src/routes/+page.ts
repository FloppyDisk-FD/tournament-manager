export const load = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') ?? '';
	let tournaments: any[] = [];
	let total = 0;
	try {
		const qs = status ? `?status=${encodeURIComponent(status)}` : '';
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
