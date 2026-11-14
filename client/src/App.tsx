import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'online' | 'offline';

const API_STATUS_LABELS: Record<ApiStatus, string> = {
  checking: 'در حال بررسی اتصال به سرور…',
  online: 'اتصال به سرور برقرار است.',
  offline: 'اتصال به سرور برقرار نیست.',
};

// Temporary skeleton page (T1.4). Real pages are implemented in later roadmap tasks.
function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((response) => setApiStatus(response.ok ? 'online' : 'offline'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setApiStatus('offline');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4 text-stone-800">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="mb-3 text-2xl font-bold sm:text-3xl">نوبت‌دهی آنلاین آرایشگاه</h1>
        <p className="mb-6 text-stone-600">این سامانه در حال راه‌اندازی است.</p>
        <p
          className={
            apiStatus === 'online'
              ? 'text-sm text-emerald-700'
              : apiStatus === 'offline'
                ? 'text-sm text-red-700'
                : 'text-sm text-stone-500'
          }
        >
          {API_STATUS_LABELS[apiStatus]}
        </p>
      </section>
    </main>
  );
}

export default App;
