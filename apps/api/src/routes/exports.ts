import { Hono } from 'hono';
import { eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../db';
import { tournaments, registrations, users, tournamentTeams, teams, stages, matches, standings, payments } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { canManageTournament } from '../services/perm';

/** 赛事数据统计与 CSV 导出（/api/v1/tournaments/:id/stats、/export/*.csv） */
export const exportRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
exportRoutes.use('*', authMiddleware);
exportRoutes.use('/:id/*', async (c, next) => { requireUuid(c.req.param('id'), '赛事'); await next(); });

const REG_STATUS_LABEL: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
const MATCH_STATUS_LABEL: Record<string, string> = { pending: '未开始', in_progress: '进行中', completed: '已结束', walkthrough: '轮空' };
const STAGE_TYPE_LABEL: Record<string, string> = {
  group: '小组赛',
  winners_bracket: '胜者组',
  losers_bracket: '败者组',
  grand_final: '决赛',
  round_robin: '循环赛',
  swiss: '瑞士轮',
};

/** 校验赛事存在 + 管理权限，返回赛事 */
async function requireManager(c: any, tournamentId: string) {
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), tournament)) throw new AppError('FORBIDDEN', '无权操作该赛事', 403);
  return tournament;
}

/** CSV 单元格转义（逗号/引号/换行加引号包裹） */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 生成 CSV 响应：UTF-8 BOM（Excel 中文不乱码）+ RFC 5987 文件名 */
function csvResponse(filename: string, rows: unknown[][]): Response {
  const body = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

// ========== 统计概览 ==========
exportRoutes.get('/:id/stats', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const tournament = await requireManager(c, id);
  const db = c.get('db');

  const [regRows] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where status = 'pending')::int`,
    approved: sql<number>`count(*) filter (where status = 'approved')::int`,
    rejected: sql<number>`count(*) filter (where status = 'rejected')::int`,
  }).from(registrations).where(eq(registrations.tournamentId, id));

  const [teamRows] = await db.select({
    total: sql<number>`count(*)::int`,
    checkedIn: sql<number>`count(*) filter (where checked_in)::int`,
  }).from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));

  const stageRows = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, id));
  const stageIds = stageRows.map((s) => s.id);
  let matchStats = { total: 0, completed: 0, inProgress: 0 };
  if (stageIds.length > 0) {
    const [m] = await db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
    }).from(matches).where(inArray(matches.stageId, stageIds));
    matchStats = m;
  }

  const [payRows] = await db.select({
    paid: sql<number>`count(*) filter (where status = 'paid')::int`,
    amount: sql<number>`coalesce(sum(amount) filter (where status = 'paid'), 0)::int`,
  }).from(payments).where(eq(payments.tournamentId, id));

  return c.json({
    tournament: { id: tournament.id, name: tournament.name, entryFee: tournament.entryFee },
    registrations: regRows,
    teams: teamRows,
    matches: matchStats,
    payments: payRows,
  });
});

// ========== 报名名单 CSV ==========
exportRoutes.get('/:id/export/registrations.csv', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const tournament = await requireManager(c, id);
  const rows = await c.get('db').select({
    reg: registrations,
    user: { username: users.username },
  })
    .from(registrations)
    .leftJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.tournamentId, id))
    .orderBy(registrations.createdAt);

  const csv = [
    ['队伍', '申请人', '状态', '报名时间', '备注'],
    ...rows.map((r) => [
      r.reg.teamName,
      r.user?.username ?? '',
      REG_STATUS_LABEL[r.reg.status] ?? r.reg.status,
      r.reg.createdAt ? r.reg.createdAt.toISOString().slice(0, 16).replace('T', ' ') : '',
      r.reg.note ?? '',
    ]),
  ];
  return csvResponse(`${tournament.name}-报名名单.csv`, csv);
});

// ========== 赛程 CSV ==========
exportRoutes.get('/:id/export/bracket.csv', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const tournament = await requireManager(c, id);
  const db = c.get('db');

  const stageRows = await db.select().from(stages).where(eq(stages.tournamentId, id)).orderBy(stages.order);
  if (stageRows.length === 0) {
    return csvResponse(`${tournament.name}-赛程.csv`, [['阶段', '轮次', '队伍A', '比分', '比分', '队伍B', '状态'], ['未生成赛程']]);
  }

  const t1 = alias(teams, 't1');
  const t2 = alias(teams, 't2');
  const matchRows = await db.select({
    match: matches,
    team1Name: t1.name,
    team2Name: t2.name,
  })
    .from(matches)
    .leftJoin(t1, eq(t1.id, matches.team1Id))
    .leftJoin(t2, eq(t2.id, matches.team2Id))
    .where(inArray(matches.stageId, stageRows.map((s) => s.id)))
    .orderBy(matches.round, matches.position);

  const stageMap = new Map(stageRows.map((s) => [s.id, s]));
  const csv = [
    ['阶段', '轮次', '队伍A', '比分', '比分', '队伍B', '状态'],
    ...matchRows.map((r) => {
      const stage = stageMap.get(r.match.stageId);
      return [
        stage ? `${STAGE_TYPE_LABEL[stage.type] ?? stage.type} ${stage.name}` : '',
        `第${r.match.round}轮`,
        r.team1Name ?? '轮空',
        r.match.team1Score,
        r.match.team2Score,
        r.team2Name ?? '轮空',
        MATCH_STATUS_LABEL[r.match.status] ?? r.match.status,
      ];
    }),
  ];
  return csvResponse(`${tournament.name}-赛程.csv`, csv);
});

// ========== 积分榜 CSV ==========
exportRoutes.get('/:id/export/standings.csv', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const tournament = await requireManager(c, id);

  const rows = await c.get('db').select({
    standing: standings,
    teamName: teams.name,
  })
    .from(standings)
    .innerJoin(teams, eq(teams.id, standings.teamId))
    .where(eq(standings.tournamentId, id))
    .orderBy(sql`${standings.rank} nulls last`, sql`${standings.points} desc`, sql`${standings.gameDifference} desc`);

  const csv = [
    ['排名', '队伍', '胜', '负', '平', '净胜', '积分', '已赛', '小组'],
    ...rows.map((r) => [
      r.standing.rank ?? '',
      r.teamName,
      r.standing.wins,
      r.standing.losses,
      r.standing.draws,
      r.standing.gameDifference,
      r.standing.points,
      r.standing.roundPlayed,
      r.standing.groupLabel ?? '',
    ]),
  ];
  return csvResponse(`${tournament.name}-积分榜.csv`, csv);
});
