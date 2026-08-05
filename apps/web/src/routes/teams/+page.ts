// 公开队伍库（观众可见，无需登录）
export const load = async ({ fetch }) => {
	let teams: any[] = [];
	try {
		const res = await fetch('/api/v1/public/teams', { credentials: 'include' });
		if (res.ok) {
			const raw = await res.json();
			teams = Array.isArray(raw) ? raw : (raw.items ?? []);
		}
	} catch (err) {
		console.error('[teams] load failed:', err);
	}
	return { teams };
};
