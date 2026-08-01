import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * 数据库实例
 *
 * - Cloudflare Workers：每个请求通过 createDb() 创建新实例并存入 Hono Context
 *   （c.set('db', ...)），因为 Workers 的 I/O 对象（socket）不能跨请求复用，
 *   复用会导致间歇性 500（交替出现 200/500）。
 * - 本地开发（Bun/Node）：模块加载时用 DATABASE_URL 初始化单例 db，连接池常驻。
 */
export type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * 创建新的 DB client 实例（每请求调用）。
 *
 * Workers：通过 Hyperdrive 连接串，按官方推荐配置
 *   - max: 5（Workers 并发外部连接限制）
 *   - fetch_types: false（避免额外 round-trip，我们不用 postgres 数组类型）
 *   - prepare: true（Hyperdrive 原生支持 prepared statements 缓存，false 会导致额外 round-trip）
 *   Hyperdrive 自己维护连接池，每请求新建 client 很快且推荐。
 *
 * 本地开发：直连 Neon，用 prepare: false 兼容 Neon pooler（PgBouncer 模式）。
 */
export function createDb(connectionString: string, isHyperdrive = false): Db {
  const client = postgres(connectionString, {
    max: isHyperdrive ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: false,
    // Hyperdrive 支持 prepared statements 缓存；Neon pooler (PgBouncer) 不支持
    prepare: isHyperdrive ? true : false,
  });
  return drizzle(client, { schema });
}

/** 本地开发单例 */
let _localDb: Db | null = null;

/** 本地开发懒初始化：若已设置 DATABASE_URL 则在模块加载时初始化 */
if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
  const client = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 120,
    connect_timeout: 10,
    prepare: false,
  });
  _localDb = drizzle(client, { schema });
}

/**
 * 本地开发单例 db。Workers 环境下不使用（路由用 c.get('db')）。
 * 仅供本地脚本（migrate / rebuild / update-admin）等未走中间件的场景使用。
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!_localDb) {
      throw new Error(
        'DB not initialized. Local: set DATABASE_URL env var. ' +
        'Workers: routes should use c.get("db") from request-scoped middleware.',
      );
    }
    return Reflect.get(_localDb as object, prop);
  },
}) as Db;
