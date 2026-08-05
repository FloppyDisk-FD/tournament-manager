import { Hono } from 'hono';
import { eq, desc, ilike, or } from 'drizzle-orm';
import type { Db } from '../db';
import { users, registrations, tournaments, teams } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAdmin } from '../middleware/auth';

// 公开用户主页（/api/v1/users，无需登录）
export const userProfileRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();

userProfileRoutes.get('/:userId/profile', async (c) => {
  const { userId } = c.req.param();
  requireUuid(userId, '用户');
  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError('NOT_FOUND', '用户不存在', 404);

  // 参赛记录（含赛事信息）
  const regs = await db
    .select({
      id: registrations.id,
      tournamentId: registrations.tournamentId,
      teamId: registrations.teamId,
      teamName: registrations.teamName,
      logoEmoji: registrations.logoEmoji,
      logoUrl: registrations.logoUrl,
      status: registrations.status,
      createdAt: registrations.createdAt,
      tournamentName: tournaments.name,
      tournamentStatus: tournaments.status,
    })
    .from(registrations)
    .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
    .where(eq(registrations.userId, userId))
    .orderBy(desc(registrations.createdAt));

  // 主办/创建的赛事
  const hosted = await db
    .select({ id: tournaments.id, name: tournaments.name, status: tournaments.status, createdAt: tournaments.createdAt })
    .from(tournaments)
    .where(eq(tournaments.createdBy, userId))
    .orderBy(desc(tournaments.createdAt));

  return c.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    registrations: regs,
    hosted,
  });
});

// ===== 管理员：用户管理（仅系统管理员） =====
export const adminUserRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
adminUserRoutes.use('*', authMiddleware, requireAdmin);

// 用户列表（支持搜索 username/displayName，分页）
adminUserRoutes.get('/', async (c) => {
  const q = c.req.query('q')?.trim() ?? '';
  const page = Number(c.req.query('page')) || 1;
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const offset = (page - 1) * limit;
  const db = c.get('db');

  const conditions = q
    ? [or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`))]
    : undefined;
  const where = conditions?.length ? conditions[0] : undefined;

  const [items, countRows] = await Promise.all([
    db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      banned: users.banned,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: users.id }).from(users).where(where),
  ]);

  return c.json({
    items,
    total: countRows.length,
    page,
    limit,
  });
});

// 封禁 / 解封
adminUserRoutes.post('/:userId/ban', async (c) => {
  const { userId } = c.req.param();
  requireUuid(userId, '用户');
  const body = await c.req.json() as { banned?: boolean };
  const banned = !!body.banned;
  const [target] = await c.get('db').select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError('NOT_FOUND', '用户不存在', 404);
  if (target.role === 'admin') throw new AppError('FORBIDDEN', '不能封禁管理员账号', 403);
  await c.get('db').update(users).set({ banned }).where(eq(users.id, userId));
  return c.json({ message: banned ? '已封禁该用户' : '已解封该用户' });
});

// 调整角色
adminUserRoutes.post('/:userId/role', async (c) => {
  const { userId } = c.req.param();
  requireUuid(userId, '用户');
  const body = await c.req.json() as { role?: string };
  const role = body.role;
  if (!role || !['admin', 'tournament_manager', 'team_manager', 'user'].includes(role)) {
    throw new AppError('INVALID_INPUT', '无效的角色', 400);
  }
  const [target] = await c.get('db').select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError('NOT_FOUND', '用户不存在', 404);
  // 不允许把最后一个 admin 降级
  if (target.role === 'admin' && role !== 'admin') {
    const admins = await c.get('db').select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
    if (admins.length <= 1) throw new AppError('FORBIDDEN', '不能降级唯一的系统管理员', 403);
  }
  await c.get('db').update(users).set({ role: role as any }).where(eq(users.id, userId));
  return c.json({ message: '角色已更新' });
});

// ===== 个人数据导出（GDPR）：返回当前登录用户在本平台的完整数据 =====
userProfileRoutes.get('/me/export', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const db = c.get('db');

  const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!profile) throw new AppError('NOT_FOUND', '用户不存在', 404);

  const [regs, hosted, teamsOwned] = await Promise.all([
    db.select({
      id: registrations.id,
      tournamentId: registrations.tournamentId,
      teamId: registrations.teamId,
      teamName: registrations.teamName,
      status: registrations.status,
      answers: registrations.answers,
      note: registrations.note,
      createdAt: registrations.createdAt,
      reviewedAt: registrations.reviewedAt,
    }).from(registrations).where(eq(registrations.userId, user.id)),
    db.select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      format: tournaments.format,
      entryFee: tournaments.entryFee,
      createdAt: tournaments.createdAt,
    }).from(tournaments).where(eq(tournaments.createdBy, user.id)),
    db.select({
      id: teams.id,
      name: teams.name,
      logoUrl: teams.logoUrl,
      logoEmoji: teams.logoEmoji,
      status: teams.status,
    }).from(teams).where(eq(teams.ownerId, user.id)),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      role: profile.role,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
    },
    registrations: regs,
    hostedTournaments: hosted,
    teams: teamsOwned,
  };

  return c.json(data, 200, {
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`tournix-export-${profile.username}.json`)}`,
  });
});
