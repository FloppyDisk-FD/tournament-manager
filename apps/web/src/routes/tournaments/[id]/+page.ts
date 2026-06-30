export const load = async ({ params, fetch }) => {
	let tournament: any = null;
	let teams: any[] = [];

	try {
		const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
		if (res1.ok) tournament = await res1.json();
		else console.error('[tournament detail] API returned', res1.status, await res1.text().catch(() => ''));
	} catch (err) {
		console.error('[tournament detail] fetch tournament failed:', err);
	}

	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/teams`, { credentials: 'include' });
		if (res2.ok) {
			const rawTeams = await res2.json();
			teams = Array.isArray(rawTeams) ? rawTeams : (rawTeams.items ?? []);
		} else {
			console.error('[tournament detail] teams API returned', res2.status, await res2.text().catch(() => ''));
		}
	} catch (err) {
		console.error('[tournament detail] fetch teams failed:', err);
	}

	return { tournament, teams };
};
