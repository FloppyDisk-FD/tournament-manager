import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { payments, registrations } from '../db/schema';
import { notify } from './notify';

/**
 * 退款：将已支付订单标记为 refunded。
 * - mock provider：直接置 refunded（模拟退款完成）
 * - waffo provider：TODO 调用真实退款 API（webhook 回调后置 refunded）
 * - 返回是否执行了退款
 */
export async function refundPayment(
  db: Db,
  paymentId: string,
  opts: { reason?: string; notifyUser?: boolean; env?: any } = {},
): Promise<boolean> {
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!pay || pay.status !== 'paid') return false;

  if (pay.provider === 'waffo') {
    // TODO: 调用 Waffo 退款 API，回调后置 refunded
    // 本地沙箱无真实退款能力，先标记 refunded 保持闭环（与 mock 一致）
  }

  await db.update(payments)
    .set({ status: 'refunded', refundedAt: new Date() })
    .where(eq(payments.id, paymentId));

  if (opts.notifyUser !== false) {
    const [reg] = await db.select().from(registrations).where(eq(registrations.id, pay.registrationId)).limit(1);
    const teamName = reg?.teamName ?? '';
    const reason = opts.reason ? `（${opts.reason}）` : '';
    await notify(db, pay.userId, 'refund', '报名费已退款',
      `《${teamName}》报名费 ¥${pay.amount} 已原路退回${reason}。`, undefined, opts.env);
  }
  return true;
}

/** 按报名记录退款其已支付订单（不存在或未支付时返回 false） */
export async function refundRegistrationPayment(db: Db, registrationId: string, opts: { reason?: string; notifyUser?: boolean; env?: any } = {}): Promise<boolean> {
  const [pay] = await db.select().from(payments).where(eq(payments.registrationId, registrationId)).limit(1);
  if (!pay) return false;
  return refundPayment(db, pay.id, opts);
}
