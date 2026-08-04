import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { payments, registrations } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { notify } from '../services/notify';
import { getWaffoClient, createWaffoCheckout } from '../lib/waffo';

/** 支付路由（/api/v1/payments） */
export const paymentRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();
paymentRoutes.use('*', authMiddleware, requireAuth);

// 查询订单（本人或系统管理员）
paymentRoutes.get('/:id', async (c) => {
  const id = requireUuid(c.req.param('id'), '订单');
  const user = c.get('user')!;
  const [pay] = await c.get('db').select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!pay) throw new AppError('NOT_FOUND', '订单不存在', 404);
  if (pay.userId !== user.id && user.role !== 'admin') throw new AppError('FORBIDDEN', '无权查看该订单', 403);
  return c.json(pay);
});

// 支付：已配置 Waffo 网关时创建 checkout session 并返回跳转链接；
// 未配置时保持 mock 支付（本地开发）。
paymentRoutes.post('/:id/pay', async (c) => {
  const id = requireUuid(c.req.param('id'), '订单');
  const user = c.get('user')!;
  const db = c.get('db');

  const [pay] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!pay) throw new AppError('NOT_FOUND', '订单不存在', 404);
  if (pay.userId !== user.id) throw new AppError('FORBIDDEN', '无权操作该订单', 403);
  if (pay.status !== 'pending') throw new AppError('PAYMENT_STATUS', `订单状态为 ${pay.status}，无法支付`, 400);

  const [reg] = await db.select().from(registrations).where(eq(registrations.id, pay.registrationId)).limit(1);
  if (!reg) throw new AppError('NOT_FOUND', '报名不存在', 404);
  if (reg.status !== 'pending') throw new AppError('REGISTRATION_CLOSED', '报名已处理，订单失效', 400);

  // ── Waffo 网关：创建 checkout session，前端 window.open 新标签跳转 ──
  const waffo = getWaffoClient();
  if (waffo) {
    const session = await createWaffoCheckout(waffo, {
      paymentId: pay.id,
      tournamentId: pay.tournamentId,
      amount: Number(pay.amount),
      successUrl: `${c.req.header('origin') ?? ''}/tournaments/${pay.tournamentId}`,
    });
    return c.json({
      status: 'pending',
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
      provider: 'waffo',
    });
  }

  const [updated] = await db.update(payments).set({
    status: 'paid',
    providerOrderId: `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    paidAt: new Date(),
  }).where(eq(payments.id, id)).returning();

  await notify(db, user.id, 'payment', '支付成功',
    `《${reg.teamName}》报名费 ¥${pay.amount} 已支付，等待主办方审核。`, `/tournaments/${pay.tournamentId}`, c.env);

  return c.json(updated);
});

// 取消订单（仅未支付）
paymentRoutes.post('/:id/cancel', async (c) => {
  const id = requireUuid(c.req.param('id'), '订单');
  const user = c.get('user')!;
  const [pay] = await c.get('db').select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!pay) throw new AppError('NOT_FOUND', '订单不存在', 404);
  if (pay.userId !== user.id) throw new AppError('FORBIDDEN', '无权操作该订单', 403);
  if (pay.status !== 'pending') throw new AppError('PAYMENT_STATUS', `订单状态为 ${pay.status}，无法取消`, 400);
  const [updated] = await c.get('db').update(payments).set({ status: 'failed' }).where(eq(payments.id, id)).returning();
  return c.json(updated);
});
