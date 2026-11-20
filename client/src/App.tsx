import { useEffect, useState } from 'react';
import { fetchServices } from './api/services.ts';
import { BookingForm } from './components/BookingForm.tsx';
import type { Service } from './types/service.ts';

type FetchState = 'loading' | 'success' | 'error';

function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [state, setState] = useState<FetchState>('loading');

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-3 sm:p-5 text-stone-800">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <header className="mb-5 text-center">
          <h1 className="text-xl font-bold sm:text-2xl text-stone-900">
            نوبت‌دهی آنلاین آرایشگاه
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۰:۰۰ · پرداخت فقط حضوری
          </p>
        </header>

        {state === 'loading' && (
          <div className="py-12 text-center text-sm text-stone-500">
            در حال دریافت اطلاعات خدمات…
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            دریافت خدمات با خطا مواجه شد. لطفاً صفحه را دوباره بارگذاری کنید.
          </div>
        )}

        {state === 'success' && services.length === 0 && (
          <div className="py-8 text-center text-sm text-stone-500">
            خدمتی برای نمایش وجود ندارد.
          </div>
        )}

        {state === 'success' && services.length > 0 && (
          <BookingForm services={services} />
        )}
      </section>
    </main>
  );
}

export default App;
