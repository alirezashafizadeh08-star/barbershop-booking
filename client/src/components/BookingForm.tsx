import { useState, useId } from 'react';
import type { FormEvent } from 'react';
import type { Service } from '../types/service.ts';
import type { BookingFormData, BookingValidationErrors } from '../types/booking.ts';
import { submitBooking } from '../api/appointments.ts';
import type { AppointmentConfirmation } from '../api/appointments.ts';
import {
  normalizeDigits,
  validateFullName,
  validatePhone,
  getTehranTodayDate,
  getTehranMaxBookingDate,
  validateBookingDate,
  validateBookingTime,
  getAvailableTimeSlots,
  getLatestStartTime,
  formatPrice,
  formatDuration,
  formatPersianDate,
} from '../utils/validation.ts';

interface BookingFormProps {
  services: Service[];
  onSubmit?: (data: BookingFormData) => void;
}

export function BookingForm({ services, onSubmit }: BookingFormProps) {
  const fullNameId = useId();
  const phoneId = useId();
  const dateId = useId();
  const timeId = useId();

  const todayTehran = getTehranTodayDate();
  const maxBookingDateTehran = getTehranMaxBookingDate(7);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    services.length > 0 ? [services[0].id] : [],
  );
  const [date, setDate] = useState(todayTehran);
  const [time, setTime] = useState('');

  // Validation State
  const [errors, setErrors] = useState<BookingValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Submission State (Real appointment registration)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<AppointmentConfirmation | null>(null);

  // Calculations for selected services
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalDurationMinutes = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPriceToman = selectedServices.reduce((sum, s) => sum + s.priceToman, 0);

  // Dynamic slot calculations based on current date, duration, and Asia/Tehran time
  const availableSlots = getAvailableTimeSlots(date, totalDurationMinutes);
  const latestStartTime = getLatestStartTime(totalDurationMinutes);
  const isToday = date === todayTehran;
  const noSlotsAvailableToday = isToday && availableSlots.length === 0;

  const minTime = isToday ? availableSlots[0] : '10:00';
  const maxTime = latestStartTime;

  // Toggle service selection with mutual exclusion for "اصلاح مو" and "اصلاح مو و ریش"
  function handleToggleService(serviceId: string) {
    setSelectedServiceIds((prev) => {
      const isAlreadySelected = prev.includes(serviceId);
      let next: string[];

      if (isAlreadySelected) {
        next = prev.filter((id) => id !== serviceId);
        if (next.length === 0) {
          setErrors((e) => ({ ...e, serviceIds: 'حداقل یک خدمت باید انتخاب شود.' }));
        } else {
          setErrors((e) => ({ ...e, serviceIds: undefined }));
        }
      } else {
        // Mutual exclusion logic: "اصلاح مو" vs "اصلاح مو و ریش"
        const targetService = services.find((s) => s.id === serviceId);
        next = [...prev];

        if (targetService?.name === 'اصلاح مو') {
          const conflicting = services.find((s) => s.name === 'اصلاح مو و ریش');
          if (conflicting) {
            next = next.filter((id) => id !== conflicting.id);
          }
        } else if (targetService?.name === 'اصلاح مو و ریش') {
          const conflicting = services.find((s) => s.name === 'اصلاح مو');
          if (conflicting) {
            next = next.filter((id) => id !== conflicting.id);
          }
        }

        next.push(serviceId);
        setErrors((e) => ({ ...e, serviceIds: undefined }));
      }

      // Check if previously selected time remains valid with new total duration
      const nextServices = services.filter((s) => next.includes(s.id));
      const nextDuration = nextServices.reduce((sum, s) => sum + s.durationMinutes, 0);

      if (time) {
        const timeErr = validateBookingTime(date, time, nextDuration);
        if (timeErr) {
          setTime('');
          setErrors((e) => ({ ...e, time: undefined }));
        }
      }

      return next;
    });
  }

  // Handle Full Name Change & Blur
  function handleFullNameChange(value: string) {
    setFullName(value);
    if (touched.fullName) {
      setErrors((prev) => ({
        ...prev,
        fullName: validateFullName(value) ?? undefined,
      }));
    }
  }

  function handleFullNameBlur() {
    setTouched((prev) => ({ ...prev, fullName: true }));
    setErrors((prev) => ({
      ...prev,
      fullName: validateFullName(fullName) ?? undefined,
    }));
  }

  // Handle Phone Change & Blur
  function handlePhoneChange(value: string) {
    const normalized = normalizeDigits(value);
    setPhone(normalized);
    if (touched.phone) {
      setErrors((prev) => ({
        ...prev,
        phone: validatePhone(normalized) ?? undefined,
      }));
    }
  }

  function handlePhoneBlur() {
    setTouched((prev) => ({ ...prev, phone: true }));
    setErrors((prev) => ({
      ...prev,
      phone: validatePhone(phone) ?? undefined,
    }));
  }

  // Handle Date Change: clears invalid time if previous selection is now in the past or invalid
  function handleDateChange(newDate: string) {
    setDate(newDate);
    const dateErr = validateBookingDate(newDate);
    setErrors((prev) => ({
      ...prev,
      date: dateErr ?? undefined,
    }));

    if (time) {
      const timeErr = validateBookingTime(newDate, time, totalDurationMinutes);
      if (timeErr) {
        setTime('');
        setErrors((prev) => ({ ...prev, time: undefined }));
      }
    }
  }

  // Handle Time Change
  function handleTimeChange(newTime: string) {
    setTime(newTime);
    const timeErr = validateBookingTime(date, newTime, totalDurationMinutes);
    setErrors((prev) => ({
      ...prev,
      time: timeErr ?? undefined,
    }));
  }

  // Validate entire form
  function validateAll(): boolean {
    const nameError = validateFullName(fullName);
    const phoneError = validatePhone(phone);
    const dateError = validateBookingDate(date);
    const serviceError =
      selectedServiceIds.length === 0 ? 'حداقل یک خدمت باید انتخاب شود.' : null;
    const timeError = validateBookingTime(date, time, totalDurationMinutes);

    const newErrors: BookingValidationErrors = {
      fullName: nameError ?? undefined,
      phone: phoneError ?? undefined,
      date: dateError ?? undefined,
      serviceIds: serviceError ?? undefined,
      time: timeError ?? undefined,
    };

    setErrors(newErrors);
    setTouched({
      fullName: true,
      phone: true,
      date: true,
      time: true,
      serviceIds: true,
    });

    return !nameError && !phoneError && !dateError && !serviceError && !timeError;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateAll()) {
      return;
    }

    const payload: BookingFormData = {
      fullName: fullName.trim(),
      phone: normalizeDigits(phone).trim(),
      serviceIds: selectedServiceIds,
      date,
      time,
    };

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitBooking(payload);
      setConfirmedAppointment(result);
      if (onSubmit) {
        onSubmit(payload);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطای نامشخصی در ثبت نوبت رخ داد.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleResetToNewBooking() {
    setConfirmedAppointment(null);
    setSubmitError(null);
    setFullName('');
    setPhone('');
    setTime('');
    setDate(todayTehran);
    setSelectedServiceIds(services.length > 0 ? [services[0].id] : []);
    setErrors({});
    setTouched({});
  }

  // Real confirmed appointment view
  if (confirmedAppointment) {
    return (
      <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm text-white">
            ✓
          </span>
          <div>
            <h3 className="font-bold text-stone-900">نوبت شما با موفقیت ثبت شد!</h3>
            <p className="text-xs text-stone-500">اطلاعات نوبت در سامانه ثبت گردید.</p>
          </div>
        </div>

        {/* کد پیگیری برجسته */}
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 text-center">
          <span className="text-xs font-medium text-emerald-800">کد پیگیری اختصاصی نوبت:</span>
          <div className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-emerald-950">
            {confirmedAppointment.trackingCode}
          </div>
          <p className="mt-1 text-[11px] text-emerald-700">
            لطفاً این کد پیگیری را جهت مراجعه حضوری یا لغو نوبت یادداشت فرمایید.
          </p>
        </div>

        <div className="divide-y divide-stone-200 text-sm">
          <div className="flex justify-between py-2 text-stone-700">
            <span className="text-stone-500">نام مشتری:</span>
            <span className="font-semibold text-stone-900">{confirmedAppointment.customerName}</span>
          </div>

          <div className="flex justify-between py-2 text-stone-700">
            <span className="text-stone-500">شماره موبایل:</span>
            <span dir="ltr" className="font-mono font-medium text-stone-900">
              {confirmedAppointment.phone}
            </span>
          </div>

          <div className="flex justify-between py-2 text-stone-700">
            <span className="text-stone-500">تاریخ نوبت:</span>
            <span className="font-medium text-stone-900">
              {formatPersianDate(confirmedAppointment.date)} ({confirmedAppointment.date})
            </span>
          </div>

          <div className="flex justify-between py-2 text-stone-700">
            <span className="text-stone-500">ساعت نوبت:</span>
            <span className="font-semibold text-stone-900">{confirmedAppointment.time}</span>
          </div>

          <div className="py-2">
            <span className="text-stone-500">خدمات رزروشده ({confirmedAppointment.services.length} مورد):</span>
            <ul className="mt-1.5 space-y-1">
              {confirmedAppointment.services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-xs border border-stone-200"
                >
                  <span className="font-medium text-stone-800">{service.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500">{formatDuration(service.durationMinutes)}</span>
                    <span className="font-semibold text-emerald-700">
                      {formatPrice(service.priceToman)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between py-2.5 font-semibold text-stone-900">
            <span>مجموع مدت‌زمان:</span>
            <span>{formatDuration(confirmedAppointment.durationMinutes)}</span>
          </div>

          <div className="flex justify-between py-2.5 text-base font-bold text-emerald-800">
            <span>مبلغ قابل پرداخت (حضوری):</span>
            <span>{formatPrice(confirmedAppointment.priceToman)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-stone-100 p-2.5 text-center text-xs text-stone-600">
          پرداخت هزینه صرفاً به‌صورت حضوری در محل آرایشگاه انجام خواهد شد.
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleResetToNewBooking}
            className="w-full cursor-pointer rounded-xl bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 focus:outline-none"
          >
            ثبت نوبت جدید
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* پیام خطای سرور در صورت بروز خطا */}
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {submitError}
        </div>
      )}

      {/* ۱. انتخاب خدمات (چندخدمتی + فشرده) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-stone-800">
            انتخاب خدمات <span className="text-xs font-normal text-stone-500">(امکان انتخاب هم‌زمان چند خدمت)</span>
          </label>
          {selectedServiceIds.length > 0 && (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
              {selectedServiceIds.length} خدمت انتخاب‌شده
            </span>
          )}
        </div>

        {/* کارتهای جمع‌وجور خدمات در ساختار گرید دو ستونه */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {services.map((service) => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <button
                type="button"
                key={service.id}
                onClick={() => handleToggleService(service.id)}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-2.5 text-right transition ${
                  isSelected
                    ? 'border-stone-800 bg-stone-100/90 ring-1 ring-stone-800'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-stone-900">{service.name}</span>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      isSelected
                        ? 'border-stone-800 bg-stone-800 text-white'
                        : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isSelected && '✓'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">{formatDuration(service.durationMinutes)}</span>
                  <span className="font-medium text-emerald-700">{formatPrice(service.priceToman)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {errors.serviceIds && (
          <p className="mt-1.5 text-xs text-red-600">{errors.serviceIds}</p>
        )}

        {/* جعبه خلاصه مجموع خدمات انتخابی */}
        {selectedServices.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs">
            <span className="text-stone-600">
              مجموع: <strong className="text-stone-800">{formatDuration(totalDurationMinutes)}</strong>
            </span>
            <span className="font-bold text-emerald-700">
              {formatPrice(totalPriceToman)}
            </span>
          </div>
        )}
      </div>

      <hr className="border-stone-100" />

      {/* ۲. نام و نام خانوادگی */}
      <div>
        <label htmlFor={fullNameId} className="mb-1.5 block text-xs sm:text-sm font-semibold text-stone-700">
          نام و نام خانوادگی <span className="text-red-500">*</span>
        </label>
        <input
          id={fullNameId}
          type="text"
          placeholder="مثال: علی محمدی"
          value={fullName}
          onChange={(e) => handleFullNameChange(e.target.value)}
          onBlur={handleFullNameBlur}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition focus:outline-none focus:ring-1 ${
            errors.fullName
              ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20'
              : 'border-stone-200 bg-stone-50/80 focus:border-stone-800 focus:bg-white focus:ring-stone-800/10'
          }`}
        />
        {errors.fullName && (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.fullName}</p>
        )}
      </div>

      {/* ۳. شماره موبایل */}
      <div>
        <label htmlFor={phoneId} className="mb-1.5 block text-xs sm:text-sm font-semibold text-stone-700">
          شماره موبایل <span className="text-red-500">*</span>
        </label>
        <input
          id={phoneId}
          type="tel"
          dir="ltr"
          placeholder="09123456789"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          onBlur={handlePhoneBlur}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-right font-mono text-sm text-stone-900 placeholder-stone-400 transition focus:outline-none focus:ring-1 ${
            errors.phone
              ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20'
              : 'border-stone-200 bg-stone-50/80 focus:border-stone-800 focus:bg-white focus:ring-stone-800/10'
          }`}
        />
        {errors.phone && (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.phone}</p>
        )}
      </div>

      {/* ۴. تاریخ و ساعت نوبت */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={dateId} className="mb-1.5 block text-xs sm:text-sm font-semibold text-stone-700">
            تاریخ نوبت <span className="text-red-500">*</span>
          </label>
          <input
            id={dateId}
            type="date"
            min={todayTehran}
            max={maxBookingDateTehran}
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 transition focus:outline-none focus:ring-1 ${
              errors.date
                ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20'
                : 'border-stone-200 bg-stone-50/80 focus:border-stone-800 focus:bg-white focus:ring-stone-800/10'
            }`}
          />
          {errors.date && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.date}</p>
          )}
          {date && !errors.date && (
            <p className="mt-1 text-[11px] text-stone-500 font-medium">{formatPersianDate(date)}</p>
          )}
        </div>

        <div>
          <label htmlFor={timeId} className="mb-1.5 block text-xs sm:text-sm font-semibold text-stone-700">
            ساعت نوبت <span className="text-red-500">*</span>
          </label>
          <input
            id={timeId}
            type="time"
            list="available-time-slots"
            min={minTime}
            max={maxTime}
            step="1800"
            disabled={noSlotsAvailableToday}
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-stone-900 transition focus:outline-none focus:ring-1 ${
              errors.time
                ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20'
                : 'border-stone-200 bg-stone-50/80 focus:border-stone-800 focus:bg-white focus:ring-stone-800/10'
            } ${noSlotsAvailableToday ? 'cursor-not-allowed opacity-60' : ''}`}
          />
          <datalist id="available-time-slots">
            {availableSlots.map((slot) => (
              <option key={slot} value={slot} />
            ))}
          </datalist>
          {errors.time && (
            <p className="mt-1 text-xs text-red-600 font-medium">{errors.time}</p>
          )}
          {noSlotsAvailableToday ? (
            <p className="mt-1 text-xs text-amber-700 font-medium">
              تمامی نوبت‌های مجاز امروز به پایان رسیده‌اند. لطفاً روز دیگری را انتخاب کنید.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-stone-400">
              ساعت کاری: ۱۰:۰۰ تا ۲۰:۰۰ (آخرین سانس مجاز: {latestStartTime})
            </p>
          )}
        </div>
      </div>

      {/* ۵. دکمه ارسال */}
      <button
        type="submit"
        disabled={noSlotsAvailableToday || isSubmitting}
        className={`w-full rounded-xl py-3 sm:py-3.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-stone-900/20 flex items-center justify-center gap-2 ${
          noSlotsAvailableToday || isSubmitting
            ? 'cursor-not-allowed bg-stone-400'
            : 'cursor-pointer bg-stone-900 hover:bg-stone-800 active:scale-[0.99]'
        }`}
      >
        {isSubmitting ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>در حال ثبت نوبت…</span>
          </>
        ) : (
          'ثبت نوبت'
        )}
      </button>
    </form>
  );
}
