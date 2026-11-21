import { prisma } from '../lib/prisma.ts';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/appError.ts';
import { generateTrackingCode } from '../utils/trackingCode.ts';
import {
  getLatestStartTime,
  isValidCalendarDate,
  normalizeDigits,
} from '../utils/bookingValidation.ts';

const MAX_TRACKING_CODE_RETRIES = 5;
const TRANSACTION_MAX_WAIT_MS = 5000;
const TRANSACTION_TIMEOUT_MS = 8000;

export interface CreateAppointmentInput {
  fullName: string;
  phone: string;
  serviceIds: string[];
  date: string;
  time: string;
}

export interface AppointmentConfirmationDto {
  id: string;
  trackingCode: string;
  customerName: string;
  phone: string;
  serviceName: string;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    priceToman: number;
  }>;
  durationMinutes: number;
  priceToman: number;
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  status: string;
  createdAt: string;
}

function isTrackingCodeUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: string; message?: string; meta?: { target?: unknown } };
  const targetStr = JSON.stringify(errObj.meta?.target ?? '');
  const messageStr = errObj.message ?? '';
  return (
    (errObj.code === 'P2002' || messageStr.includes('Unique constraint failed')) &&
    (targetStr.includes('tracking_code') ||
      targetStr.includes('trackingCode') ||
      messageStr.includes('tracking_code') ||
      messageStr.includes('trackingCode'))
  );
}

/**
 * Creates a real appointment in the database within a concise atomic transaction.
 * Performs CPU validations and base configuration lookups before opening the transaction,
 * guarantees atomicity for overlap verification, customer upsert, and appointment creation,
 * and handles potential trackingCode UNIQUE constraint collisions via safe retries.
 */
export async function createAppointment(
  input: CreateAppointmentInput,
  codeGenerator: () => string = generateTrackingCode,
): Promise<AppointmentConfirmationDto> {
  const trimmedName = input.fullName.trim();
  const normalizedPhone = normalizeDigits(input.phone).trim();
  const trimmedDate = input.date.trim();
  const trimmedTime = input.time.trim();
  const serviceIds = input.serviceIds;

  // 1. Pre-transaction CPU & calendar validations (Asia/Tehran)
  if (!isValidCalendarDate(trimmedDate)) {
    throw new BadRequestError('تاریخ یا ساعت واردشده نامعتبر است.');
  }

  const [year, month, day] = trimmedDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (dateObj.getUTCDay() === 5) {
    throw new BadRequestError('آرایشگاه در روزهای جمعه تعطیل است. لطفاً روز دیگری را انتخاب کنید.');
  }

  const startAt = new Date(`${trimmedDate}T${trimmedTime}:00+03:30`);
  if (Number.isNaN(startAt.getTime())) {
    throw new BadRequestError('تاریخ یا ساعت واردشده نامعتبر است.');
  }

  if (startAt.getTime() <= Date.now()) {
    throw new BadRequestError('امکان رزرو نوبت در گذشته یا زمان فعلی وجود ندارد.');
  }

  // 2. Pre-transaction lookup of active barber, branch, and requested services in one roundtrip
  const barber = await prisma.barber.findFirst({
    where: { isActive: true },
    include: {
      branch: {
        include: {
          services: {
            where: {
              id: { in: serviceIds },
              isActive: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  if (!barber || !barber.branch) {
    throw new NotFoundError('اطلاعات آرایشگر فعال یا شعبه یافت نشد.');
  }

  const services = barber.branch.services;
  if (services.length !== serviceIds.length) {
    throw new BadRequestError('یک یا چند خدمت انتخاب‌شده معتبر نیستند یا غیرفعال شده‌اند.');
  }

  // 3. Compute duration, price, snapshot name, and verify closing boundary (R1)
  const totalDurationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPriceToman = services.reduce((sum, s) => sum + s.priceToman, 0);
  const serviceNameSnapshot = services.map((s) => s.name).join(' + ');
  const primaryServiceId = services[0].id;

  const latestStart = getLatestStartTime(totalDurationMinutes);
  if (trimmedTime > latestStart) {
    throw new BadRequestError(
      `با توجه به مدت‌زمان خدمت (${totalDurationMinutes} دقیقه)، آخرین ساعت شروع مجاز ${latestStart} است.`,
    );
  }

  const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60 * 1000);
  if (Number.isNaN(endAt.getTime())) {
    throw new BadRequestError('تاریخ یا ساعت واردشده نامعتبر است.');
  }

  // 4. Atomic transaction for overlap check, customer upsert, and appointment creation
  // Retries automatically if a random trackingCode collides with the database UNIQUE constraint
  for (let attempt = 0; attempt < MAX_TRACKING_CODE_RETRIES; attempt++) {
    const trackingCode = codeGenerator();

    try {
      return await prisma.$transaction(
        async (tx) => {
          // Verify start time is still strictly in the future at transaction execution time (R3)
          if (startAt.getTime() <= Date.now()) {
            throw new BadRequestError('امکان رزرو نوبت در گذشته یا زمان فعلی وجود ندارد.');
          }

          // Check for overlapping active appointments for this barber (R2)
          // Also enforced at PostgreSQL level by exclusion constraint `appointments_no_overlap_active`
          const overlapping = await tx.appointment.findFirst({
            where: {
              barberId: barber.id,
              status: { not: 'CANCELLED' },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
          });

          if (overlapping) {
            throw new ConflictError(
              'این بازه زمانی قبلاً رزرو شده است. لطفاً ساعت یا تاریخ دیگری را انتخاب کنید.',
            );
          }

          // Upsert customer atomically with appointment creation
          const customer = await tx.customer.upsert({
            where: { phone: normalizedPhone },
            update: { fullName: trimmedName },
            create: { fullName: trimmedName, phone: normalizedPhone },
          });

          // Create appointment — relies on DB UNIQUE constraint on tracking_code
          const appointment = await tx.appointment.create({
            data: {
              branchId: barber.branchId,
              barberId: barber.id,
              serviceId: primaryServiceId,
              customerId: customer.id,
              customerNameSnapshot: trimmedName,
              serviceNameSnapshot,
              durationMinutesSnapshot: totalDurationMinutes,
              priceTomanSnapshot: totalPriceToman,
              startAt,
              endAt,
              status: 'CONFIRMED',
              bookingSource: 'ONLINE',
              trackingCode,
            },
          });

          return {
            id: appointment.id,
            trackingCode: appointment.trackingCode,
            customerName: appointment.customerNameSnapshot,
            phone: customer.phone,
            serviceName: appointment.serviceNameSnapshot,
            services: services.map((s) => ({
              id: s.id,
              name: s.name,
              durationMinutes: s.durationMinutes,
              priceToman: s.priceToman,
            })),
            durationMinutes: appointment.durationMinutesSnapshot,
            priceToman: appointment.priceTomanSnapshot,
            date: trimmedDate,
            time: trimmedTime,
            startAt: appointment.startAt.toISOString(),
            endAt: appointment.endAt.toISOString(),
            status: appointment.status,
            createdAt: appointment.createdAt.toISOString(),
          };
        },
        { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
      );
    } catch (error: unknown) {
      if (isTrackingCodeUniqueViolation(error) && attempt < MAX_TRACKING_CODE_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('امکان تولید کد رهگیری یکتا پس از چند تلاش فراهم نشد.');
}
