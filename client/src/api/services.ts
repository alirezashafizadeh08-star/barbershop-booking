import type { ServicesResponse } from '../types/service.ts';

export async function fetchServices(signal?: AbortSignal): Promise<ServicesResponse> {
  const response = await fetch('/api/services', { signal });

  if (!response.ok) {
    throw new Error(`خطا در دریافت خدمات (${String(response.status)})`);
  }

  return response.json() as Promise<ServicesResponse>;
}
