import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import { jwtDecrypt } from 'jose';
import { hkdf } from '@panva/hkdf';
import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { AppError } from './error';
import type { Db } from '../db';
import { users } from '../db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
/** 生产环境必须显式配置 JWT_SECRET（wrangler secret put JWT_SECRET / .env）。开发兜底仅本地可用。 */
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET 未配置：生产环境必须通过 wrangler secret put JWT_SECRET 设置');
}
const AUTHJS_SECRET = process.env.AUTH_SECRET || JWT_SECRET;
/** Auth.js cookie 名（作为 HKDF salt） */
const AUTHJS_COOKIE = 'authjs.session-token';
const AUTHJS_SECURE_COOKIE = '__Secure-authjs.session-token';

/** 用户信息类型（挂载到 context 变量上） */
export interface AuthUser {
  id: string;
  role: string;
}

/** 变量声明：通过 c.set('user', ...) 挂载 */
type Vars = { user: AuthUser | null; db: Db };

/** 复刻 Auth.js 的密钥派生（hkdf-sha256，salt = cookie 名，A256CBC-HS512 → 64 字节） */
async function deriveAuthJsKey(secret: string, salt: string): Promise<Uint8Array> {
  return await hkdf('sha256', secret, salt, `Auth.js Generated Encryption Key (${salt})`, 64);
}

/** 从 Auth.js JWE token 解密出 payload */
async function decodeAuthJsToken(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    for (const salt of [AUTHJS_COOKIE, AUTHJS_SECURE_COOKIE]) {
      try {
        const key = await deriveAuthJsKey(AUTHJS_SECRET, salt);
        const { payload } = await jwtDecrypt(token, key, {
          contentEncryptionAlgorithms: ['A256CBC-HS512', 'A256GCM'],
          keyManagementAlgorithms: ['dir'],
        });
        if (payload?.sub) {
          return { sub: String(payload.sub), role: String(payload.role ?? 'user') };
        }
      } catch {
        // 该 salt 不匹配则试下一个
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 解析认证 cookie 并挂载 user 到 context。
 * - 优先解析 Auth.js 的 authjs.session-token（JWE，共享 AUTH_SECRET）
 * - 兼容旧的自研 auth cookie（JWT，含 ver）
 * - 未登录或 token 无效时 user = null（不抛错，路由自行决定是否拦截）
 * - 校验 token 版本 + 封禁状态
 */
export const authMiddleware = async (c: Context<{ Variables: Vars }>, next: Next) => {
  // Auth.js cookie（本地 http 为 authjs.session-token；生产 https 前缀 __Secure-）
  const authJsToken = getCookie(c, 'authjs.session-token') ?? getCookie(c, '__Secure-authjs.session-token');
  if (authJsToken) {
    const payload = await decodeAuthJsToken(authJsToken);
    if (payload?.sub) {
      const [dbUser] = await c.get('db').select({ banned: users.banned }).from(users).where(eq(users.id, payload.sub)).limit(1);
      if (dbUser && !dbUser.banned) {
        c.set('user', { id: payload.sub, role: payload.role });
        await next();
        return;
      }
    }
    c.set('user', null);
    await next();
    return;
  }

  // 旧自研 cookie 兼容
  const token = getCookie(c, 'auth');
  if (!token) {
    c.set('user', null);
    await next();
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string; ver?: number };
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
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.CF_PAGES;
  setCookie(c, 'auth', token, {
    httpOnly: true,
    secure: isProd, // 生产（HTTPS）强制 secure；本地 HTTP 开发不设，否则 cookie 不生效
    sameSite: 'Lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  });
}

/** 清除认证 cookie */
export function clearAuthCookie(c: Context) {
  deleteCookie(c, 'auth', { path: '/' });
}
