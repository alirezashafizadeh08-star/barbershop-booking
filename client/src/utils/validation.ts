/**
 * Normalizes Persian (۰-۹) and Arabic (٠-٩) digits to standard ASCII English digits (0-9).
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
 * Validates customer name:
 * - Must not be empty.
 * - Minimum 2, maximum 100 characters.
 * - Only Persian or Latin letters, spaces, and Persian half-space (ZWNJ).
 * - No numbers or special symbols.
 */
export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'لطفاً نام و نام خانوادگی خود را وارد کنید.';
  }

  if (trimmed.length < 2) {
    return 'نام و نام خانوادگی باید حداقل ۲ حرف باشد.';
  }

  if (trimmed.length > 100) {
    return 'نام و نام خانوادگی نمی‌تواند بیش از ۱۰۰ حرف باشد.';
  }

  // Persian letters, Latin letters, spaces, and ZWNJ (\u200C)
  const nameRegex = /^[a-zA-Z\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u200C\s]+$/;
  if (!nameRegex.test(trimmed)) {
    return 'نام فقط باید شامل حروف فارسی یا انگلیسی و فاصله باشد (بدون عدد یا علامت).';
  }

  return null;
}

/**
 * Validates Iranian mobile phone number:
 * - Must be 11 digits.
 * - Must start with 09.
 * - Digits only.
 */
export function validatePhone(phone: string): string | null {
  const normalized = normalizeDigits(phone).trim();
  if (!normalized) {
    return 'لطفاً شماره موبایل خود را وارد کنید.';
  }

  if (!normalized.startsWith('09')) {
    return 'شماره موبایل باید با ۰۹ شروع شود (مثال: ۰۹۱۲۳۴۵۶۷۸۹).';
  }

  if (!/^\d+$/.test(normalized)) {
    return 'شماره موبایل فقط می‌تواند شامل ارقام باشد.';
  }

  if (normalized.length !== 11) {
    return 'شماره موبایل باید دقیقاً ۱۱ رقم باشد.';
  }

  return null;
}

/**
 * Returns today's date formatted as YYYY-MM-DD based on Asia/Tehran timezone.
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
 * Returns the maximum allowed booking date (by default 7 days from today) in Asia/Tehran timezone.
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
 * Returns the current time in Asia/Tehran timezone as { hours, minutes, timeString: 'HH:mm' }.
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
 * (start_time + duration) <= 20:00 (closing time).
 */
export function getLatestStartTime(durationMinutes = 30): string {
  const closingMinutes = 20 * 60; // 20:00 = 1200 minutes
  const latestStartMinutes = Math.max(10 * 60, closingMinutes - durationMinutes);
  const hours = Math.floor(latestStartMinutes / 60);
  const minutes = latestStartMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Generates all valid 30-minute time slots (HH:mm) between 10:00 and 20:00 for a given date.
 * If date is today in Tehran, excludes any slot that has already started or is currently now.
 */
export function getAvailableTimeSlots(
  dateStr: string,
  durationMinutes = 30,
  now = new Date(),
): string[] {
  const today = getTehranTodayDate(now);
  const latestStart = getLatestStartTime(durationMinutes);
  const nowTehran = getTehranCurrentTime(now).timeString;

  const allSlots: string[] = [];
  for (let h = 10; h < 20; h++) {
    for (const m of [0, 30]) {
      const slot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (slot <= latestStart) {
        allSlots.push(slot);
      }
    }
  }

  if (dateStr === today) {
    // Strictly future slots: slot must be strictly greater than current Tehran time
    return allSlots.filter((slot) => slot > nowTehran);
  }

  return allSlots;
}

/**
 * Validates that the selected date is not in the past and within the allowed 7-day future window.
 */
export function validateBookingDate(dateStr: string, now = new Date()): string | null {
  if (!dateStr || !dateStr.trim()) {
    return 'لطفاً تاریخ نوبت را انتخاب کنید.';
  }

  const today = getTehranTodayDate(now);
  const maxDate = getTehranMaxBookingDate(7, now);

  if (dateStr < today) {
    return 'امکان انتخاب تاریخ در گذشته وجود ندارد.';
  }

  if (dateStr > maxDate) {
    return 'رزرو نوبت حداکثر تا ۷ روز آینده مجاز است.';
  }

  // Friday check (DOW = 5 in UTC/Tehran)
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (dateObj.getUTCDay() === 5) {
    return 'آرایشگاه در روزهای جمعه تعطیل است. لطفاً روز دیگری را انتخاب کنید.';
  }

  return null;
}

/**
 * Validates the selected booking time:
 * - Must not be empty.
 * - Format must be HH:mm.
 * - Minutes must be 00 or 30.
 * - Start time must be >= 10:00 and <= latest allowable start time.
 * - If date is today, start time must be strictly after current Asia/Tehran time.
 */
export function validateBookingTime(
  dateStr: string,
  timeStr: string,
  durationMinutes = 30,
  now = new Date(),
): string | null {
  if (!timeStr || !timeStr.trim()) {
    return 'لطفاً ساعت نوبت را انتخاب کنید.';
  }

  if (!/^([01]\d|20):[0-5]\d$/.test(timeStr)) {
    return 'ساعت نوبت نامعتبر است.';
  }

  const [hours, minutes] = timeStr.split(':').map(Number);

  if (minutes !== 0 && minutes !== 30) {
    return 'نوبت‌ها فقط در فاصله‌های ۳۰ دقیقه‌ای (دقیقه ۰۰ یا ۳۰) قابل رزرو هستند.';
  }

  if (hours < 10) {
    return 'ساعت کاری آرایشگاه از ۱۰:۰۰ شروع می‌شود.';
  }

  const latestStart = getLatestStartTime(durationMinutes);
  if (timeStr > latestStart) {
    return `با توجه به مدت‌زمان خدمت (${durationMinutes} دقیقه)، آخرین ساعت شروع مجاز ${latestStart} است.`;
  }

  // Check if date is today in Asia/Tehran
  const today = getTehranTodayDate(now);
  if (dateStr === today) {
    const currentTehran = getTehranCurrentTime(now).timeString;
    // Strictly after current time: if timeStr <= currentTehran, it is in the past or exactly current!
    if (timeStr <= currentTehran) {
      return 'امکان انتخاب ساعت در گذشته یا زمان فعلی وجود ندارد.';
    }
  }

  return null;
}

/**
 * Formats a price in Tomans with Persian thousand separators.
 */
export function formatPrice(priceToman: number): string {
  return priceToman.toLocaleString('fa-IR') + ' تومان';
}

/**
 * Formats duration in minutes into a friendly Persian text.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${String(hours)} ساعت`;
  return `${String(hours)} ساعت و ${String(remainder)} دقیقه`;
}

/**
 * Formats a Gregorian YYYY-MM-DD string into a readable Persian date with weekday.
 */
export function formatPersianDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toLocaleDateString('fa-IR-u-ca-persian', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  });
}
