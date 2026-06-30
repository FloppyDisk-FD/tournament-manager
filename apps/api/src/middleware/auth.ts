import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { AppError } from './error';

export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      exp: '7d',
    }),
  )
  .derive({ as: 'scoped' }, async ({ jwt, cookie: { auth } }) => {
    const token = auth?.value;
    if (!token) {
      return { user: null as { id: string; role: string } | null };
    }
    const payload = await jwt.verify(token as string);
    if (!payload) {
      return { user: null as { id: string; role: string } | null };
    }
    return { user: { id: payload.sub as string, role: payload.role as string } };
  });

export const requireAuth = new Elysia({ name: 'requireAuth' })
  .use(authPlugin)
  .resolve({ as: 'scoped' }, async ({ user }) => {
    if (!user) {
      throw new AppError('UNAUTHORIZED', '请先登录', 401);
    }
    return { user };
  });

export const requireAdmin = new Elysia({ name: 'requireAdmin' })
  .use(requireAuth)
  .resolve({ as: 'scoped' }, async ({ user }) => {
    if (!user) {
      throw new AppError('UNAUTHORIZED', '请先登录', 401);
    }
    if (user.role !== 'admin') {
      throw new AppError('FORBIDDEN', '需要管理员权限', 403);
    }
    return { user };
  });
