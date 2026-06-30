export const load = async ({ params, fetch }) => {
	const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
	const tournament = await res1.json();

	const res2 = await fetch(`/api/v1/tournaments/${params.id}/teams`, { credentials: 'include' });
	const rawTeams = await res2.json();
	const teams = Array.isArray(rawTeams) ? rawTeams : (rawTeams.items ?? []);

	return { tournament, teams };
};
