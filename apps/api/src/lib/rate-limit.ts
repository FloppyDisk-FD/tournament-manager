/**
 * 简易内存限流（进程内）。
 * 用于登录/注册防暴力破解与防滥用。
 * 注意：多实例部署时按实例独立计数（够用；生产可换 KV/DB 实现）。
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** 清理过期桶（防内存泄漏） */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();

export interface RateLimitOptions {
  /** 窗口内最大次数 */
  max: number;
  /** 窗口时长（毫秒） */
  windowMs: number;
}

/** 返回 null 表示放行；返回数字表示剩余等待秒数（被限流） */
export function rateLimit(key: string, opts: RateLimitOptions): number | null {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }
  cur.count += 1;
  if (cur.count > opts.max) {
    return Math.ceil((cur.resetAt - now) / 1000);
  }
  return null;
}

/** 获取客户端标识：IP 优先，回退 UA（无 IP 的本地/内网场景） */
export function clientKey(c: any): string {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) return ip;
  const ua = c.req.header('user-agent') ?? '';
  return `ua:${ua.slice(0, 64)}`;
}
