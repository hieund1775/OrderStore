import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiDelete, getCustomerToken, getCustomerUser } from './api';

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

type CustomerIdentity = {
  token: string | null;
  user: ReturnType<typeof getCustomerUser>;
};

export const customerNotificationsKey = (userId: number) => ['account-notifications', userId] as const;
export const adminNotificationsKey = ['admin-notifications'] as const;

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function isSafeInternalLink(link: string | null | undefined): boolean {
  if (!link) return false;
  const str = String(link).trim();
  return str.startsWith('/')
    && !str.startsWith('//')
    && !str.includes('\\')
    && !hasControlCharacters(str);
}

export async function fetchCustomerNotifications(userId: number, limit = 50): Promise<NotificationResponse> {
  const res = await apiGet<NotificationResponse | AppNotification[]>(`/api/users/${userId}/notifications?limit=${limit}`);
  if (Array.isArray(res)) return { notifications: res, unread_count: res.filter((n) => !n.is_read).length };
  return {
    notifications: Array.isArray(res?.notifications) ? res.notifications : [],
    unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
  };
}

export const markCustomerNotificationRead = (userId: number, notificationId: number) =>
  apiPatch<{ ok: boolean }>(`/api/users/${userId}/notifications/${notificationId}/read`, {});
export const markAllCustomerNotificationsRead = (userId: number) =>
  apiPost<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications/read-all`, {});
export const clearAllCustomerNotifications = (userId: number) =>
  apiDelete<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications`);

export async function fetchAdminNotifications(limit = 100): Promise<NotificationResponse> {
  const res = await apiGet<NotificationResponse | AppNotification[]>(`/admin/notifications?limit=${limit}&envelope=true`);
  if (Array.isArray(res)) return { notifications: res, unread_count: res.filter((n) => !n.is_read).length };
  return {
    notifications: Array.isArray(res?.notifications) ? res.notifications : [],
    unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
  };
}

export const markAdminNotificationRead = (notificationId: number) =>
  apiPatch<{ ok: boolean }>(`/admin/notifications/${notificationId}/read`, {});
export const markAllAdminNotificationsRead = () =>
  apiPost<{ ok: boolean; count: number }>(`/admin/notifications/read-all`, {});
export const clearAllAdminNotifications = () =>
  apiDelete<{ ok: boolean; count: number }>(`/admin/notifications`);

function readCustomerIdentity(): CustomerIdentity {
  return { token: getCustomerToken(), user: getCustomerUser() };
}

export function useCustomerIdentity() {
  const [identity, setIdentity] = useState<CustomerIdentity>(readCustomerIdentity);
  useEffect(() => {
    const refresh = () => setIdentity(readCustomerIdentity());
    window.addEventListener('teaplus:customer-auth-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('teaplus:customer-auth-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return identity;
}

function updateCustomerData(client: QueryClient, userId: number, update: (current: NotificationResponse) => NotificationResponse) {
  client.setQueryData<NotificationResponse>(customerNotificationsKey(userId), (current) =>
    update(current ?? { notifications: [], unread_count: 0 }));
}

export function useCustomerNotifications() {
  const queryClient = useQueryClient();
  const { token, user } = useCustomerIdentity();
  const userId = Number(user?.id) || null;
  const previousUserId = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: customerNotificationsKey(previous), exact: true });
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  const query = useQuery({
    queryKey: userId ? customerNotificationsKey(userId) : ['account-notifications', 'signed-out'],
    queryFn: () => fetchCustomerNotifications(userId as number, 50),
    enabled: Boolean(token && userId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: number) => markCustomerNotificationRead(userId as number, notificationId),
    onMutate: async (notificationId) => {
      if (!userId) return undefined;
      const key = customerNotificationsKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationResponse>(key);
      updateCustomerData(queryClient, userId, (current) => {
        const target = current.notifications.find((item) => item.id === notificationId);
        return {
          notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, is_read: true } : item),
          unread_count: target && !target.is_read ? Math.max(0, current.unread_count - 1) : current.unread_count,
        };
      });
      return previous;
    },
    onError: (_error, _id, previous) => {
      if (userId && previous) queryClient.setQueryData(customerNotificationsKey(userId), previous);
    },
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: customerNotificationsKey(userId) });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllCustomerNotificationsRead(userId as number),
    onMutate: async () => {
      if (!userId) return undefined;
      const key = customerNotificationsKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationResponse>(key);
      updateCustomerData(queryClient, userId, (current) => ({
        notifications: current.notifications.map((item) => ({ ...item, is_read: true })),
        unread_count: 0,
      }));
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (userId && previous) queryClient.setQueryData(customerNotificationsKey(userId), previous);
    },
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: customerNotificationsKey(userId) });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAllCustomerNotifications(userId as number),
    onMutate: async () => {
      if (!userId) return undefined;
      const key = customerNotificationsKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationResponse>(key);
      queryClient.setQueryData<NotificationResponse>(key, { notifications: [], unread_count: 0 });
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (userId && previous) queryClient.setQueryData(customerNotificationsKey(userId), previous);
    },
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: customerNotificationsKey(userId) });
    },
  });

  return {
    ...query,
    token,
    user,
    userId,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllMutation.mutateAsync,
    clearAll: clearMutation.mutateAsync,
    isMutating: markReadMutation.isPending || markAllMutation.isPending || clearMutation.isPending,
  };
}

function updateAdminData(client: QueryClient, update: (current: NotificationResponse) => NotificationResponse) {
  client.setQueryData<NotificationResponse>(adminNotificationsKey, (current) =>
    update(current ?? { notifications: [], unread_count: 0 }));
}

export function useAdminNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: adminNotificationsKey,
    queryFn: () => fetchAdminNotifications(100),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAdminNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: adminNotificationsKey });
      const previous = queryClient.getQueryData<NotificationResponse>(adminNotificationsKey);
      updateAdminData(queryClient, (current) => {
        const target = current.notifications.find((item) => item.id === notificationId);
        return {
          notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, is_read: true } : item),
          unread_count: target && !target.is_read ? Math.max(0, current.unread_count - 1) : current.unread_count,
        };
      });
      return previous;
    },
    onError: (_error, _id, previous) => {
      if (previous) queryClient.setQueryData(adminNotificationsKey, previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminNotificationsKey }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAdminNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: adminNotificationsKey });
      const previous = queryClient.getQueryData<NotificationResponse>(adminNotificationsKey);
      updateAdminData(queryClient, (current) => ({
        notifications: current.notifications.map((item) => ({ ...item, is_read: true })),
        unread_count: 0,
      }));
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(adminNotificationsKey, previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminNotificationsKey }),
  });

  const clearMutation = useMutation({
    mutationFn: clearAllAdminNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: adminNotificationsKey });
      const previous = queryClient.getQueryData<NotificationResponse>(adminNotificationsKey);
      queryClient.setQueryData<NotificationResponse>(adminNotificationsKey, { notifications: [], unread_count: 0 });
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(adminNotificationsKey, previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminNotificationsKey }),
  });

  return {
    ...query,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllMutation.mutateAsync,
    clearAll: clearMutation.mutateAsync,
    isMutating: markReadMutation.isPending || markAllMutation.isPending || clearMutation.isPending,
  };
}
