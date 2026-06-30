export const load = async ({ params, fetch }) => {
	const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
	const tournament: any = await res1.json();

	let bracket: { stages: any[] } = { stages: [] };
	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/bracket`, { credentials: 'include' });
		bracket = await res2.json();
	} catch {}

	return { tournament, bracket };
};
