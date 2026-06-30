export const load = async ({ params, fetch }) => {
	const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
	const tournament = await res1.json();

	let matches: any[] = [];
	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/matches`, { credentials: 'include' });
		matches = await res2.json();
	} catch {}

	return { tournament, matches };
};
