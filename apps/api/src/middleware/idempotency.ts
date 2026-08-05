import type { Context, Next } from 'hono';
import { eq, and } from 'drizzle-orm';
import { idempotencyKeys } from '../db/schema';

/**
 * 幂等提交中间件：客户端在写操作请求头带 `Idempotency-Key`（UUID）。
 * - 同 key + 同用户 + 同路径在 10 分钟内重复请求 → 返回首次的响应（防重复创建）
 * - 无 key 的请求直接放行（兼容旧客户端）
 *
 * 用法：app.use('/some/write/path', idempotencyMiddleware)
 * 只应在 POST/PUT/PATCH/DELETE 上使用。
 */
export async function idempotencyMiddleware(c: Context, next: Next) {
  const key = c.req.header('Idempotency-Key');
  if (!key) return next();

  const db = c.get('db') as any;
  const user = c.get('user') as { id: string } | null;
  if (!user) return next(); // 未登录不幂等（授权层会处理）

  const path = c.req.path;

  // 查已存在的 key
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.userId, user.id), eq(idempotencyKeys.path, path)))
    .limit(1)
    .catch(() => [null]);

  if (existing) {
    // 命中：返回缓存响应
    return c.json(JSON.parse(existing.responseBody), existing.responseStatus);
  }

  // 未命中：先执行
  await next();

  // 记录响应（仅成功且可缓存时；跳过 4xx/5xx 的错误响应避免缓存错误）
  const status = c.res.status;
  if (status >= 200 && status < 400) {
    const body = await c.res.clone().text().catch(() => '');
    if (body) {
      await db
        .insert(idempotencyKeys)
        .values({ key, userId: user.id, path, responseStatus: status, responseBody: body })
        .catch(() => {});
    }
  }
}
