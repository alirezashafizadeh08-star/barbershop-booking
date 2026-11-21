export interface AdminAppointmentItem {
  id: string;
  trackingCode: string;
  customerName: string;
  phone: string;
  serviceName: string;
  durationMinutes: number;
  priceToman: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  cancelledAt: string | null;
  createdAt: string;
}

export interface AdminAppointmentsResponse {
  date: string;
  summary: {
    total: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  appointments: AdminAppointmentItem[];
}

export interface LoginResponse {
  token: string;
  username: string;
}

const STORAGE_KEY = 'barbershop_admin_token';
const USERNAME_KEY = 'barbershop_admin_username';

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredAdminUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminSession(token: string, username: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredAdminSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const body = (await response.json()) as { message?: string } & Partial<LoginResponse>;

  if (!response.ok) {
    throw new Error(body.message || 'خطا در ورود به پنل مدیریت.');
  }

  if (!body.token || !body.username) {
    throw new Error('پاسخ نامعتبر از سرور دریافت شد.');
  }

  setStoredAdminSession(body.token, body.username);
  return { token: body.token, username: body.username };
}

export async function fetchAdminAppointments(
  date: string,
  token: string,
): Promise<AdminAppointmentsResponse> {
  const url = date ? `/api/admin/appointments?date=${encodeURIComponent(date)}` : '/api/admin/appointments';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = (await response.json()) as { message?: string } & Partial<AdminAppointmentsResponse>;

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAdminSession();
    }
    throw new Error(body.message || `خطا در دریافت نوبت‌ها (${response.status})`);
  }

  return body as AdminAppointmentsResponse;
}

export async function cancelAdminAppointment(
  appointmentId: string,
  token: string,
): Promise<void> {
  const response = await fetch(`/api/admin/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = (await response.json()) as { message?: string };

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAdminSession();
    }
    throw new Error(body.message || `خطا در لغو نوبت (${response.status})`);
  }
}
