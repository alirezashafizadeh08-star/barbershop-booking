import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import {
  createAdminToken,
  requireAdminAuth,
  verifyPassword,
  type AuthenticatedRequest,
} from '../utils/auth.ts';
import { getTehranTodayDate, isValidCalendarDate } from '../utils/bookingValidation.ts';

export const adminRouter = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری الزامی است.'),
  password: z.string().min(1, 'رمز عبور الزامی است.'),
});

/**
 * Format a Date to 'HH:mm' in Asia/Tehran timezone.
 */
function formatTimeTehran(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
}

/**
 * POST /api/admin/login
 * Admin authentication endpoint.
 */
adminRouter.post('/login', async (req, res): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: parseResult.error.issues[0]?.message || 'اطلاعات ورود نامعتبر است.',
    });
    return;
  }

  const { username, password } = parseResult.data;

  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || !admin.isActive) {
    res.status(401).json({
      message: 'نام کاربری یا رمز عبور اشتباه است.',
    });
    return;
  }

  const isPasswordValid = verifyPassword(password, admin.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({
      message: 'نام کاربری یا رمز عبور اشتباه است.',
    });
    return;
  }

  const token = createAdminToken(admin);

  res.status(200).json({
    token,
    username: admin.username,
  });
});

/**
 * GET /api/admin/me
 * Returns current admin information.
 */
adminRouter.get('/me', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    username: req.admin?.username,
  });
});

/**
 * GET /api/admin/appointments?date=YYYY-MM-DD
 * Returns all appointments for the requested date, ordered by time.
 * Defaults to today's date in Asia/Tehran.
 */
adminRouter.get(
  '/appointments',
  requireAdminAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let dateStr = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!dateStr) {
      dateStr = getTehranTodayDate();
    }

    if (!isValidCalendarDate(dateStr)) {
      res.status(400).json({
        message: 'فرمت یا مقدار تاریخ نامعتبر است. تاریخ باید یک تاریخ معتبر تقویمی به صورت YYYY-MM-DD باشد.',
      });
      return;
    }

    // Interval covering full Tehran day: [00:00:00+03:30, 23:59:59.999+03:30]
    const dayStart = new Date(`${dateStr}T00:00:00.000+03:30`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999+03:30`);

    const appointments = await prisma.appointment.findMany({
      where: {
        startAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    const items = appointments.map((appt) => ({
      id: appt.id,
      trackingCode: appt.trackingCode,
      customerName: appt.customerNameSnapshot,
      phone: appt.customer.phone,
      serviceName: appt.serviceNameSnapshot,
      durationMinutes: appt.durationMinutesSnapshot,
      priceToman: appt.priceTomanSnapshot,
      status: appt.status,
      startAt: appt.startAt.toISOString(),
      endAt: appt.endAt.toISOString(),
      startTime: formatTimeTehran(appt.startAt),
      endTime: formatTimeTehran(appt.endAt),
      cancelledAt: appt.cancelledAt ? appt.cancelledAt.toISOString() : null,
      createdAt: appt.createdAt.toISOString(),
    }));

    const summary = {
      total: items.length,
      confirmed: items.filter((i) => i.status === 'CONFIRMED').length,
      cancelled: items.filter((i) => i.status === 'CANCELLED').length,
      completed: items.filter((i) => i.status === 'COMPLETED').length,
    };

    res.status(200).json({
      date: dateStr,
      summary,
      appointments: items,
    });
  },
);

/**
 * Helper handler for cancelling appointment.
 * Enforces business rules:
 * - Cannot cancel non-existent appointment (404)
 * - Cannot cancel already cancelled appointment (400)
 * - Cannot cancel completed appointment (400)
 * - Sets status = CANCELLED, cancelledAt = now() (R4)
 */
async function handleCancelAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const paramId = req.params.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;

  if (!id) {
    res.status(400).json({ message: 'شناسه نوبت نامعتبر است.' });
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { customer: true },
  });

  if (!appointment) {
    res.status(404).json({
      message: 'نوبت موردنظر یافت نشد.',
    });
    return;
  }

  if (appointment.status === 'CANCELLED') {
    res.status(400).json({
      message: 'این نوبت قبلاً لغو شده است و امکان لغو مجدد آن وجود ندارد.',
    });
    return;
  }

  if (appointment.status === 'COMPLETED') {
    res.status(400).json({
      message: 'این نوبت قبلاً تکمیل شده است و امکان لغو آن وجود ندارد.',
    });
    return;
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  res.status(200).json({
    message: 'نوبت با موفقیت لغو شد و بازه زمانی آن آزاد گردید.',
    appointment: {
      id: updated.id,
      trackingCode: updated.trackingCode,
      customerName: updated.customerNameSnapshot,
      phone: appointment.customer.phone,
      serviceName: updated.serviceNameSnapshot,
      status: updated.status,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      startTime: formatTimeTehran(updated.startAt),
      endTime: formatTimeTehran(updated.endAt),
      cancelledAt: updated.cancelledAt ? updated.cancelledAt.toISOString() : null,
    },
  });
}

// Support both PATCH and POST for cancel action
adminRouter.patch('/appointments/:id/cancel', requireAdminAuth, handleCancelAppointment);
adminRouter.post('/appointments/:id/cancel', requireAdminAuth, handleCancelAppointment);
