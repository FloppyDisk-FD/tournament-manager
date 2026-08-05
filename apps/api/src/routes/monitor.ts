import { Hono } from 'hono';
import { desc, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { auditLogs } from '../db/schema';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../services/audit';

/** 监控与审计路由（/api/v1/monitor） */
export const monitorRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();

// 前端错误上报（登录可选）：记录浏览器未捕获错误
monitorRoutes.post('/errors', authMiddleware, async (c) => {
  const user = c.get('user') as { id?: string } | null;
  const body = await c.req.json().catch(() => ({})) as {
    message?: string;
    stack?: string;
    url?: string;
    action?: string;
  };
  await writeAudit(c.get('db'), {
    userId: user?.id ?? null,
    action: body.action ?? 'frontend_error',
    category: 'error',
    detail: {
      message: body.message ?? '',
      stack: (body.stack ?? '').slice(0, 2000),
      url: body.url ?? '',
    },
    ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });
  return c.json({ ok: true });
});

// 审计日志查询（仅系统管理员）
monitorRoutes.get('/audit', authMiddleware, requireAdmin, async (c) => {
  const query = c.req.query();
  const limit = Math.min(Number(query.limit) || 50, 200);
  const category = query.category as string | undefined;
  const db = c.get('db');
  const logs = category
    ? await db.select().from(auditLogs).where(sql`category = ${category}`).orderBy(desc(auditLogs.createdAt)).limit(limit)
    : await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  return c.json(logs);
});
