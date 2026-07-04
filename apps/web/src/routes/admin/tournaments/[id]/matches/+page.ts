import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	const res1 = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
	if (!res1.ok) {
		throw error(res1.status === 404 ? 404 : 500, res1.status === 404 ? '赛事不存在' : '加载赛事失败');
	}
	const tournament = await res1.json();

	let matches: any[] = [];
	try {
		const res2 = await fetch(`/api/v1/tournaments/${params.id}/matches`, { credentials: 'include' });
		if (res2.ok) matches = await res2.json();
	} catch {}

	return { tournament, matches };
};
