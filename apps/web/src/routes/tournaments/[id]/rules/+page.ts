import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }) => {
	let tournament: any = null;

	try {
		const res = await fetch(`/api/v1/tournaments/${params.id}`, { credentials: 'include' });
		if (res.ok) {
			tournament = await res.json();
		} else if (res.status === 404) {
			throw error(404, '赛事不存在');
		} else {
			console.error('[tournament rules] API returned', res.status, await res.text().catch(() => ''));
			throw error(res.status, '加载赛事失败');
		}
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('[tournament rules] fetch tournament failed:', err);
		throw error(500, '加载赛事失败');
	}

	return { tournament };
};
