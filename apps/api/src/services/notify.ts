import type { Db } from '../db';
import { notifications } from '../db/schema';

/** 创建站内通知（报名状态变化等） */
export async function notify(
  db: Db,
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    link: link ?? null,
  });
}
