/**
 * 应用错误类 — 统一错误对象
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 校验路径参数是否为合法 UUID；非法时抛 404（避免传入非 UUID 字符串
 * 触发 PostgreSQL "invalid input syntax for type uuid" 而被全局 onError 返回 500）。
 */
export function requireUuid(value: string, label = '资源'): string {
  if (!value || !UUID_RE.test(value)) {
    throw new AppError('NOT_FOUND', `${label}不存在`, 404);
  }
  return value;
}
