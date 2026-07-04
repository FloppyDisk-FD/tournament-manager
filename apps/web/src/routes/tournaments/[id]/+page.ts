import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	let tournament: any = null;

	try {
		const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
		if (res1.ok) {
			tournament = await res1.json();
		} else if (res1.status === 404) {
			throw error(404, '赛事不存在');
		} else {
			console.error('[tournament detail] API returned', res1.status, await res1.text().catch(() => ''));
			throw error(res1.status, '加载赛事失败');
		}
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('[tournament detail] fetch tournament failed:', err);
		throw error(500, '加载赛事失败');
	}

	let teams: any[] = [];
	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/teams`, { credentials: 'include' });
		if (res2.ok) {
			const rawTeams = await res2.json();
			teams = Array.isArray(rawTeams) ? rawTeams : (rawTeams.items ?? []);
		}
	} catch (err) {
		console.error('[tournament detail] fetch teams failed:', err);
	}

	return { tournament, teams };
};
