// 用户管理（仅系统管理员）
export const load = async ({ fetch, url }) => {
	const q = url.searchParams.get('q') ?? '';
	const page = url.searchParams.get('page') ?? '1';
	let users: any[] = [];
	let total = 0;
	try {
		const qs = new URLSearchParams();
		if (q) qs.set('q', q);
		qs.set('page', page);
		qs.set('limit', '20');
		const res = await fetch(`/api/v1/admin/users?${qs.toString()}`, { credentials: 'include' });
		if (res.ok) {
			const data = await res.json();
			users = data.items ?? [];
			total = data.total ?? 0;
		}
	} catch (e) {
		console.error('[admin users] fetch failed:', e);
	}
	return { users, total, q, page: Number(page) };
};
