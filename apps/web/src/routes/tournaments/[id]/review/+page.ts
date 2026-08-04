export const load = async ({ fetch, params }) => {
	let review: any = null;
	try {
		const res = await fetch(`/api/v1/tournaments/${params.id}/review`, { credentials: 'include' });
		if (res.ok) {
			review = await res.json();
		}
	} catch (err) {
		console.error('[review] fetch failed:', err);
	}
	return { review };
};
