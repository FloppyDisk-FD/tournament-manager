import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError } from './middleware/error';
import { authRoutes } from './routes/auth';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes, globalTeamRoutes } from './routes/teams';
import { bracketRoutes } from './routes/bracket';
import { matchRoutes } from './routes/matches';

const app = new Hono();

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

const port = Number(process.env.PORT) || 3001;

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`API running at http://localhost:${port}`);
