import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import type { Context, Next } from 'hono';
import { AppError } from './error';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/** 用户信息类型（挂载到 context 变量上） */
export interface AuthUser {
  id: string;
  role: string;
}

/** 变量声明：通过 c.set('user', ...) 挂载 */
type Vars = { user: AuthUser | null };

/**
 * 解析 JWT cookie 并挂载 user 到 context。
 * - 未登录或 token 无效时 user = null（不抛错，路由自行决定是否拦截）
 */
export const authMiddleware = async (c: Context<{ Variables: Vars }>, next: Next) => {
  const token = getCookie(c, 'auth');
  if (!token) {
    c.set('user', null);
    await next();
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    c.set('user', { id: payload.sub, role: payload.role });
  } catch {
    c.set('user', null);
  }
  await next();
};

/** 需要登录 */
export const requireAuth = async (c: Context<{ Variables: Vars }>, next: Next) => {
  const user = c.get('user');
  if (!user) {
    throw new AppError('UNAUTHORIZED', '请先登录', 401);
  }
  await next();
};

/** 需要管理员权限 */
export const requireAdmin = async (c: Context<{ Variables: Vars }>, next: Next) => {
  const user = c.get('user');
  if (!user) {
    throw new AppError('UNAUTHORIZED', '请先登录', 401);
  }
  if (user.role !== 'admin') {
    throw new AppError('FORBIDDEN', '需要管理员权限', 403);
  }
  await next();
};

/** 签发 JWT 并写入 httpOnly cookie */
export function issueAuthCookie(c: Context, userId: string, role: string) {
  const token = jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '7d' });
  setCookie(c, 'auth', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  });
}

/** 清除认证 cookie */
export function clearAuthCookie(c: Context) {
  deleteCookie(c, 'auth', { path: '/' });
}
