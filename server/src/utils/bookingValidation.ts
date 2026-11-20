import { z } from 'zod';

/**
 * Normalizes Persian and Arabic digits to ASCII digits.
 */
export function normalizeDigits(input: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = input;
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }
  return result;
}

/**
 * Today's date in Asia/Tehran (YYYY-MM-DD).
 */
export function getTehranTodayDate(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Max booking date in Asia/Tehran (7 days ahead by default).
 */
export function getTehranMaxBookingDate(daysAhead = 7, now = new Date()): string {
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(future);
}

/**
 * Current time in Asia/Tehran as { hours, minutes, timeString: 'HH:mm' }.
 */
export function getTehranCurrentTime(now = new Date()): {
  hours: number;
  minutes: number;
  timeString: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return { hours, minutes, timeString };
}

/**
 * Calculates the latest allowed start time (HH:mm) so that
 * (start_time + duration) <= 20:00.
 */
export function getLatestStartTime(durationMinutes = 30): string {
  const closingMinutes = 20 * 60; // 20:00
  const latestStartMinutes = Math.max(10 * 60, closingMinutes - durationMinutes);
  const hours = Math.floor(latestStartMinutes / 60);
  const minutes = latestStartMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const NAME_REGEX = /^[a-zA-Z\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u200C\s]+$/;
const PHONE_REGEX = /^09\d{9}$/;

const HAIRCUT_SERVICE_ID = '00000000-0000-4000-8000-000000000011';
const HAIRCUT_AND_BEARD_SERVICE_ID = '00000000-0000-4000-8000-000000000012';

export const bookingRequestSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'نام و نام خانوادگی باید حداقل ۲ حرف باشد.')
      .max(100, 'نام و نام خانوادگی نمی‌تواند بیش از ۱۰۰ حرف باشد.')
      .regex(NAME_REGEX, 'نام فقط باید شامل حروف فارسی یا انگلیسی و فاصله باشد (بدون عدد یا علامت).'),

    phone: z
      .string()
      .trim()
      .transform((val) => normalizeDigits(val))
      .refine(
        (val) => PHONE_REGEX.test(val),
        'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.',
      ),

    serviceIds: z
      .array(z.string().uuid('شناسه خدمت نامعتبر است.'))
      .min(1, 'حداقل یک خدمت باید انتخاب شود.')
      .refine(
        (ids) => !(ids.includes(HAIRCUT_SERVICE_ID) && ids.includes(HAIRCUT_AND_BEARD_SERVICE_ID)),
        'امکان انتخاب هم‌زمان «اصلاح مو» و «اصلاح مو و ریش» وجود ندارد.',
      ),

    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'فرمت تاریخ باید YYYY-MM-DD باشد.'),

    time: z.string().regex(/^([01]\d|20):[0-5]\d$/, 'ساعت نوبت نامعتبر است.'),
  })
  .superRefine((data, ctx) => {
    const today = getTehranTodayDate();
    const maxDate = getTehranMaxBookingDate(7);

    // 1. Validate date boundaries
    if (data.date < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'امکان انتخاب تاریخ در گذشته وجود ندارد.',
      });
      return;
    }

    if (data.date > maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'رزرو نوبت حداکثر تا ۷ روز آینده مجاز است.',
      });
      return;
    }

    // Friday check (DOW === 5)
    const [year, month, day] = data.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (dateObj.getUTCDay() === 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'آرایشگاه در روزهای جمعه تعطیل است. لطفاً روز دیگری را انتخاب کنید.',
      });
      return;
    }

    // 2. Validate time boundaries & 30-minute intervals
    const [hours, minutes] = data.time.split(':').map(Number);
    if (minutes !== 0 && minutes !== 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['time'],
        message: 'نوبت‌ها فقط در فاصله‌های ۳۰ دقیقه‌ای (دقیقه ۰۰ یا ۳۰) قابل رزرو هستند.',
      });
      return;
    }

    if (hours < 10 || hours >= 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['time'],
        message: 'ساعت کاری آرایشگاه از ۱۰:۰۰ تا ۲۰:۰۰ است.',
      });
      return;
    }

    // 3. Strict past-time validation for today in Asia/Tehran
    if (data.date === today) {
      const currentTehranTime = getTehranCurrentTime().timeString;
      if (data.time <= currentTehranTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['time'],
          message: 'امکان انتخاب ساعت در گذشته یا زمان فعلی وجود ندارد.',
        });
      }
    }
  });

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;
