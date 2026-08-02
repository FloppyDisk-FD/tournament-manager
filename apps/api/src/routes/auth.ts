import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { Db } from '../db';
import { users } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, issueAuthCookie, clearAuthCookie } from '../middleware/auth';

const auth = new Hono<{ Variables: { user: any | null; db: Db } }>();

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(['tournament_manager', 'team_manager', 'user']).optional().default('user'),
});

auth.use('*', authMiddleware);

auth.post('/register', zValidator('json', credentialsSchema), async (c) => {
  const { username, password, role } = c.req.valid('json');

  const existing = await c.get('db').select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    throw new AppError('USERNAME_TAKEN', '用户名已被占用');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await c.get('db').insert(users).values({ username, passwordHash, role: role }).returning();

  issueAuthCookie(c, newUser.id, newUser.role);
  c.status(201);
  return c.json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

auth.post('/login', zValidator('json', credentialsSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const [user] = await c.get('db').select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
  }

  issueAuthCookie(c, user.id, user.role);
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

export { auth as authRoutes };
