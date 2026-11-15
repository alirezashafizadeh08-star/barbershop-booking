import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getActiveServices } from '../services/serviceCatalog.service.ts';

export const servicesRouter = Router();

/**
 * GET /api/services
 * Returns the list of active services available for booking.
 */
servicesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await getActiveServices();
    res.json({ services });
  } catch (error) {
    next(error);
  }
});
