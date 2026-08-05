import { Hono } from 'hono';
import { eq, and, inArray, isNull, or, desc } from 'drizzle-orm';
import type { Db } from '../db';
import { teams, teamPlayers, tournaments, tournamentTeams, matches, stages, registrations, payments, standings } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { isAdmin, canManageTeam, canManageTournament, canCreateTeam } from '../services/perm';
import { refundRegistrationPayment } from '../services/refund';

// 公开队伍信息（赛程图 hover 详情等场景，无需登录）
export const publicTeamRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
// 公开队伍库列表（观众浏览，无需登录）
publicTeamRoutes.get('/', async (c) => {
  const db = c.get('db');
  const allTeams = await db
    .select()
    .from(teams)
    .where(and(isNull(teams.tournamentId), eq(teams.status, 'active')))
    .orderBy(teams.name);
  if (allTeams.length === 0) return c.json([]);
  const teamIds = allTeams.map((t) => t.id);
  const players = await db.select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
  const countByTeam = new Map<string, number>();
  for (const p of players) countByTeam.set(p.teamId, (countByTeam.get(p.teamId) ?? 0) + 1);
  return c.json(allTeams.map((t) => ({
    id: t.id,
    name: t.name,
    logoEmoji: t.logoEmoji,
    logoUrl: t.logoUrl,
    status: t.status,
    playerCount: countByTeam.get(t.id) ?? 0,
  })));
});
publicTeamRoutes.get('/:teamId', async (c) => {
  const { teamId } = c.req.param();
  requireUuid(teamId, '队伍');
  const [team] = await c.get('db').select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new AppError('NOT_FOUND', '队伍不存在', 404);
  const players = await c.get('db').select().from(teamPlayers).where(eq(teamPlayers.teamId, teamId));
  return c.json({
    id: team.id,
    name: team.name,
    logoEmoji: team.logoEmoji,
    logoUrl: team.logoUrl,
    players: players.map((p) => ({ id: p.id, name: p.playerName, role: p.playerRole, isCaptain: p.isCaptain })),
  });
});

// 战队主页：信息 + 成员 + 参赛记录 + 历史战绩（公开，无需登录）
publicTeamRoutes.get('/:teamId/profile', async (c) => {
  const { teamId } = c.req.param();
  requireUuid(teamId, '队伍');
  const db = c.get('db');
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw new AppError('NOT_FOUND', '队伍不存在', 404);

  const players = await db.select().from(teamPlayers).where(eq(teamPlayers.teamId, teamId));

  const entries = await db
    .select({
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      status: tournaments.status,
      seed: tournamentTeams.seed,
      groupLabel: tournamentTeams.groupLabel,
      checkedIn: tournamentTeams.checkedIn,
    })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournamentTeams.tournamentId, tournaments.id))
    .where(eq(tournamentTeams.teamId, teamId))
    .orderBy(desc(tournaments.createdAt));

  const played = await db
    .select()
    .from(matches)
    .where(and(or(eq(matches.team1Id, teamId), eq(matches.team2Id, teamId)), eq(matches.status, 'completed')))
    .orderBy(desc(matches.scheduledAt));

  const stageIds = [...new Set(played.map((m) => m.stageId))];
  let stageRows: { id: string; tournamentId: string }[] = [];
  if (stageIds.length) {
    stageRows = await db
      .select({ id: stages.id, tournamentId: stages.tournamentId })
      .from(stages)
      .where(inArray(stages.id, stageIds));
  }
  const tIds = [...new Set(stageRows.map((s) => s.tournamentId))];
  const nameById = new Map<string, string>();
  if (tIds.length) {
    const tRows = await db
      .select({ id: tournaments.id, name: tournaments.name })
      .from(tournaments)
      .where(inArray(tournaments.id, tIds));
    tRows.forEach((t) => nameById.set(t.id, t.name));
  }
  const stageTournament = new Map(stageRows.map((s) => [s.id, s.tournamentId] as const));

  // 对手名
  const opponentIds = [...new Set(played.map((m) => (m.team1Id === teamId ? m.team2Id : m.team1Id)).filter((x): x is string => !!x))];
  const oppNameById = new Map<string, string>();
  if (opponentIds.length) {
    const oppRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, opponentIds));
    oppRows.forEach((o) => oppNameById.set(o.id, o.name));
  }

  const wins = played.filter((m) => m.winnerId === teamId).length;
  const recent = played.slice(0, 10).map((m) => {
    const opponentId = m.team1Id === teamId ? m.team2Id : m.team1Id;
    const myScore = m.team1Id === teamId ? m.team1Score : m.team2Score;
    const oppScore = m.team1Id === teamId ? m.team2Score : m.team1Score;
    return {
      id: m.id,
      tournamentName: stageTournament.get(m.stageId) ? (nameById.get(stageTournament.get(m.stageId)!) ?? '未知赛事') : '未知赛事',
      opponentId,
      opponentName: opponentId ? (oppNameById.get(opponentId) ?? null) : null,
      myScore,
      oppScore,
      won: m.winnerId === teamId,
    };
  });

  return c.json({
    id: team.id,
    name: team.name,
    logoEmoji: team.logoEmoji,
    logoUrl: team.logoUrl,
    status: team.status,
    players: players.map((p) => ({
      id: p.id,
      name: p.playerName,
      role: p.playerRole,
      gameId: p.gameId,
      avatarUrl: p.avatarUrl,
      isCaptain: p.isCaptain,
    })),
    tournaments: entries,
    stats: { played: played.length, wins, losses: played.length - wins },
    recent,
  });
});

// 全局队伍库路由（/api/v1/teams）
export const globalTeamRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
globalTeamRoutes.use('*', authMiddleware, requireAuth);

globalTeamRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  if (!isAdmin(user)) throw new AppError('FORBIDDEN', '需要系统管理员权限', 403);
  const allTeams = await c.get('db').select().from(teams).where(isNull(teams.tournamentId));
  const teamIds = allTeams.map((t) => t.id);
  if (teamIds.length === 0) return c.json([]);
  const players = await c.get('db').select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
  const playersByTeam = new Map<string, typeof players>();
  for (const p of players) {
    const arr = playersByTeam.get(p.teamId) ?? [];
    arr.push(p);
    playersByTeam.set(p.teamId, arr);
  }
  return c.json(allTeams.map((t) => ({ ...t, players: playersByTeam.get(t.id) ?? [] })));
});

// 我的队伍（登录用户拥有，供报名选择/后台管理）
globalTeamRoutes.get('/my/teams', async (c) => {
  const user = c.get('user')!;
  const myTeams = await c.get('db').select().from(teams)
    .where(and(eq(teams.ownerId, user.id), isNull(teams.tournamentId)));
  const teamIds = myTeams.map((t) => t.id);
  if (teamIds.length === 0) return c.json([]);
  const players = await c.get('db').select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
  const playersByTeam = new Map<string, typeof players>();
  for (const p of players) {
    const arr = playersByTeam.get(p.teamId) ?? [];
    arr.push(p);
    playersByTeam.set(p.teamId, arr);
  }
  return c.json(myTeams.map((t) => ({ ...t, players: playersByTeam.get(t.id) ?? [] })));
});

globalTeamRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  if (!canCreateTeam(user)) throw new AppError('FORBIDDEN', '创建队伍需要队伍管理员或系统管理员权限', 403);
  const data = await c.req.json();
  const [team] = await c.get('db').insert(teams).values({
    name: data.name,
    logoUrl: data.logo_url,
    logoEmoji: data.logo_emoji,
    tournamentId: null as any,
    ownerId: user.id,
  }).returning();

  if (data.players && Array.isArray(data.players) && data.players.length > 0) {
    await c.get('db').insert(teamPlayers).values(
      data.players.map((p: any) => ({
        teamId: team.id,
        playerName: p.player_name,
        playerRole: p.player_role,
        gameId: p.game_id,
        avatarUrl: p.avatar_url,
        isCaptain: p.is_captain ?? false,
      })),
    );
  }
  c.status(201);
  return c.json(team);
});

globalTeamRoutes.put('/:teamId', async (c) => {
  const teamId = c.req.param('teamId');
  const [team] = await c.get('db').select().from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.tournamentId))).limit(1);
  if (!canManageTeam(c.get('user'), team)) throw new AppError('FORBIDDEN', '无权管理该队伍', 403);
  const data = await c.req.json();
  const [updated] = await c.get('db').update(teams).set({
    name: data.name,
    logoUrl: data.logo_url,
    logoEmoji: data.logo_emoji,
  }).where(eq(teams.id, teamId)).returning();
  if (!updated) throw new AppError('NOT_FOUND', '队伍不存在', 404);

  // 选手更新：全量替换
  if (data.players && Array.isArray(data.players)) {
    await c.get('db').delete(teamPlayers).where(eq(teamPlayers.teamId, teamId));
    if (data.players.length > 0) {
      await c.get('db').insert(teamPlayers).values(
        data.players.map((p: any) => ({
          teamId,
          playerName: p.player_name,
          playerRole: p.player_role,
          gameId: p.game_id,
          avatarUrl: p.avatar_url,
          isCaptain: p.is_captain ?? false,
        })),
      );
    }
  }
  return c.json(updated);
});

globalTeamRoutes.delete('/:teamId', async (c) => {
  const teamId = c.req.param('teamId');
  const [existing] = await c.get('db').select().from(teams).where(and(eq(teams.id, teamId), isNull(teams.tournamentId))).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '队伍不存在', 404);
  if (!canManageTeam(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该队伍', 403);
  await c.get('db').delete(teamPlayers).where(eq(teamPlayers.teamId, teamId));
  await c.get('db').delete(tournamentTeams).where(eq(tournamentTeams.teamId, teamId));
  // H6：清理报名（含支付退款）、比赛引用、积分榜（no action 外键，避免 500）
  const regRows = await c.get('db').select().from(registrations).where(eq(registrations.teamId, teamId));
  for (const r of regRows) {
    await refundRegistrationPayment(c.get('db'), r.id, { notifyUser: false });
  }
  await c.get('db').delete(registrations).where(eq(registrations.teamId, teamId));
  await c.get('db').update(matches).set({
    team1Id: null, team2Id: null, winnerId: null, loserId: null,
  }).where(or(eq(matches.team1Id, teamId), eq(matches.team2Id, teamId)));
  await c.get('db').update(matches).set({ winnerId: null }).where(eq(matches.winnerId, teamId));
  await c.get('db').update(matches).set({ loserId: null }).where(eq(matches.loserId, teamId));
  await c.get('db').delete(standings).where(eq(standings.teamId, teamId));
  await c.get('db').delete(teams).where(eq(teams.id, teamId));
  return c.json({ message: '队伍已删除' });
});

// 赛事内队伍路由（/api/v1/tournaments/:id/teams）
export const teamRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
teamRoutes.use('*', authMiddleware);
// 校验赛事 ID 为合法 UUID，避免非 UUID 字符串触发 DB 语法错误返回 500
teamRoutes.use('*', async (c, next) => { requireUuid(c.req.param('id')! ?? '', '赛事'); await next(); });

// 列出赛事队伍（公开）
teamRoutes.get('/', async (c) => {
  const id = c.req.param('id')!;
  const rows = await c.get('db').select({
    entry: tournamentTeams,
    team: teams,
  })
    .from(tournamentTeams)
    .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
    .where(eq(tournamentTeams.tournamentId, id));

  if (rows.length === 0) return c.json([]);
  const teamIds = rows.map((r) => r.team.id);
  const players = await c.get('db').select().from(teamPlayers).where(inArray(teamPlayers.teamId, teamIds));
  const playersByTeam = new Map<string, typeof players>();
  for (const p of players) {
    const arr = playersByTeam.get(p.teamId) ?? [];
    arr.push(p);
    playersByTeam.set(p.teamId, arr);
  }
  return c.json(rows.map((r) => ({
    id: r.team.id,
    name: r.team.name,
    logo_url: r.team.logoUrl,
    logo_emoji: r.team.logoEmoji,
    seed: r.entry.seed,
    status: r.entry.status,
    group_label: r.entry.groupLabel,
    players: playersByTeam.get(r.team.id) ?? [],
  })));
});

// 以下为管理员路由（赛事管理者或系统管理员）
teamRoutes.use('*', async (c, next) => {
  const id = c.req.param('id')!;
  const user = c.get('user')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!canManageTournament(user, tournament)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  await next();
});

teamRoutes.post('/import', async (c) => {
  const id = c.req.param('id')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

  const data = await c.req.json();
  if (!data.team_ids || data.team_ids.length === 0) throw new AppError('INVALID_INPUT', '未选择队伍');

  // 验证 team_id 是否存在（防止前端缓存了已删除队伍的旧 ID 触发 FK 错误）
  const validTeams = await c.get('db').select({ id: teams.id }).from(teams)
    .where(inArray(teams.id, data.team_ids));
  const validIds = new Set(validTeams.map((t) => t.id));
  const skipped = data.team_ids.filter((tid: string) => !validIds.has(tid));

  const existingEntries = await c.get('db').select().from(tournamentTeams)
    .where(and(eq(tournamentTeams.tournamentId, id), inArray(tournamentTeams.teamId, data.team_ids)));
  const existingIds = new Set(existingEntries.map((e) => e.teamId));
  const newTeamIds = data.team_ids.filter((tid: string) => validIds.has(tid) && !existingIds.has(tid));

  const currentCount = (await c.get('db').select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id))).length;
  if (currentCount + newTeamIds.length > tournament.maxTeams) {
    throw new AppError('TEAM_LIMIT_EXCEEDED', '加入会超出队伍上限');
  }

  if (newTeamIds.length === 0) {
    return c.json({ message: '队伍已在赛事中', added: 0, skipped });
  }

  const inserted = await c.get('db').insert(tournamentTeams).values(
    newTeamIds.map((tid: string, i: number) => ({
      tournamentId: id,
      teamId: tid,
      seed: currentCount + i + 1,
    })),
  ).returning();

  c.status(201);
  return c.json({ message: '队伍已加入赛事', added: inserted.length, skipped });
});

teamRoutes.post('/', async (c) => {
  const id = c.req.param('id')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

  const data = await c.req.json();
  const teamCount = (await c.get('db').select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id))).length;
  if (teamCount >= tournament.maxTeams) throw new AppError('TEAM_LIMIT_EXCEEDED', '队伍数已达上限');

  const [team] = await c.get('db').insert(teams).values({
    tournamentId: id,
    name: data.name,
    logoUrl: data.logo_url,
    logoEmoji: data.logo_emoji,
  }).returning();
  await c.get('db').insert(tournamentTeams).values({
    tournamentId: id,
    teamId: team.id,
    seed: teamCount + 1,
  });

  if (data.players && Array.isArray(data.players) && data.players.length > 0) {
    await c.get('db').insert(teamPlayers).values(
      data.players.map((p: any) => ({
        teamId: team.id,
        playerName: p.player_name,
        playerRole: p.player_role,
        gameId: p.game_id,
        avatarUrl: p.avatar_url,
        isCaptain: p.is_captain ?? false,
      })),
    );
  }

  c.status(201);
  return c.json(team);
});

teamRoutes.post('/batch', async (c) => {
  const id = c.req.param('id')!;
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (tournament.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始');

  const data = await c.req.json();
  if (!data.names || data.names.length === 0) throw new AppError('INVALID_INPUT', '队伍名称不能为空');
  const teamCount = (await c.get('db').select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, id))).length;
  if (teamCount + data.names.length > tournament.maxTeams) {
    throw new AppError('TEAM_LIMIT_EXCEEDED', '批量添加会超出队伍上限');
  }

  const inserted = await c.get('db').insert(teams).values(
    data.names.map((name: string) => ({
      tournamentId: id,
      name,
    })),
  ).returning();
  await c.get('db').insert(tournamentTeams).values(
    inserted.map((t, i) => ({
      tournamentId: id,
      teamId: t.id,
      seed: teamCount + i + 1,
    })),
  );

  c.status(201);
  return c.json(inserted);
});

teamRoutes.put('/:teamId', async (c) => {
  const id = c.req.param('id')!;
  const teamId = c.req.param('teamId');
  const data = await c.req.json();
  const [updated] = await c.get('db').update(teams).set({
    name: data.name,
    logoUrl: data.logo_url,
    logoEmoji: data.logo_emoji,
  }).where(eq(teams.id, teamId)).returning();
  if (!updated) throw new AppError('NOT_FOUND', '队伍不存在', 404);

  if (data.seed !== undefined || data.status || data.group_label !== undefined) {
    await c.get('db').update(tournamentTeams).set({
      seed: data.seed,
      status: data.status,
      groupLabel: data.group_label,
    }).where(and(eq(tournamentTeams.teamId, teamId), eq(tournamentTeams.tournamentId, id)));
  }

  if (data.players && Array.isArray(data.players)) {
    await c.get('db').delete(teamPlayers).where(eq(teamPlayers.teamId, teamId));
    if (data.players.length > 0) {
      await c.get('db').insert(teamPlayers).values(
        data.players.map((p: any) => ({
          teamId,
          playerName: p.player_name,
          playerRole: p.player_role,
          gameId: p.game_id,
          avatarUrl: p.avatar_url,
          isCaptain: p.is_captain ?? false,
        })),
      );
    }
  }
  return c.json(updated);
});

teamRoutes.delete('/:teamId', async (c) => {
  const id = c.req.param('id')!;
  const teamId = c.req.param('teamId');
  const [entry] = await c.get('db').select().from(tournamentTeams)
    .where(and(eq(tournamentTeams.teamId, teamId), eq(tournamentTeams.tournamentId, id))).limit(1);
  if (!entry) throw new AppError('NOT_FOUND', '队伍不在此赛事中', 404);

  await c.get('db').delete(tournamentTeams).where(eq(tournamentTeams.id, entry.id));

  // 联动：处理该队伍在此赛事的报名记录（移除 = 拒绝报名）
  const [reg] = await c.get('db').select().from(registrations)
    .where(and(eq(registrations.tournamentId, id), eq(registrations.teamId, teamId))).limit(1);
  if (reg) {
    // 已支付 → 自动退款（mock 环境直接标记 refunded；真实网关留适配）
    const [pay] = await c.get('db').select().from(payments)
      .where(eq(payments.registrationId, reg.id)).limit(1);
    if (pay && pay.status === 'paid') {
      // TODO: provider === 'waffo' 时调用 Waffo 退款 API（refund 端点）
      await c.get('db').update(payments)
        .set({ status: 'refunded', refundedAt: new Date() })
        .where(eq(payments.id, pay.id));
    }
    // 报名置为拒绝，注明原因；前端显示后可重新申请
    await c.get('db').update(registrations)
      .set({ status: 'rejected', note: '已被主办方移除，报名已关闭' })
      .where(eq(registrations.id, reg.id));
  }

  // 如果队伍绑定了此赛事（旧数据），删除它及其选手
  const [team] = await c.get('db').select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (team && team.tournamentId === id) {
    await c.get('db').delete(teamPlayers).where(eq(teamPlayers.teamId, teamId));
    await c.get('db').delete(teams).where(eq(teams.id, teamId));
  }
  return c.json({ message: '队伍已移除' });
});
