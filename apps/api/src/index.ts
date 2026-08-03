import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './middleware/error';
import { authRoutes } from './routes/auth';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes, globalTeamRoutes, publicTeamRoutes } from './routes/teams';
import { bracketRoutes } from './routes/bracket';
import { matchRoutes } from './routes/matches';
import { registrationRoutes } from './routes/registrations';
import { checkinRoutes } from './routes/checkins';
import { exportRoutes } from './routes/exports';
import { paymentRoutes } from './routes/payments';
import { predictionRoutes } from './routes/predictions';
import { notificationRoutes } from './routes/notifications';
import { pushRoutes } from './routes/push';
import { createDb, db, type Db } from './db';
import { registrations, tournaments } from './db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireAuth } from './middleware/auth';

/**
 * Workers 绑定类型
 * - HYPERDRIVE: Cloudflare Hyperdrive 连接池绑定
 * - JWT_SECRET: 通过 `wrangler secret put JWT_SECRET` 设置
 */
type Bindings = {
  HYPERDRIVE: { connectionString: string };
  JWT_SECRET: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: { db: Db } }>();

// CORS
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
  credentials: true,
}));

/**
 * 请求级 DB 中间件。
 *
 * - Workers + Hyperdrive：每请求创建新 DB client 存入 Hono Context（c.set('db', ...)）。
 *   背景：Workers 的 I/O 对象（socket）不能跨请求复用，复用会导致间歇性 500
 *   （交替出现 200/500）。模块级变量方案在 await 期间存在跨请求竞态，
 *   改用 Hono Context Variables 可保证实例严格绑定到当前请求。
 * - 本地开发（Bun/Node）：复用模块级单例连接池（db），避免每请求新建连接。
 *   远端数据库（如 Neon）每次新建 client 都会触发 TCP/TLS/认证多次握手，
 *   网络延迟高时会让每个请求慢几百毫秒。
 */
app.use('*', async (c, next) => {
  const hyperdriveStr = c.env.HYPERDRIVE?.connectionString;
  if (hyperdriveStr) {
    // Workers + Hyperdrive
    c.set('db', createDb(hyperdriveStr, true));
  } else if (process.env.DATABASE_URL) {
    // 本地开发：复用单例连接池
    c.set('db', db);
  }
  await next();
});

// 全局错误处理
app.onError((err, c) => {
  console.error('[API Error]', err);
  if (err instanceof AppError) {
    c.status(err.statusCode as any);
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
app.route('/api/v1/public/teams', publicTeamRoutes);
app.route('/api/v1/matches', matchRoutes);
app.route('/api/v1/tournaments', registrationRoutes);
app.route('/api/v1/payments', paymentRoutes);
app.route('/api/v1/tournaments', predictionRoutes);
app.route('/api/v1/tournaments', checkinRoutes);
app.route('/api/v1/tournaments', exportRoutes);
app.route('/api/v1/notifications', notificationRoutes);
app.route('/api/v1/push', pushRoutes);

// 我的全部报名（跨赛事，用户后台）
app.get('/api/v1/registrations/mine', authMiddleware, requireAuth, async (c) => {
  const user = c.get('user')!;
  const rows = await c.get('db').select({
    registration: registrations,
    tournament: { id: tournaments.id, name: tournaments.name, status: tournaments.status },
  })
    .from(registrations)
    .leftJoin(tournaments, eq(tournaments.id, registrations.tournamentId))
    .where(eq(registrations.userId, user.id))
    .orderBy(desc(registrations.createdAt));
  return c.json(rows.map((r) => ({ ...r.registration, tournament: r.tournament })));
});

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
