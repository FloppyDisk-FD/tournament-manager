import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { encryptPayload, sendPush, type VapidConfig } from './webpush';

/** 读取 VAPID 配置：优先请求级 env（Workers Bindings），回退 process.env（本地 Bun，读取 .env） */
export function getVapidConfig(
	env?: any,
): VapidConfig | null {
	const publicKey = env?.VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
	const privateKey = env?.VAPID_PRIVATE_KEY ?? process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return null;
	return {
		publicKey,
		privateKey,
		subject:
			env?.VAPID_SUBJECT ??
			process.env.VAPID_SUBJECT ??
			'mailto:admin@tournament-manager.local',
	};
}

export interface PushPayload {
	title: string;
	body: string;
	url?: string;
}

/**
 * 向用户的所有订阅发送系统级提醒。
 * 订阅失效（410/404）自动删除；未配置 VAPID 或单条失败均静默（不影响主流程）。
 */
export async function sendPushToUser(
	db: Db,
	userId: string,
	payload: PushPayload,
	env?: any,
): Promise<void> {
	const vapid = getVapidConfig(env);
	if (!vapid) return;

	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId));

	await Promise.all(
		subs.map(async (sub) => {
			try {
				const { ciphertext } = await encryptPayload(JSON.stringify(payload), {
					p256dh: sub.p256dh,
					auth: sub.auth,
				});
				const result = await sendPush(sub.endpoint, ciphertext, vapid);
				if (result === 'gone') {
					await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
				}
			} catch {
				// 单条订阅失败不影响其他订阅/主流程
			}
		}),
	);
}

/** 保存订阅（同一用户同一 endpoint 幂等更新） */
export async function saveSubscription(
	db: Db,
	userId: string,
	sub: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
	const existing = await db
		.select()
		.from(pushSubscriptions)
		.where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, sub.endpoint)));
	if (existing.length === 0) {
		await db.insert(pushSubscriptions).values({
			userId,
			endpoint: sub.endpoint,
			p256dh: sub.p256dh,
			auth: sub.auth,
		});
	} else {
		await db
			.update(pushSubscriptions)
			.set({ p256dh: sub.p256dh, auth: sub.auth })
			.where(eq(pushSubscriptions.id, existing[0].id));
	}
}
