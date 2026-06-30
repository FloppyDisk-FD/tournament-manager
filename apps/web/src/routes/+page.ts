export const load = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') ?? '';
	let tournaments: any[] = [];
	let total = 0;
	try {
		const qs = status ? `?status=${encodeURIComponent(status)}` : '';
		const data = await fetch(`/api/v1/tournaments${qs}`, { credentials: 'include' }).then((r) => r.json());
		tournaments = data.items ?? [];
		total = data.total ?? 0;
	} catch {}
	return { tournaments, total, currentStatus: status };
};
