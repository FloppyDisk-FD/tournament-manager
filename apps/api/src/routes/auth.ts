import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { AppError } from '../middleware/error';
import { authPlugin } from '../middleware/auth';

export const authRoutes = new Elysia({ prefix: '/api/v1/auth' })
  .use(authPlugin)
  .post('/register', async ({ body, jwt, cookie: { auth }, set }) => {
    const { username, password } = body;

    if (!username || !password) {
      throw new AppError('VALIDATION_ERROR', '用户名和密码不能为空');
    }

    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      throw new AppError('USERNAME_TAKEN', '用户名已被占用');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({ username, passwordHash }).returning();

    const token = await jwt.sign({ sub: newUser.id, role: newUser.role });
    auth!.set({
      value: token,
      httpOnly: true,
      maxAge: 7 * 24 * 3600,
      path: '/',
      sameSite: 'Lax',
    });

    set.status = 201;
    return { id: newUser.id, username: newUser.username, role: newUser.role };
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
    }),
  })
  .post('/login', async ({ body, jwt, cookie: { auth }, set }) => {
    const { username, password } = body;

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
    }

    const token = await jwt.sign({ sub: user.id, role: user.role });
    auth!.set({
      value: token,
      httpOnly: true,
      maxAge: 7 * 24 * 3600,
      path: '/',
      sameSite: 'Lax',
    });

    return { id: user.id, username: user.username, role: user.role };
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
    }),
  })
  .post('/logout', async ({ cookie: { auth } }) => {
    auth!.remove();
    return { message: '已登出' };
  })
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: '未登录' };
    }
    const [dbUser] = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!dbUser) {
      set.status = 401;
      return { error: '用户不存在' };
    }
    return dbUser;
  });
