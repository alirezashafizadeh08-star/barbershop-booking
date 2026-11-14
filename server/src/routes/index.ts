import { Router } from 'express';
import { healthRouter } from './health.ts';

/**
 * Root router for everything under `/api`.
 * Feature routers (services, appointments, admin, ...) are mounted here in later tasks.
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
