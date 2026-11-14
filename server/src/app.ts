import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { apiRouter } from './routes/index.ts';

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
    console.error(error);
    res.status(500).json({ message: 'خطای داخلی سرور رخ داد. لطفاً دوباره تلاش کنید.' });
  });

  return app;
}
