import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tournament_manager';

// Neon pooler 兼容配置：禁用 prepared statements，避免 pooler 模式下的 cache miss
const isNeon = connectionString.includes('neon.tech');
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: !isNeon,
});
export const db = drizzle(client, { schema });
