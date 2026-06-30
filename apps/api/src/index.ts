import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { AppError } from './middleware/error';
import { authRoutes } from './routes/auth';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes, globalTeamRoutes } from './routes/teams';
import { bracketRoutes } from './routes/bracket';
import { matchRoutes } from './routes/matches';

const app = new Elysia()
  .use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'], credentials: true }))
  .error({ AppError })
  .onError(({ code, error, set }) => {
    console.error('[API Error]', code, error?.message ?? error);
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { error: { code: error.code, message: error.message } };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: { code: 'VALIDATION_ERROR', message: error.message } };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
    }
    set.status = 500;
    return { error: { code: 'INTERNAL_ERROR', message: error?.message ?? 'Internal server error' } };
  })
  .use(authRoutes)
  .use(tournamentRoutes)
  .use(globalTeamRoutes)
  .use(teamRoutes)
  .use(bracketRoutes)
  .use(matchRoutes)
  .get('/api/v1/health', () => ({ status: 'ok' }))
  .listen(process.env.PORT || 3001);

console.log(`API running at http://localhost:${app.server!.port}`);
