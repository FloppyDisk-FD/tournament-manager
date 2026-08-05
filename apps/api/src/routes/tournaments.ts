import { Hono } from 'hono';
import { eq, ilike, and, sql, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { tournaments, stages, matches, games, standings, tournamentTeams, registrations, payments, teams, teamPlayers } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { canCreateTournament, canManageTournament } from '../services/perm';
import { refundRegistrationPayment } from '../services/refund';
import { validateCustomFields } from '../types/custom-field';

export const tournamentRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();

// 全局中间件：解析 cookie 挂载 user
tournamentRoutes.use('*', authMiddleware);

// ========== 公开路由 ==========
tournamentRoutes.get('/', async (c) => {
  const query = c.req.query();
  const user = c.get('user');
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query.status) conditions.push(eq(tournaments.status, query.status as any));
  if (query.game) conditions.push(ilike(tournaments.game, `%${query.game}%`));
  if (query.q) conditions.push(ilike(tournaments.name, `%${query.q}%`));
  if (query.format) conditions.push(eq(tournaments.format, query.format as any));
  if (query.fee === 'free') conditions.push(eq(tournaments.entryFee, 0));
  if (query.fee === 'paid') conditions.push(sql`${tournaments.entryFee} > 0`);
  // 我的赛事：赛事管理者只看自己创建的（admin 看全部）
  if (query.mine === '1' && user && user.role !== 'admin') {
    conditions.push(eq(tournaments.createdBy, user.id));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    c.get('db').select().from(tournaments).where(where).limit(limit).offset(offset).orderBy(sql`${tournaments.createdAt} DESC`),
    c.get('db').select({ count: sql<number>`count(*)` }).from(tournaments).where(where),
  ]);

  return c.json({
    items,
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

tournamentRoutes.get('/:id', async (c) => {
  const id = requireUuid(c.req.param('id'), '赛事');
  const [tournament] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!tournament) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  return c.json(tournament);
});

// ========== 管理员路由 ==========
tournamentRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  if (!canCreateTournament(user)) {
    throw new AppError('FORBIDDEN', '需要赛事管理者或系统管理员权限', 403);
  }
  const data = await c.req.json();
  const [tournament] = await c.get('db').insert(tournaments).values({
    name: data.name,
    description: data.description || '',
    rules: data.rules || '',
    game: data.game,
    format: data.format,
    teamSize: data.team_size || 5,
    maxTeams: data.max_teams || 16,
    boCount: data.bo_count || 3,
    hasGroupStage: data.has_group_stage || false,
    groupCount: data.group_count,
    advancePerGroup: data.advance_per_group,
    thirdPlace: data.third_place || false,
    swissRounds: data.swiss_rounds,
    formatConfig: data.format_config,
    coverImage: data.cover_image || data.coverImage,
    liveUrl: data.live_url,
    bannerUrl: data.banner_url,
    sponsors: data.sponsors ?? [],
    entryFee: data.entry_fee ?? 0,
    customFields: validateCustomFields(data.custom_fields ?? data.customFields ?? []),
    createdBy: user.id,
  }).returning();

  c.status(201);
  return c.json(tournament);
});

tournamentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法修改');
  }

  const data = await c.req.json();
  const [updated] = await c.get('db').update(tournaments).set({
    name: data.name,
    description: data.description,
    rules: data.rules,
    game: data.game,
    format: data.format,
    teamSize: data.team_size,
    maxTeams: data.max_teams,
    boCount: data.bo_count,
    hasGroupStage: data.has_group_stage,
    groupCount: data.group_count,
    advancePerGroup: data.advance_per_group,
    thirdPlace: data.third_place,
    swissRounds: data.swiss_rounds,
    formatConfig: data.format_config,
    coverImage: data.cover_image,
    liveUrl: data.live_url,
    bannerUrl: data.banner_url,
    sponsors: data.sponsors ?? [],
    entryFee: data.entry_fee,
    startDate: data.start_date,
    endDate: data.end_date,
  }).where(eq(tournaments.id, id)).returning();

  return c.json(updated);
});

// 赛事状态流转（显式端点，带状态机校验 + cancelled 联动）
tournamentRoutes.post('/:id/status', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db');
  const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);

  const body = await c.req.json() as { status?: string };
  const next = body.status;
  const cur = existing.status;
  // 状态机：draft → ongoing → completed；draft → cancelled；ongoing → cancelled
  const allowed: Record<string, string[]> = {
    draft: ['ongoing', 'cancelled'],
    ongoing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  if (!next || !(allowed[cur] ?? []).includes(next)) {
    throw new AppError('INVALID_STATUS', `无法从「${cur}」切换到「${next ?? ''}」`, 400);
  }

  // cancelled 联动：pending 报名拒绝、已支付退款、清除签到
  if (next === 'cancelled') {
    const regs = await db.select().from(registrations).where(eq(registrations.tournamentId, id));
    for (const r of regs) {
      if (r.status === 'pending') {
        await db.update(registrations).set({ status: 'rejected', note: '赛事已取消', reviewedAt: new Date() }).where(eq(registrations.id, r.id));
      }
      await refundRegistrationPayment(db, r.id, { reason: '赛事已取消', env: c.env });
    }
    await db.update(tournamentTeams).set({ checkedIn: false }).where(eq(tournamentTeams.tournamentId, id));
  }

  const [updated] = await db.update(tournaments).set({ status: next as any }).where(eq(tournaments.id, id)).returning();
  return c.json(updated);
});

tournamentRoutes.put('/:id/live', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  const data = await c.req.json();
  const [updated] = await c.get('db').update(tournaments)
    .set({ liveUrl: data.live_url ?? null })
    .where(eq(tournaments.id, id))
    .returning();
  return c.json(updated);
});

// 赞助商与 Banner 设置（任何状态可改，跟随 live 模式）
tournamentRoutes.put('/:id/sponsors', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  const data = await c.req.json();
  const sponsors = Array.isArray(data.sponsors)
    ? data.sponsors
        .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
        .map((s: any) => ({
          name: String(s.name).trim().slice(0, 100),
          logoUrl: typeof s.logoUrl === 'string' ? s.logoUrl.slice(0, 500) : '',
          url: typeof s.url === 'string' ? s.url.slice(0, 500) : '',
        }))
    : [];
  const [updated] = await c.get('db').update(tournaments)
    .set({ bannerUrl: typeof data.banner_url === 'string' ? data.banner_url : null, sponsors })
    .where(eq(tournaments.id, id))
    .returning();
  return c.json(updated);
});

// 报名费设置（仅 draft 期可改，报名开始后锁定）
tournamentRoutes.put('/:id/fee', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  if (existing.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，报名费不可修改', 400);
  const data = await c.req.json();
  const fee = Number(data.entry_fee ?? 0);
  if (!Number.isFinite(fee) || fee < 0) throw new AppError('INVALID_INPUT', '报名费无效', 400);
  const [updated] = await c.get('db').update(tournaments)
    .set({ entryFee: Math.round(fee) })
    .where(eq(tournaments.id, id)).returning();
  return c.json(updated);
});

// 报名表单自定义字段（仅 draft 期可改，报名开始后锁定）
tournamentRoutes.put('/:id/custom-fields', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  if (existing.status !== 'draft') throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，报名表单不可修改', 400);
  const data = await c.req.json();
  const fields = validateCustomFields(data.fields);
  const [updated] = await c.get('db').update(tournaments)
    .set({ customFields: fields })
    .where(eq(tournaments.id, id)).returning();
  return c.json(updated);
});

// 赛事规则（Markdown，任何状态可改）
tournamentRoutes.put('/:id/rules', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) throw new AppError('NOT_FOUND', '赛事不存在', 404);
  if (!canManageTournament(c.get('user'), existing)) throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  const data = await c.req.json();
  const rules = typeof data.rules === 'string' ? data.rules : '';
  if (rules.length > 20000) throw new AppError('INVALID_INPUT', '规则内容过长（最多 20000 字）', 400);
  const [updated] = await c.get('db').update(tournaments)
    .set({ rules })
    .where(eq(tournaments.id, id)).returning();
  return c.json(updated);
});

tournamentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await c.get('db').select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) {
    throw new AppError('NOT_FOUND', '赛事不存在', 404);
  }
  if (!canManageTournament(c.get('user'), existing)) {
    throw new AppError('FORBIDDEN', '无权管理该赛事', 403);
  }
  if (existing.status !== 'draft') {
    throw new AppError('TOURNAMENT_ALREADY_STARTED', '赛事已开始，无法删除');
  }
  // 级联删除所有关联数据
  const stageRows = await c.get('db').select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, id));
  if (stageRows.length > 0) {
    const stageIds = stageRows.map((s) => s.id);
    const matchRows = await c.get('db').select({ id: matches.id }).from(matches).where(inArray(matches.stageId, stageIds));
    if (matchRows.length > 0) {
      const matchIds = matchRows.map((m) => m.id);
      await c.get('db').update(matches).set({ nextMatchId: null, nextLosersMatchId: null }).where(inArray(matches.id, matchIds));
      await c.get('db').delete(games).where(inArray(games.matchId, matchIds));
    }
    await c.get('db').delete(standings).where(inArray(standings.stageId, stageIds));
    await c.get('db').delete(matches).where(inArray(matches.stageId, stageIds));
    await c.get('db').delete(stages).where(inArray(stages.id, stageIds));
  }
  await c.get('db').delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, id));
  // H3：清理报名（含支付级联）与赛事内创建的队伍（no action 外键，避免 500）
  const regRows = await c.get('db').select().from(registrations).where(eq(registrations.tournamentId, id));
  for (const r of regRows) {
    await refundRegistrationPayment(c.get('db'), r.id, { notifyUser: false });
  }
  await c.get('db').delete(registrations).where(eq(registrations.tournamentId, id));
  await c.get('db').delete(payments).where(eq(payments.tournamentId, id));
  const innerTeams = await c.get('db').select().from(teams).where(eq(teams.tournamentId, id));
  for (const t of innerTeams) {
    await c.get('db').delete(teamPlayers).where(eq(teamPlayers.teamId, t.id));
    await c.get('db').delete(teams).where(eq(teams.id, t.id));
  }
  await c.get('db').delete(tournaments).where(eq(tournaments.id, id));
  return c.json({ message: '赛事已删除' });
});
