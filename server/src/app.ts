import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { apiRouter } from './routes/index.ts';
import { AppError } from './errors/appError.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api', apiRouter);

  // Unknown API routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'مسیر موردنظر یافت نشد.' });
  });

  // Central error handler (must keep 4 parameters so Express treats it as an error handler)
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Malformed JSON body from body-parser (entity.parse.failed)
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as Record<string, unknown>)['type'] === 'entity.parse.failed'
    ) {
      res.status(400).json({ message: 'بدنه درخواست JSON نامعتبر است.' });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        message: error.message,
        details: error.details,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('23P01') ||
      errorMessage.includes('appointments_no_overlap_active')
    ) {
      res.status(409).json({
        message: 'این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت یا تاریخ دیگری را انتخاب کنید.',
      });
      return;
    }

    console.error(error);
    res.status(500).json({ message: 'خطای داخلی سرور رخ داد. لطفاً دوباره تلاش کنید.' });
  });

  return app;
}
