import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '../db';
import { notifications } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';

export const notificationRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
notificationRoutes.use('*', authMiddleware, requireAuth);

// 我的通知（未读在前）
notificationRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const rows = await c.get('db').select().from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.read), desc(notifications.createdAt))
    .limit(50);
  return c.json(rows);
});

// 未读数
notificationRoutes.get('/unread-count', async (c) => {
  const user = c.get('user')!;
  const rows = await c.get('db').select().from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  return c.json({ count: rows.length });
});

// 标记单条已读
notificationRoutes.post('/:id/read', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  await c.get('db').update(notifications).set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  return c.json({ message: '已标记已读' });
});

// 全部已读
notificationRoutes.post('/read-all', async (c) => {
  const user = c.get('user')!;
  await c.get('db').update(notifications).set({ read: true })
    .where(eq(notifications.userId, user.id));
  return c.json({ message: '已全部标记已读' });
});
