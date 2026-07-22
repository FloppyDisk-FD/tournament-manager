import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
	if (!res1.ok) {
		throw error(res1.status === 404 ? 404 : 500, res1.status === 404 ? '赛事不存在' : '加载赛事失败');
	}
	const tournament = await res1.json();

	const res2 = await fetch(`/api/v1/tournaments/${params.id}/teams`, { credentials: 'include' });
	const rawTeams = res2.ok ? await res2.json() : [];
	const teams = Array.isArray(rawTeams) ? rawTeams : (rawTeams.items ?? []);

	return { tournament, teams };
};
