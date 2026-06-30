export const load = async ({ fetch }) => {
	const res = await fetch('/api/v1/teams', { credentials: 'include' });
	const raw = await res.json();
	const list = Array.isArray(raw) ? raw : (raw.items ?? []);
	// 后端返回 camelCase，前端统一用 snake_case
	const teams = list.map((t: any) => ({
		id: t.id,
		name: t.name,
		logo_emoji: t.logo_emoji ?? t.logoEmoji ?? '🏆',
		logo_url: t.logo_url ?? t.logoUrl ?? undefined,
		players: (t.players ?? []).map((p: any) => ({
			player_name: p.player_name ?? p.playerName ?? '',
			player_role: p.player_role ?? p.playerRole ?? 'member',
			game_id: p.game_id ?? p.gameId ?? '',
			avatar_emoji: p.avatar_emoji ?? p.avatarEmoji ?? '🦸',
			is_captain: p.is_captain ?? p.isCaptain ?? false,
		})),
	}));
	return { teams };
};
