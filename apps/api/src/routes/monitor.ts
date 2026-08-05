import { Hono } from 'hono';
import { desc, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { auditLogs } from '../db/schema';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../services/audit';
import { AppError } from '../middleware/error';

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

// 用户反馈（登录可选）：记录到审计库，供管理员查看
monitorRoutes.post('/feedback', authMiddleware, async (c) => {
  const user = c.get('user') as { id?: string; username?: string } | null;
  const body = await c.req.json().catch(() => ({})) as {
    content?: string;
    url?: string;
    category?: string;
  };
  const content = (body.content ?? '').trim().slice(0, 2000);
  if (!content) throw new AppError('INVALID_INPUT', '请填写反馈内容', 400);
  await writeAudit(c.get('db'), {
    userId: user?.id ?? null,
    action: 'user_feedback',
    category: 'error',
    detail: {
      content,
      url: body.url ?? '',
      category: body.category ?? 'general',
      username: user?.username ?? 'anonymous',
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
