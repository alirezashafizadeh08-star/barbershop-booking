import type { BookingFormData } from '../types/booking.ts';

export interface ConfirmedServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  priceToman: number;
}

export interface AppointmentConfirmation {
  id: string;
  trackingCode: string;
  customerName: string;
  phone: string;
  serviceName: string;
  services: ConfirmedServiceItem[];
  durationMinutes: number;
  priceToman: number;
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  status: string;
  createdAt: string;
}

export async function submitBooking(
  data: BookingFormData,
  signal?: AbortSignal,
): Promise<AppointmentConfirmation> {
  let response: Response;

  try {
    response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal,
    });
  } catch (networkErr) {
    if (networkErr instanceof DOMException && networkErr.name === 'AbortError') {
      throw networkErr;
    }
    throw new Error('خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
  }

  // Safe JSON parsing: some error responses may have an empty or non-JSON body
  let body: ({ message?: string } & Partial<AppointmentConfirmation>) | null = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const text = await response.text();
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text) as { message?: string } & Partial<AppointmentConfirmation>;
      } catch {
        // body stays null — handled below
      }
    }
  }

  if (!response.ok) {
    const message = body?.message ?? `خطا در ثبت نوبت (${response.status.toString()})`;
    throw new Error(message);
  }

  if (!body) {
    throw new Error('پاسخ نامعتبر از سرور دریافت شد. لطفاً دوباره تلاش کنید.');
  }

  return body as AppointmentConfirmation;
}
