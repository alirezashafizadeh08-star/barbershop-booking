import { useState, useEffect, type FormEvent } from 'react';
import {
  adminLogin,
  fetchAdminAppointments,
  cancelAdminAppointment,
  clearStoredAdminSession,
  getStoredAdminToken,
  getStoredAdminUsername,
  type AdminAppointmentItem,
} from '../api/admin.ts';
import { getTehranTodayDate } from '../utils/validation.ts';

interface AdminAppointmentsProps {
  onBackToBooking: () => void;
}

export function AdminAppointments({ onBackToBooking }: AdminAppointmentsProps) {
  // Auth state
  const [token, setToken] = useState<string | null>(getStoredAdminToken());
  const [username, setUsername] = useState<string>(getStoredAdminUsername() || '');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Appointments state
  const todayTehran = getTehranTodayDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayTehran);
  const [appointments, setAppointments] = useState<AdminAppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cancellation modal state
  const [appointmentToCancel, setAppointmentToCancel] = useState<AdminAppointmentItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load appointments when token or selectedDate changes
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    fetchAdminAppointments(selectedDate, token)
      .then((res) => {
        if (isMounted) {
          setAppointments(res.appointments);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'خطا در بارگذاری نوبت‌ها';
          setLoadError(msg);
          setIsLoading(false);
          if (msg.includes('منقضی') || msg.includes('دسترسی غیرمجاز')) {
            setToken(null);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, selectedDate]);

  // Handle Login
  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await adminLogin(loginUsername.trim(), loginPassword);
      setToken(res.token);
      setUsername(res.username);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Handle Logout
  function handleLogout() {
    clearStoredAdminSession();
    setToken(null);
    setUsername('');
    setAppointments([]);
  }

  // Handle Cancel Appointment Confirmation
  async function confirmCancel() {
    if (!appointmentToCancel || !token || isCancelling) return;

    setIsCancelling(true);
    setCancelError(null);
    setSuccessMessage(null);

    try {
      await cancelAdminAppointment(appointmentToCancel.id, token);
      // Update state locally
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentToCancel.id
            ? { ...item, status: 'CANCELLED', cancelledAt: new Date().toISOString() }
            : item,
        ),
      );
      setSuccessMessage('نوبت با موفقیت لغو شد.');
      setAppointmentToCancel(null);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'خطا در لغو نوبت.');
    } finally {
      setIsCancelling(false);
    }
  }

  // Quick date change helper
  function changeDateOffset(offsetDays: number) {
    setSuccessMessage(null);
    const now = new Date();
    const tehranTime = new Date(now.getTime() + (3.5 * 60 + now.getTimezoneOffset()) * 60 * 1000);
    tehranTime.setDate(tehranTime.getDate() + offsetDays);
    const y = tehranTime.getFullYear();
    const m = String(tehranTime.getMonth() + 1).padStart(2, '0');
    const d = String(tehranTime.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  }

  // If not logged in, show Login Screen
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 className="text-lg font-bold text-stone-900">ورود به پنل مدیریت آرایشگاه</h2>
          <button
            type="button"
            onClick={onBackToBooking}
            className="text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            ← بازگشت به رزرو
          </button>
        </div>

        {loginError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">نام کاربری</label>
            <input
              type="text"
              required
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              placeholder="admin"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">رمز عبور</label>
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full cursor-pointer rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {isLoggingIn ? 'در حال ورود…' : 'ورود به پنل'}
          </button>
        </form>
      </div>
    );
  }

  // Summary counts
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const cancelledCount = appointments.filter((a) => a.status === 'CANCELLED').length;

  return (
    <div className="space-y-5">
      {/* Top Bar: Title & User Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">مدیریت نوبت‌های آرایشگاه</h2>
          <p className="text-xs text-stone-500">
            مدیر: <span className="font-semibold text-stone-700">{username}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToBooking}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            صفحه رزرو مشتریان
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-300"
          >
            خروج
          </button>
        </div>
      </div>

      {/* 1. Date Selection Controls */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-stone-800">انتخاب روز:</label>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => changeDateOffset(0)}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                selectedDate === todayTehran
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-700 hover:bg-stone-200'
              }`}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => changeDateOffset(1)}
              className="rounded-lg bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-200"
            >
              فردا
            </button>
            <button
              type="button"
              onClick={() => changeDateOffset(2)}
              className="rounded-lg bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-200"
            >
              پس‌فردا
            </button>
          </div>
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSuccessMessage(null);
          }}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-stone-900 focus:outline-none"
        />

        {/* Quick summary badges */}
        <div className="flex items-center gap-3 pt-1 text-xs text-stone-600">
          <span>کل نوبت‌ها: <strong>{appointments.length}</strong></span>
          <span className="text-emerald-700 font-medium">فعال: <strong>{confirmedCount}</strong></span>
          <span className="text-stone-500">لغوشده: <strong>{cancelledCount}</strong></span>
        </div>
      </div>

      {/* Load Error */}
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {loadError}
        </div>
      )}

      {/* پیام موفقیت لغو نوبت */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs">
              ✓
            </span>
            <span className="font-semibold text-sm">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="cursor-pointer text-emerald-700 hover:text-emerald-950 px-1 font-bold text-xs"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Appointments List */}
      <div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-stone-500">
            در حال دریافت نوبت‌ها…
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-xs text-stone-500">
            هیچ نوبتی برای تاریخ {selectedDate} ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2.5">
            {appointments.map((appt) => {
              const isConfirmed = appt.status === 'CONFIRMED';
              const isCancelled = appt.status === 'CANCELLED';
              const isCompleted = appt.status === 'COMPLETED';

              return (
                <div
                  key={appt.id}
                  className={`rounded-xl border p-3.5 transition ${
                    isCancelled
                      ? 'border-stone-200 bg-stone-100 opacity-60'
                      : 'border-stone-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    {/* Time & Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-stone-900">
                        {appt.startTime} تا {appt.endTime}
                      </span>
                      {isConfirmed && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          فعال
                        </span>
                      )}
                      {isCancelled && (
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                          لغوشده
                        </span>
                      )}
                      {isCompleted && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          انجام‌شده
                        </span>
                      )}
                    </div>

                    {/* Tracking Code */}
                    <span className="font-mono text-xs text-stone-400">
                      کد: {appt.trackingCode}
                    </span>
                  </div>

                  {/* Customer & Service Info */}
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-stone-500">مشتری: </span>
                      <span className="font-semibold text-stone-900">{appt.customerName}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">شماره موبایل: </span>
                      <span className="font-mono font-medium text-stone-800" dir="ltr">{appt.phone}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-stone-500">خدمت: </span>
                      <span className="font-medium text-stone-800">{appt.serviceName}</span>
                      <span className="text-stone-400 mr-1.5">({appt.durationMinutes} دقیقه)</span>
                    </div>
                  </div>

                  {/* 3. Action Buttons */}
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-stone-100 pt-2.5">
                    {isConfirmed && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuccessMessage(null);
                          setCancelError(null);
                          setAppointmentToCancel(appt);
                        }}
                        className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        لغو نوبت
                      </button>
                    )}

                    {isCancelled && (
                      <span className="text-[11px] text-stone-500">
                        لغو شده (بازه آزاد است)
                      </span>
                    )}

                    {isCompleted && (
                      <span className="text-[11px] text-stone-500">
                        تکمیل‌شده (غیرقابل لغو)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Cancellation */}
      {appointmentToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-sm">
                !
              </span>
              <h3 className="text-base font-bold text-stone-900">تأیید لغو نوبت</h3>
            </div>

            <p className="text-sm font-semibold text-stone-900 leading-relaxed">
              آیا مطمئن هستید که می‌خواهید این نوبت را لغو کنید؟
            </p>

            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1.5 text-xs text-stone-700">
              <div className="flex justify-between">
                <span className="text-stone-500">نام مشتری:</span>
                <span className="font-semibold text-stone-900">{appointmentToCancel.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ساعت نوبت:</span>
                <span className="font-mono font-medium text-stone-900">{appointmentToCancel.startTime} تا {appointmentToCancel.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">خدمت:</span>
                <span className="font-medium text-stone-900">{appointmentToCancel.serviceName}</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 leading-relaxed">
              طبق قانون R4، نوبت از دیتابیس حذف فیزیکی نمی‌شود و به وضعیت «لغوشده» تغییر می‌یابد. این بازه زمانی مجدداً برای رزرو آزاد خواهد شد.
            </div>

            {cancelError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium">
                {cancelError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmCancel}
                disabled={isCancelling}
                className="flex-1 cursor-pointer rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCancelling ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>در حال لغو نوبت…</span>
                  </>
                ) : (
                  'بله، لغو نوبت'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isCancelling) return;
                  setAppointmentToCancel(null);
                  setCancelError(null);
                }}
                disabled={isCancelling}
                className="flex-1 cursor-pointer rounded-xl border border-stone-300 bg-white py-2.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
