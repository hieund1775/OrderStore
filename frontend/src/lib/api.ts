const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'teaplus_admin_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem('admin_user');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('admin_user');
  if (stored) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

export function setUser(u: { id: number; fullname: string; phone: string; role: string; branch_id: number | null } | null) {
  if (u) {
    window.localStorage.setItem('admin_user', JSON.stringify(u));
  } else {
    window.localStorage.removeItem('admin_user');
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && path !== "/admin/login" && typeof window !== "undefined") {
      clearToken();
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    const message = data?.error || data?.message || `Lỗi ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

export async function login(phone: string, password: string) {
  const data = await apiPost<{ token: string; user: { id: number; fullname: string; phone: string; role: string; branch_id: number | null } }>('/admin/login', { phone, password });
  if (data.token) {
    setToken(data.token);
    setUser(data.user);
  }
  return data;
}

export function logout() {
  clearToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
}