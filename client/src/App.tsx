import { useEffect, useState } from 'react';
import { fetchServices } from './api/services.ts';
import { BookingForm } from './components/BookingForm.tsx';
import { AdminAppointments } from './components/AdminAppointments.tsx';
import type { Service } from './types/service.ts';

type FetchState = 'loading' | 'success' | 'error';
type ViewMode = 'booking' | 'admin';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
        return 'admin';
      }
    }
    return 'booking';
  });

  const [services, setServices] = useState<Service[]>([]);
  const [state, setState] = useState<FetchState>('loading');

  // Handle URL change / back button
  useEffect(() => {
    function handlePopState() {
      if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
        setViewMode('admin');
      } else {
        setViewMode('booking');
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchServices(controller.signal)
      .then((data) => {
        setServices(data.services);
        setState('success');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
      });

    return () => controller.abort();
  }, []);

  function navigateTo(mode: ViewMode) {
    setViewMode(mode);
    if (mode === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else {
      window.history.pushState({}, '', '/');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-2.5 sm:p-5 text-stone-800">
      <section
        className={`w-full rounded-2xl bg-white p-4 sm:p-7 shadow-xs sm:shadow-sm border border-stone-100 transition-all ${
          viewMode === 'admin' ? 'max-w-xl md:max-w-2xl' : 'max-w-lg'
        }`}
      >
        {viewMode === 'admin' ? (
          <AdminAppointments onBackToBooking={() => navigateTo('booking')} />
        ) : (
          <>
            <header className="mb-5 text-center relative">
              <div className="flex justify-end pb-1">
                <button
                  type="button"
                  onClick={() => navigateTo('admin')}
                  className="cursor-pointer text-[11px] font-medium text-stone-500 hover:text-stone-900 transition flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-stone-100"
                >
                  <span>⚙</span>
                  <span>ورود مدیریت</span>
                </button>
              </div>
              <h1 className="text-xl font-bold sm:text-2xl text-stone-900 tracking-tight">
                نوبت‌دهی آنلاین آرایشگاه مردانه
              </h1>
              <p className="mt-1 text-xs text-stone-500">
                شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰ · پرداخت فقط حضوری
              </p>
            </header>

            {state === 'loading' && (
              <div className="py-12 text-center text-sm text-stone-500 flex flex-col items-center justify-center gap-2">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-800 border-t-transparent" />
                <span>در حال دریافت اطلاعات خدمات…</span>
              </div>
            )}

            {state === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs sm:text-sm text-red-700">
                دریافت خدمات با خطا مواجه شد. لطفاً صفحه را دوباره بارگذاری کنید.
              </div>
            )}

            {state === 'success' && services.length === 0 && (
              <div className="py-8 text-center text-xs sm:text-sm text-stone-500">
                خدمتی برای نمایش وجود ندارد.
              </div>
            )}

            {state === 'success' && services.length > 0 && (
              <BookingForm services={services} />
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
