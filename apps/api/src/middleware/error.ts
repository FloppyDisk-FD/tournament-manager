import { Elysia } from 'elysia';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
  }
}

export const errorPlugin = new Elysia({ name: 'error' })
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
  });
