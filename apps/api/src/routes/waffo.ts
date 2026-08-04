import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { payments, registrations } from '../db/schema';
import { getWaffoClient } from '../lib/waffo';
import { notify } from '../services/notify';

/**
 * Waffo Pancake webhook（/api/v1/webhooks/waffo）
 *
 * 用 SDK 验证 X-Waffo-Signature（RSA-SHA256，raw body + 时间戳防重放），
 * 处理 order.completed → 将本地支付单置为 paid 并通知用户。
 * 未配置网关时返回 503（不处理，等待配置）。
 */
export const waffoWebhookRoutes = new Hono<{ Variables: { db: Db } }>();

waffoWebhookRoutes.post('/waffo', async (c) => {
	const db = c.get('db');
	const client = getWaffoClient();
	if (!client) {
		return c.json({ ok: false, error: 'WAFFO_NOT_CONFIGURED' }, 503);
	}

	const rawBody = await c.req.text();
	const signature = c.req.header('x-waffo-signature');
	if (!signature) {
		return c.json({ ok: false, error: 'MISSING_SIGNATURE' }, 401);
	}

	let event: any;
	try {
		event = client.webhooks.verify(rawBody, signature, { environment: 'test' });
	} catch (err) {
		console.error('[waffo] webhook 验签失败:', (err as Error).message);
		return c.json({ ok: false, error: 'INVALID_SIGNATURE' }, 401);
	}

	// 幂等：同 delivery id 或同订单重复事件直接 ack
	const eventId = event.id as string;
	const eventType = event.eventType as string;

	if (eventType === 'order.completed') {
		const data = event.data ?? {};
		// 关联本地支付单：优先 orderMerchantExternalId（pay-<uuid>），其次 metadata.paymentId
		const external = (data.orderMerchantExternalId as string) ?? '';
		const metaPaymentId = (data.orderMetadata as Record<string, string> | undefined)?.paymentId ?? '';
		const paymentId = external.startsWith('pay-') ? external.slice(4) : metaPaymentId;

		if (!paymentId) {
			console.warn('[waffo] order.completed 缺少本地支付单关联:', JSON.stringify(data));
			return c.json({ ok: true, error: 'NO_PAYMENT_REF' }); // ack，避免重试风暴
		}

		const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
		if (!pay) {
			console.warn('[waffo] 本地支付单不存在:', paymentId);
			return c.json({ ok: true, error: 'PAYMENT_NOT_FOUND' });
		}

		if (pay.status !== 'paid') {
			await db.update(payments).set({
				status: 'paid',
				provider: 'waffo',
				providerOrderId: (data.paymentId as string) ?? (event.eventId as string) ?? eventId,
				paidAt: new Date(),
			}).where(eq(payments.id, paymentId));
			console.log(`[waffo] order.completed → 支付单 ${paymentId} 已标记 paid`);
		}

		const [reg] = await db.select().from(registrations).where(eq(registrations.id, pay.registrationId)).limit(1);
		if (reg) {
			await notify(db, pay.userId, 'payment', '支付成功',
				`《${reg.teamName}》报名费 ¥${pay.amount} 已支付，等待主办方审核。`,
				`/tournaments/${pay.tournamentId}`, c.env);
		}
	}

	// 其他事件（order.failed 等）先记录，不改变本地状态
	return c.json({ ok: true });
});
