import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { bookingRequestSchema } from '../utils/bookingValidation.ts';
import { createAppointment } from '../services/appointment.service.ts';
import { AppError, ConflictError } from '../errors/appError.ts';

export const appointmentsRouter = Router();

/**
 * POST /api/appointments
 * Public booking endpoint: creates a confirmed appointment with unique tracking code.
 */
appointmentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = bookingRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors).flat()[0] || 'اطلاعات ارسالی نامعتبر است.';

      res.status(400).json({
        message: firstErrorMessage,
        errors: fieldErrors,
      });
      return;
    }

    const appointment = await createAppointment(parseResult.data);
    res.status(201).json(appointment);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Concurrency / Database Exclusion Constraint collision (FR-9)
    if (
      errorMessage.includes('23P01') ||
      errorMessage.includes('appointments_no_overlap_active')
    ) {
      next(new ConflictError());
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        message: error.message,
        details: error.details,
      });
      return;
    }

    next(error);
  }
});
