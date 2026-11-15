import { useEffect, useState } from 'react';
import { fetchServices } from './api/services.ts';
import type { Service } from './types/service.ts';

type FetchState = 'loading' | 'success' | 'error';

function formatPrice(priceToman: number): string {
  return priceToman.toLocaleString('fa-IR') + ' تومان';
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${String(hours)} ساعت`;
  return `${String(hours)} ساعت و ${String(remainder)} دقیقه`;
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-semibold text-stone-800">{service.name}</p>
        <p className="mt-0.5 text-sm text-stone-500">{formatDuration(service.durationMinutes)}</p>
      </div>
      <span className="shrink-0 text-sm font-medium text-emerald-700">
        {formatPrice(service.priceToman)}
      </span>
    </li>
  );
}

// Temporary page for T1.5: displays the service catalog fetched from the API.
// Booking flow and admin panel are implemented in later roadmap tasks.
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
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4 text-stone-800">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-center text-2xl font-bold sm:text-3xl">
          نوبت‌دهی آنلاین آرایشگاه
        </h1>
        <p className="mb-6 text-center text-sm text-stone-500">
          پرداخت فقط به‌صورت حضوری انجام می‌شود.
        </p>

        {state === 'loading' && (
          <p className="text-center text-sm text-stone-500">در حال دریافت خدمات…</p>
        )}

        {state === 'error' && (
          <p className="text-center text-sm text-red-700">
            دریافت خدمات با خطا مواجه شد. لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
        )}

        {state === 'success' && services.length === 0 && (
          <p className="text-center text-sm text-stone-500">خدمتی برای نمایش وجود ندارد.</p>
        )}

        {state === 'success' && services.length > 0 && (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">
              خدمات
            </h2>
            <ul className="space-y-2">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
