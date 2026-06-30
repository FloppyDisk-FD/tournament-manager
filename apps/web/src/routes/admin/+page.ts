export const load = async ({ fetch }) => {
	let stats = { tournaments: 0, ongoing: 0, teams: 0 };
	try {
		const data = await fetch('/api/v1/tournaments?limit=100', { credentials: 'include' }).then((r) => r.json());
		const items: any[] = data.items ?? [];
		stats.tournaments = data.total ?? items.length;
		stats.ongoing = items.filter((t) => t.status === 'ongoing').length;
	} catch {}
	return { stats };
};
