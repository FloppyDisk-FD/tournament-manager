import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	let tournament: any;
	try {
		const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
		if (res1.ok) {
			tournament = await res1.json();
		} else if (res1.status === 404) {
			throw error(404, '赛事不存在');
		} else {
			throw error(res1.status, '加载赛事失败');
		}
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(500, '加载赛事失败');
	}

	let bracket: { stages: any[] } = { stages: [] };
	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/bracket`, { credentials: 'include' });
		if (res2.ok) bracket = await res2.json();
	} catch {}

	return { tournament, bracket };
};
