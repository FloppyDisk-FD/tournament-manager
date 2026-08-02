export const load = async ({ fetch }) => {
	let stats = { tournaments: 0, ongoing: 0, completed: 0, teams: 0 };
	let recent: any[] = [];
	try {
		const data = await fetch('/api/v1/tournaments?limit=100&mine=1', { credentials: 'include' }).then((r) => r.json());
		const items: any[] = data.items ?? [];
		stats.tournaments = data.total ?? items.length;
		stats.ongoing = items.filter((t) => t.status === 'ongoing').length;
		stats.completed = items.filter((t) => t.status === 'completed').length;
		// 最近 5 个赛事（API 默认按创建时间倒序）
		recent = items.slice(0, 5);
	} catch (e) {
		console.error('[admin overview] fetch tournaments failed:', e);
	}
	try {
		const teamsData = await fetch('/api/v1/teams', { credentials: 'include' }).then((r) => r.json());
		stats.teams = Array.isArray(teamsData) ? teamsData.length : 0;
	} catch (e) {
		console.error('[admin overview] fetch teams failed:', e);
	}
	return { stats, recent };
};
