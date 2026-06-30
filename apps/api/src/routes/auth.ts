import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, issueAuthCookie, clearAuthCookie } from '../middleware/auth';

const auth = new Hono<{ Variables: { user: any | null } }>();

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

auth.use('*', authMiddleware);

auth.post('/register', zValidator('json', credentialsSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    throw new AppError('USERNAME_TAKEN', '用户名已被占用');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(users).values({ username, passwordHash }).returning();

  issueAuthCookie(c, newUser.id, newUser.role);
  c.status(201);
  return c.json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

auth.post('/login', zValidator('json', credentialsSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
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
  const [dbUser] = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!dbUser) {
    c.status(401);
    return c.json({ error: '用户不存在' });
  }
  return c.json(dbUser);
});

export { auth as authRoutes };
