import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './middleware/error';
import { authRoutes } from './routes/auth';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes, globalTeamRoutes } from './routes/teams';
import { bracketRoutes } from './routes/bracket';
import { matchRoutes } from './routes/matches';
import { createDb, type Db } from './db';

/**
 * Workers 绑定类型
 * - HYPERDRIVE: Cloudflare Hyperdrive 连接池绑定
 * - JWT_SECRET: 通过 `wrangler secret put JWT_SECRET` 设置
 */
type Bindings = {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: { db: Db } }>();

// CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
  credentials: true,
}));

/**
 * 请求级 DB 中间件：每请求创建新 DB client 存入 Hono Context（c.set('db', ...)）。
 *
 * 背景：Workers 的 I/O 对象（socket）不能跨请求复用，复用会导致间歇性 500
 * （交替出现 200/500）。模块级变量方案在 await 期间存在跨请求竞态，
 * 改用 Hono Context Variables 可保证实例严格绑定到当前请求。
 *
 * Workers 用 Hyperdrive 连接串；本地开发用 DATABASE_URL。统一走 createDb，
 * 每请求新实例（本地虽有连接池开销但可接受）。
 */
app.use('*', async (c, next) => {
  const hyperdriveStr = c.env.HYPERDRIVE?.connectionString;
  if (hyperdriveStr) {
    // Workers + Hyperdrive
    c.set('db', createDb(hyperdriveStr, true));
  } else if (process.env.DATABASE_URL) {
    // 本地开发
    c.set('db', createDb(process.env.DATABASE_URL, false));
  }
  await next();
});

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
 * - Workers: fetch(req, env) 经中间件按请求创建 db client 存入 Context（避免跨请求复用失效 socket）
 * - Bun: 中间件用 process.env.DATABASE_URL 每请求创建 db client
 */
export default {
  port: Number(process.env.PORT) || 3001,
  async fetch(req: Request, env: Bindings): Promise<Response> {
    if (env.JWT_SECRET) {
      process.env.JWT_SECRET = env.JWT_SECRET;
    }
    return app.fetch(req, env);
  },
};
