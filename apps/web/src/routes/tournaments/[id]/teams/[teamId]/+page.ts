// apps/web/src/routes/tournaments/[id]/teams/[teamId]/+page.ts
import { error } from '@sveltejs/kit';
import { normalizeTeam } from '$lib/utils/normalize';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { id: tournamentId, teamId } = params;

  // 1. 队伍信息 + 选手（从赛事队伍列表 filter）
  let team: any = null;
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/teams`, { credentials: 'include' });
    if (res.ok) {
      const allTeams = await res.json();
      const raw = (allTeams as any[]).find((t) => t.id === teamId);
      if (raw) team = normalizeTeam(raw);
      else throw error(404, '队伍不存在');
    } else if (res.status === 404) {
      throw error(404, '赛事不存在');
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[team detail] fetch teams failed:', err);
  }

  // 2. 比赛记录（从 bracket filter 出该队伍参与的比赛）
  let matches: any[] = [];
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/bracket`, { credentials: 'include' });
    if (res.ok) {
      const bracket = await res.json();
      matches = extractTeamMatches(bracket, teamId);
    } else {
      console.error('[team detail] bracket API returned', res.status);
    }
  } catch (err) {
    console.error('[team detail] fetch bracket failed:', err);
  }

  // 3. 积分排名（从 standings filter）
  let standing: any = null;
  try {
    const res = await fetch(`/api/v1/tournaments/${tournamentId}/standings`, { credentials: 'include' });
    if (res.ok) {
      const standings = await res.json();
      standing = (standings as any[]).find((s) => s.team?.id === teamId) ?? null;
    } else {
      console.error('[team detail] standings API returned', res.status);
    }
  } catch (err) {
    console.error('[team detail] fetch standings failed:', err);
  }

  return { tournamentId, teamId, team, matches, standing };
};

/** 从 bracket 结构中提取目标队伍的所有比赛，按 stage → round → 顺序展平 */
function extractTeamMatches(bracket: any, teamId: string): any[] {
  const result: any[] = [];
  for (const stage of bracket?.stages ?? []) {
    for (const round of stage?.rounds ?? []) {
      for (const match of round?.matches ?? []) {
        const isTeam1 = match.team1?.id === teamId;
        const isTeam2 = match.team2?.id === teamId;
        if (isTeam1 || isTeam2) {
          result.push({
            ...match,
            stageName: stage.name,
            round: round.round,
          });
        }
      }
    }
  }
  return result;
}
