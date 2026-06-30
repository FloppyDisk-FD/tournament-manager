import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './middleware/error';
import { authRoutes } from './routes/auth';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes, globalTeamRoutes } from './routes/teams';
import { bracketRoutes } from './routes/bracket';
import { matchRoutes } from './routes/matches';
import { initDb } from './db';

/**
 * Workers 绑定类型
 * - HYPERDRIVE: Cloudflare Hyperdrive 连接池绑定
 * - JWT_SECRET: 通过 `wrangler secret put JWT_SECRET` 设置
 */
type Bindings = {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
  credentials: true,
}));

// 全局错误处理
app.onError((err, c) => {
  console.error('[API Error]', err);
  if (err instanceof AppError) {
    c.status(err.statusCode);
    return c.json({ error: { code: err.code, message: err.message } });
  }
  c.status(500);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: err?.message ?? 'Internal server error' } });
});

// 404 处理
app.notFound((c) => {
  c.status(404);
  return c.json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
});

// 路由挂载
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/tournaments', tournamentRoutes);
app.route('/api/v1/tournaments', bracketRoutes);
app.route('/api/v1/tournaments/:id/teams', teamRoutes);
app.route('/api/v1/teams', globalTeamRoutes);
app.route('/api/v1/matches', matchRoutes);

// 健康检查
app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

/**
 * 入口：Workers 和 Bun 共用。
 * - Workers: fetch(req, env) 收到 Hyperdrive 绑定，用 env.HYPERDRIVE.connectionString 初始化 db
 * - Bun: 自动检测 export default { fetch, port } 并启动 server；db 在模块加载时用 DATABASE_URL 初始化
 */
export default {
  port: Number(process.env.PORT) || 3001,
  async fetch(req: Request, env: Bindings): Promise<Response> {
    if (env.HYPERDRIVE?.connectionString) {
      initDb(env.HYPERDRIVE.connectionString);
    }
    if (env.JWT_SECRET) {
      process.env.JWT_SECRET = env.JWT_SECRET;
    }
    return app.fetch(req, env);
  },
};
