import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * 数据库实例 — 在 Workers 环境下需要先调用 initDb(env.HYPERDRIVE.connectionString) 初始化。
 * 本地开发（Bun/Node）下可直接用 DATABASE_URL 环境变量，构造时即完成初始化。
 */
type Db = ReturnType<typeof drizzle<typeof schema>>;
let _db: Db | null = null;

/** Workers 入口调用：用 Hyperdrive 连接串初始化 */
export function initDb(connectionString: string): Db {
  if (_db) return _db;
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Hyperdrive / Neon pooler 不支持 prepared statements
    prepare: false,
  });
  _db = drizzle(client, { schema });
  return _db;
}

/** 本地开发懒初始化：若已设置 DATABASE_URL 则在模块加载时初始化 */
if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
  initDb(process.env.DATABASE_URL);
}

/**
 * db 代理：转发所有属性访问到已初始化的 _db。
 * 若未初始化（Workers 首次请求未调 initDb），抛错提示。
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!_db) {
      throw new Error(
        'DB not initialized. Workers: call initDb(env.HYPERDRIVE.connectionString) first; ' +
        'local: set DATABASE_URL env var.',
      );
    }
    return Reflect.get(_db as object, prop);
  },
}) as Db;
