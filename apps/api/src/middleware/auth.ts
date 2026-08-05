import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { AppError } from './error';
import type { Db } from '../db';
import { users } from '../db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/** 用户信息类型（挂载到 context 变量上） */
export interface AuthUser {
  id: string;
  role: string;
}

/** 变量声明：通过 c.set('user', ...) 挂载 */
type Vars = { user: AuthUser | null; db: Db };

/**
 * 解析 JWT cookie 并挂载 user 到 context。
 * - 未登录或 token 无效时 user = null（不抛错，路由自行决定是否拦截）
 * - token 内 ver 与 DB token_version 不一致 = 会话已失效（登出其他设备）
 */
export const authMiddleware = async (c: Context<{ Variables: Vars; db: Db }>, next: Next) => {
  const token = getCookie(c, 'auth');
  if (!token) {
    c.set('user', null);
    await next();
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string; ver?: number };
    // 校验 token 版本（登出其他设备后旧 token 失效）+ 封禁状态
    const [dbUser] = await c.get('db').select({ tokenVersion: users.tokenVersion, banned: users.banned }).from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!dbUser || dbUser.banned || (payload.ver ?? 1) !== dbUser.tokenVersion) {
      c.set('user', null);
      await next();
      return;
    }
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

/** 签发 JWT 并写入 httpOnly cookie（ver = token 版本，用于会话管理） */
export function issueAuthCookie(c: Context, userId: string, role: string, tokenVersion: number = 1) {
  const token = jwt.sign({ sub: userId, role, ver: tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
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
