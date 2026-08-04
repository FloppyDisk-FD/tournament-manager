export const load = async ({ fetch }) => {
	let tournaments: any[] = [];
	try {
		const res = await fetch('/api/v1/tournaments?status=completed&limit=100', { credentials: 'include' });
		if (res.ok) {
			const data = await res.json();
			tournaments = data.items ?? [];
		}
	} catch (err) {
		console.error('[archived] fetch failed:', err);
	}
	return { tournaments };
};
