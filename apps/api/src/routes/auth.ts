import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Db } from '../db';
import { users, sessions, teams, teamPlayers, tournamentTeams, stages, registrations, payments, tournaments } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, issueAuthCookie, clearAuthCookie } from '../middleware/auth';
import { refundRegistrationPayment } from '../services/refund';

const auth = new Hono<{ Variables: { user: any | null; db: Db } }>();

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(['tournament_manager', 'team_manager', 'user']).optional().default('user'),
});

/** 从 User-Agent 提取简短的设备名 */
function deviceNameFromUA(ua: string | null | undefined): string {
  if (!ua) return '未知设备';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux';
  return '未知设备';
}

async function recordSession(c: any, userId: string) {
  const ua = c.req.header('user-agent') ?? null;
  try {
    await c.get('db').insert(sessions).values({
      userId,
      deviceName: deviceNameFromUA(ua),
      userAgent: ua,
      ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch { /* 会话记录失败不阻塞登录 */ }
}

auth.use('*', authMiddleware);

auth.post('/register', zValidator('json', credentialsSchema), async (c) => {
  const { username, password, role } = c.req.valid('json');

  const existing = await c.get('db').select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    throw new AppError('USERNAME_TAKEN', '用户名已被占用');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await c.get('db').insert(users).values({ username, passwordHash, role: role }).returning();

  issueAuthCookie(c, newUser.id, newUser.role, newUser.tokenVersion ?? 1);
  await recordSession(c, newUser.id);
  c.status(201);
  return c.json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

auth.post('/login', zValidator('json', credentialsSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const [user] = await c.get('db').select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
  }
  if (user.banned) {
    throw new AppError('BANNED', '账号已被封禁，请联系管理员', 403);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
  }

  issueAuthCookie(c, user.id, user.role, user.tokenVersion ?? 1);
  await recordSession(c, user.id);
  return c.json({ id: user.id, username: user.username, role: user.role });
});

auth.post('/logout', (c) => {
  clearAuthCookie(c);
  return c.json({ message: '已登出' });
});

auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    c.status(401);
    return c.json({ error: '未登录' });
  }
  const [dbUser] = await c.get('db').select({
    id: users.id,
    username: users.username,
    role: users.role,
    avatarUrl: users.avatarUrl,
    displayName: users.displayName,
    bio: users.bio,
  }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!dbUser) {
    c.status(401);
    return c.json({ error: '用户不存在' });
  }
  return c.json(dbUser);
});

// 更新个人资料（登录用户）
auth.put('/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    c.status(401);
    return c.json({ error: '未登录' });
  }
  const body = await c.req.json() as {
    avatar_url?: string;
    display_name?: string;
    bio?: string;
  };
  await c.get('db').update(users).set({
    avatarUrl: body.avatar_url ?? null,
    displayName: body.display_name ?? null,
    bio: body.bio ?? null,
  }).where(eq(users.id, user.id));
  return c.json({ message: '个人资料已更新' });
});

// ===== 会话管理 =====

// 会话列表（登录设备）
auth.get('/sessions', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const list = await c.get('db').select().from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastActiveAt))
    .limit(50);
  return c.json(list.map((s) => ({
    id: s.id,
    deviceName: s.deviceName,
    ip: s.ip,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
  })));
});

// 登出指定设备（删除会话记录）
auth.delete('/sessions/:id', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const sessionId = c.req.param('id');
  await c.get('db').delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  return c.json({ message: '已登出该设备' });
});

// 登出所有其他设备（token_version +1，旧 token 全部失效；保留当前会话记录）
auth.post('/sessions/revoke-others', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const [dbUser] = await c.get('db').select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!dbUser) throw new AppError('NOT_FOUND', '用户不存在', 404);
  const nextVersion = (dbUser.tokenVersion ?? 1) + 1;
  await c.get('db').update(users).set({ tokenVersion: nextVersion }).where(eq(users.id, user.id));
  // 清空会话记录（当前 cookie 因 tokenVersion 已更新而继续有效）
  await c.get('db').delete(sessions).where(eq(sessions.userId, user.id));
  // 重新签发当前 cookie（带新版本）
  issueAuthCookie(c, user.id, user.role, nextVersion);
  return c.json({ message: '其他设备已全部登出' });
});

// ===== 修改密码 =====

auth.post('/change-password', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const body = await c.req.json() as { old_password?: string; new_password?: string };
  if (!body.old_password || !body.new_password) {
    throw new AppError('INVALID_INPUT', '请填写当前密码和新密码', 400);
  }
  if (body.new_password.length < 6) {
    throw new AppError('INVALID_INPUT', '新密码至少 6 位', 400);
  }
  const [dbUser] = await c.get('db').select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!dbUser) throw new AppError('NOT_FOUND', '用户不存在', 404);
  const valid = await bcrypt.compare(body.old_password, dbUser.passwordHash);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', '当前密码错误', 400);
  const passwordHash = await bcrypt.hash(body.new_password, 10);
  await c.get('db').update(users).set({ passwordHash }).where(eq(users.id, user.id));
  return c.json({ message: '密码已更新' });
});

// ===== 通知偏好 =====

// 获取通知偏好
auth.get('/preferences', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const [dbUser] = await c.get('db').select({ preferences: users.preferences }).from(users).where(eq(users.id, user.id)).limit(1);
  return c.json(dbUser?.preferences ?? {});
});

// 更新通知偏好
auth.put('/preferences', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const body = await c.req.json() as Record<string, unknown>;
  await c.get('db').update(users).set({ preferences: body }).where(eq(users.id, user.id));
  return c.json({ message: '偏好已保存' });
});

// ===== 注销账号 =====

auth.delete('/account', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录', 401);
  const db = c.get('db');

  // H1：清理所有引用该用户的外键记录（no action 的 5 张表），避免删除 500
  const uid = user.id;

  // 1. 用户拥有的全局队伍（含选手、赛事关联）
  const ownedTeams = await db.select().from(teams).where(eq(teams.ownerId, uid));
  for (const t of ownedTeams) {
    await db.delete(teamPlayers).where(eq(teamPlayers.teamId, t.id));
    await db.delete(tournamentTeams).where(eq(tournamentTeams.teamId, t.id));
    await db.delete(teams).where(eq(teams.id, t.id));
  }

  // 2. 用户创建的赛事（含其报名/支付/赛程/比赛）
  const hosted = await db.select().from(tournaments).where(eq(tournaments.createdBy, uid));
  for (const t of hosted) {
    const regs = await db.select().from(registrations).where(eq(registrations.tournamentId, t.id));
    for (const r of regs) {
      await refundRegistrationPayment(db, r.id, { notifyUser: false });
      await db.delete(registrations).where(eq(registrations.id, r.id));
    }
    await db.delete(payments).where(eq(payments.tournamentId, t.id));
    await db.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
    await db.delete(stages).where(eq(stages.tournamentId, t.id));
    await db.delete(tournaments).where(eq(tournaments.id, t.id));
  }

  // 3. 用户报名的记录（含支付退款）
  const myRegs = await db.select().from(registrations).where(eq(registrations.userId, uid));
  for (const r of myRegs) {
    await refundRegistrationPayment(db, r.id, { notifyUser: false });
    await db.delete(registrations).where(eq(registrations.id, r.id));
  }

  // 4. 孤儿支付单（理论上已被 2/3 覆盖，防御性清理）
  await db.delete(payments).where(eq(payments.userId, uid));

  // 5. 删除用户（notifications/predictions/sessions 为 cascade，自动清理）
  await db.delete(users).where(eq(users.id, uid));
  clearAuthCookie(c);
  return c.json({ message: '账号已注销' });
});

export { auth as authRoutes };
