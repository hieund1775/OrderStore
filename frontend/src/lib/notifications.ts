import { apiGet, apiPatch, apiPost, apiDelete } from './api';

export type AppNotification = {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export type NotificationResponse = {
  notifications: AppNotification[];
  unread_count: number;
};

export function isSafeInternalLink(link: string | null | undefined): boolean {
  if (!link) return false;
  const str = String(link).trim();
  return str.startsWith('/') && !str.startsWith('//');
}

export async function fetchCustomerNotifications(userId: number, limit = 50): Promise<NotificationResponse> {
  const res = await apiGet<NotificationResponse | AppNotification[]>(`/api/users/${userId}/notifications?limit=${limit}`);
  if (Array.isArray(res)) {
    const unread = res.filter((n) => !n.is_read).length;
    return { notifications: res, unread_count: unread };
  }
  return {
    notifications: Array.isArray(res?.notifications) ? res.notifications : [],
    unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
  };
}

export async function markCustomerNotificationRead(userId: number, notificationId: number): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/api/users/${userId}/notifications/${notificationId}/read`, {});
}

export async function markAllCustomerNotificationsRead(userId: number): Promise<{ ok: boolean; count: number }> {
  return apiPost<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications/read-all`, {});
}

export async function clearAllCustomerNotifications(userId: number): Promise<{ ok: boolean; count: number }> {
  return apiDelete<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications`);
}

export async function fetchAdminNotifications(limit = 50): Promise<AppNotification[]> {
  const res = await apiGet<AppNotification[] | { notifications: AppNotification[] }>(`/admin/notifications?limit=${limit}`);
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.notifications) ? res.notifications : [];
}

export async function markAdminNotificationRead(notificationId: number): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/admin/notifications/${notificationId}/read`, {});
}

export async function markAllAdminNotificationsRead(): Promise<{ ok: boolean; count: number }> {
  return apiPost<{ ok: boolean; count: number }>(`/admin/notifications/read-all`, {});
}

export async function clearAllAdminNotifications(): Promise<{ ok: boolean; count: number }> {
  return apiDelete<{ ok: boolean; count: number }>(`/admin/notifications`);
}
