export const load = async ({ fetch }) => {
	const res = await fetch('/api/v1/tournaments', { credentials: 'include' });
	const data = await res.json();
	return {
		tournaments: data.items ?? [],
		total: data.total ?? 0,
	};
};
