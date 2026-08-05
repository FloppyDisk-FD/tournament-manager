import { auditLogs } from '../db/schema';
import type { Db } from '../db';

/** 写审计日志（不阻塞主流程：失败仅告警） */
export async function writeAudit(db: Db, params: {
  userId?: string | null;
  action: string;
  category: 'payment' | 'registration' | 'error' | 'auth';
  detail?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      action: params.action,
      category: params.category,
      detail: (params.detail ?? {}) as any,
      ip: params.ip ?? null,
    });
  } catch {
    // 审计失败不阻塞业务
  }
}
