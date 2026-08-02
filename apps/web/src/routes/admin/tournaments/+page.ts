export const load = async ({ fetch }) => {
	const res = await fetch('/api/v1/tournaments?mine=1', { credentials: 'include' });
	const data = await res.json();
	return {
		tournaments: data.items ?? [],
		total: data.total ?? 0,
	};
};
