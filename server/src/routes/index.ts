import { Router } from 'express';
import { healthRouter } from './health.ts';
import { servicesRouter } from './services.ts';
import { appointmentsRouter } from './appointments.ts';

/**
 * Root router for everything under `/api`.
 * Feature routers (admin, ...) are mounted here in later tasks.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/appointments', appointmentsRouter);
