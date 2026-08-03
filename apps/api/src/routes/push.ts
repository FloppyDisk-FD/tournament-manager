import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { AppError } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { getVapidConfig, saveSubscription } from '../services/push';

export const pushRoutes = new Hono<{ Variables: { user: any | null; db: Db }; Bindings: any }>();

// VAPID 公钥（前端订阅用，无需登录）
pushRoutes.get('/vapid-public-key', (c) => {
	const vapid = getVapidConfig(c.env);
	if (!vapid) throw new AppError('INTERNAL', 'Web Push 未配置（缺少 VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY）', 500);
	return c.json({ publicKey: vapid.publicKey });
});

pushRoutes.use('*', authMiddleware, requireAuth);

// 保存订阅（幂等：同用户同 endpoint 更新密钥）
pushRoutes.post('/subscriptions', async (c) => {
	const user = c.get('user')!;
	const body = await c.req.json().catch(() => null);
	if (
		!body ||
		typeof body.endpoint !== 'string' ||
		typeof body.p256dh !== 'string' ||
		typeof body.auth !== 'string'
	) {
		throw new AppError('BAD_REQUEST', '订阅参数不完整（endpoint/p256dh/auth）', 400);
	}
	await saveSubscription(c.get('db'), user.id, {
		endpoint: body.endpoint,
		p256dh: body.p256dh,
		auth: body.auth,
	});
	return c.json({ message: '已保存' });
});

// 移除订阅
pushRoutes.delete('/subscriptions', async (c) => {
	const user = c.get('user')!;
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body.endpoint !== 'string') {
		throw new AppError('BAD_REQUEST', '缺少 endpoint', 400);
	}
	await c
		.get('db')
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, body.endpoint)));
	return c.json({ message: '已移除' });
});
