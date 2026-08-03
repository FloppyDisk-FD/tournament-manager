import type { Db } from '../db';
import { notifications } from '../db/schema';
import { sendPushToUser } from './push';

/** 创建站内通知（报名状态变化等）；同时发送 Web Push 系统级提醒（未配置 VAPID 时静默跳过） */
export async function notify(
  db: Db,
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  env?: any,
) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    link: link ?? null,
  });

  // 系统级提醒（fire-and-forget，失败不影响主流程）
  await sendPushToUser(db, userId, { title, body: message, url: link }, env);
}
