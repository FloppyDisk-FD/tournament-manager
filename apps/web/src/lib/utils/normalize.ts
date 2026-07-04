// apps/web/src/lib/utils/normalize.ts

export interface NormalizedPlayer {
  player_name: string;
  player_role: string;
  game_id: string;
  avatar_emoji: string;
  is_captain: boolean;
}

export interface NormalizedTeam {
  id: string;
  name: string;
  logo_emoji: string;
  logo_url?: string;
  seed?: number | null;
  status?: string;
  group_label?: string | null;
  players: NormalizedPlayer[];
}

/**
 * 后端返回字段命名混合（全局队伍库 camelCase，赛事内队伍 snake_case）。
 * 统一 normalize 为 snake_case，消除 svelte 模板里的 `??` 双兜底。
 */
export function normalizeTeam(t: any): NormalizedTeam {
  return {
    id: t.id,
    name: t.name,
    logo_emoji: t.logo_emoji ?? t.logoEmoji ?? '🏆',
    logo_url: t.logo_url ?? t.logoUrl ?? undefined,
    seed: t.seed ?? null,
    status: t.status,
    group_label: t.group_label ?? t.groupLabel ?? null,
    players: (t.players ?? []).map(normalizePlayer),
  };
}

export function normalizePlayer(p: any): NormalizedPlayer {
  return {
    player_name: p.player_name ?? p.playerName ?? '',
    player_role: p.player_role ?? p.playerRole ?? 'member',
    game_id: p.game_id ?? p.gameId ?? '',
    avatar_emoji: p.avatar_emoji ?? p.avatarEmoji ?? '🦸',
    is_captain: p.is_captain ?? p.isCaptain ?? false,
  };
}
