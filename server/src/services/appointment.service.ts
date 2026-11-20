import { prisma } from '../lib/prisma.ts';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/appError.ts';
import { generateTrackingCode } from '../utils/trackingCode.ts';
import { getLatestStartTime, normalizeDigits } from '../utils/bookingValidation.ts';

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

/**
 * Creates a real appointment in the database within a transaction.
 * Guarantees atomicity, customer upsert without duplicates,
 * business rule checks, and unique tracking code generation.
 */
export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentConfirmationDto> {
  const trimmedName = input.fullName.trim();
  const normalizedPhone = normalizeDigits(input.phone).trim();
  const trimmedDate = input.date.trim();
  const trimmedTime = input.time.trim();
  const serviceIds = input.serviceIds;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch active barber & branch
    const barber = await tx.barber.findFirst({
      where: { isActive: true },
      include: { branch: true },
    });

    if (!barber || !barber.branch) {
      throw new NotFoundError('اطلاعات آرایشگر فعال یا شعبه یافت نشد.');
    }

    // 2. Fetch requested active services
    const services = await tx.service.findMany({
      where: {
        id: { in: serviceIds },
        branchId: barber.branchId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestError('یک یا چند خدمت انتخاب‌شده معتبر نیستند یا غیرفعال شده‌اند.');
    }

    // 3. Compute duration, price, and snapshot name
    const totalDurationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalPriceToman = services.reduce((sum, s) => sum + s.priceToman, 0);
    const serviceNameSnapshot = services.map((s) => s.name).join(' + ');
    const primaryServiceId = services[0].id;

    // 4. Verify latest allowable start time
    const latestStart = getLatestStartTime(totalDurationMinutes);
    if (trimmedTime > latestStart) {
      throw new BadRequestError(
        `با توجه به مدت‌زمان خدمت (${totalDurationMinutes} دقیقه)، آخرین ساعت شروع مجاز ${latestStart} است.`,
      );
    }

    // 5. Construct Asia/Tehran timestamps (UTC+03:30)
    const startAt = new Date(`${trimmedDate}T${trimmedTime}:00+03:30`);
    const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60 * 1000);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestError('تاریخ یا ساعت واردشده نامعتبر است.');
    }

    // Verify start time is not in the past
    if (startAt.getTime() <= Date.now()) {
      throw new BadRequestError('امکان رزرو نوبت در گذشته یا زمان فعلی وجود ندارد.');
    }

    // Verify not Friday (DOW = 5)
    const [year, month, day] = trimmedDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (dateObj.getUTCDay() === 5) {
      throw new BadRequestError('آرایشگاه در روزهای جمعه تعطیل است. لطفاً روز دیگری را انتخاب کنید.');
    }

    // 6. Check for overlapping active appointments for this barber (R2)
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

    // 7. Upsert customer: prevents duplicate customers, updates name if modified
    const customer = await tx.customer.upsert({
      where: { phone: normalizedPhone },
      update: { fullName: trimmedName },
      create: { fullName: trimmedName, phone: normalizedPhone },
    });

    // 8. Generate unique tracking code
    let trackingCode = generateTrackingCode();
    let existingTracking = await tx.appointment.findUnique({
      where: { trackingCode },
    });
    let attempts = 0;
    while (existingTracking && attempts < 10) {
      trackingCode = generateTrackingCode();
      existingTracking = await tx.appointment.findUnique({
        where: { trackingCode },
      });
      attempts++;
    }

    // 9. Create appointment
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
  });
}
