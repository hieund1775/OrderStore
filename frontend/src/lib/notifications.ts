import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiDelete, getCustomerToken, getCustomerUser } from './api';
import { getCustomerSession } from './customer-session';

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

const inFlightCustomerNotifications = new Map<string, Promise<NotificationResponse>>();
const inFlightAdminNotifications = new Map<number, Promise<NotificationResponse>>();

export function clearCustomerNotificationsInFlight(userId?: number) {
  if (typeof userId === 'number') {
    for (const key of inFlightCustomerNotifications.keys()) {
      if (key.startsWith(`${userId}:`)) {
        inFlightCustomerNotifications.delete(key);
      }
    }
  } else {
    inFlightCustomerNotifications.clear();
  }
}

export type PaginatedCustomerNotificationResponse = {
  items: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
  unread_count: number;
};

export type CustomerNotificationsOptions = {
  page?: number;
  limit?: number;
};

export async function fetchCustomerNotifications(
  userId: number,
  limitOrOptions: number | CustomerNotificationsOptions = 50
): Promise<NotificationResponse | PaginatedCustomerNotificationResponse> {
  const isOptions = typeof limitOrOptions === 'object' && limitOrOptions !== null;
  const isPaginated = isOptions && limitOrOptions.page != null;

  if (isPaginated) {
    const page = limitOrOptions.page ?? 1;
    const limit = limitOrOptions.limit ?? 10;
    const res = await apiGet<PaginatedCustomerNotificationResponse>(
      `/api/users/${userId}/notifications?page=${page}&limit=${limit}`
    );
    return {
      items: Array.isArray(res?.items) ? res.items : [],
      pagination: res?.pagination || {
        page,
        limit,
        total_items: 0,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      },
      unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
    };
  }

  const limit = typeof limitOrOptions === 'number' ? limitOrOptions : (limitOrOptions?.limit ?? 50);
  const cacheKey = `${userId}:${limit}`;
  const existing = inFlightCustomerNotifications.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await apiGet<NotificationResponse | AppNotification[]>(`/api/users/${userId}/notifications?limit=${limit}`);
      const currentSession = getCustomerSession();
      if (currentSession && currentSession.userId !== userId) {
        return { notifications: [], unread_count: 0 };
      }
      if (Array.isArray(res)) return { notifications: res, unread_count: res.filter((n) => !n.is_read).length };
      return {
        notifications: Array.isArray(res?.notifications) ? res.notifications : [],
        unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
      };
    } finally {
      inFlightCustomerNotifications.delete(cacheKey);
    }
  })();

  inFlightCustomerNotifications.set(cacheKey, promise);
  return promise;
}

export const markCustomerNotificationRead = (userId: number, notificationId: number) =>
  apiPatch<{ ok: boolean }>(`/api/users/${userId}/notifications/${notificationId}/read`, {});
export const markAllCustomerNotificationsRead = (userId: number) =>
  apiPost<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications/read-all`, {});
export const clearAllCustomerNotifications = (userId: number) =>
  apiDelete<{ ok: boolean; count: number }>(`/api/users/${userId}/notifications`);

export type AdminNotificationsOptions = {
  page?: number;
  limit?: number;
  type?: string;
};

export type PaginatedAdminNotificationResponse = {
  items: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
  unread_count: number;
};

export async function fetchAdminNotifications(limitOrOptions: number | AdminNotificationsOptions = 100): Promise<NotificationResponse | PaginatedAdminNotificationResponse> {
  const isOptions = typeof limitOrOptions === 'object' && limitOrOptions !== null;
  const isPaginated = isOptions && limitOrOptions.page != null;

  if (isPaginated) {
    const page = limitOrOptions.page ?? 1;
    const limit = limitOrOptions.limit ?? 10;
    const type = limitOrOptions.type && limitOrOptions.type !== 'all' ? `&type=${encodeURIComponent(limitOrOptions.type)}` : '';
    const res = await apiGet<PaginatedAdminNotificationResponse>(`/admin/notifications?page=${page}&limit=${limit}${type}`);
    return {
      items: Array.isArray(res?.items) ? res.items : [],
      pagination: res?.pagination || { page, limit, total_items: 0, total_pages: 1, has_prev: false, has_next: false },
      unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
    };
  }

  const limit = typeof limitOrOptions === 'number' ? limitOrOptions : (limitOrOptions?.limit ?? 100);
  const existing = inFlightAdminNotifications.get(limit);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await apiGet<NotificationResponse | AppNotification[]>(`/admin/notifications?limit=${limit}&envelope=true`);
      if (Array.isArray(res)) return { notifications: res, unread_count: res.filter((n) => !n.is_read).length };
      return {
        notifications: Array.isArray(res?.notifications) ? res.notifications : [],
        unread_count: typeof res?.unread_count === 'number' ? res.unread_count : 0,
      };
    } finally {
      inFlightAdminNotifications.delete(limit);
    }
  })();

  inFlightAdminNotifications.set(limit, promise);
  return promise;
}

export const markAdminNotificationRead = (notificationId: number) =>
  apiPatch<{ ok: boolean }>(`/admin/notifications/${notificationId}/read`, {});
export const markAllAdminNotificationsRead = () =>
  apiPost<{ ok: boolean; count: number }>(`/admin/notifications/read-all`, {});
export const clearAllAdminNotifications = () =>
  apiDelete<{ ok: boolean; count: number }>(`/admin/notifications`);

function readCustomerIdentity(): CustomerIdentity {
  const session = getCustomerSession();
  if (!session) return { token: null, user: null };
  return { token: session.token, user: getCustomerUser() };
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

export function useCustomerNotifications(options?: CustomerNotificationsOptions) {
  const queryClient = useQueryClient();
  const { token, user } = useCustomerIdentity();
  const userId = Number(user?.id) || null;
  const previousUserId = useRef<number | null>(null);

  const isPaginated = options?.page != null;
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 10;

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) {
      void queryClient.cancelQueries({ queryKey: ['account-notifications', previous] });
      queryClient.removeQueries({ queryKey: ['account-notifications', previous] });
      clearCustomerNotificationsInFlight(previous);
    }
    if (!userId) {
      void queryClient.cancelQueries({ queryKey: ['account-notifications', 'signed-out'] });
      queryClient.removeQueries({ queryKey: ['account-notifications', 'signed-out'] });
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  const queryKey = userId
    ? isPaginated
      ? (['account-notifications', userId, page, limit] as const)
      : (['account-notifications', userId] as const)
    : (['account-notifications', 'signed-out'] as const);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchCustomerNotifications(userId as number, isPaginated ? { page, limit } : 50),
    enabled: Boolean(token && userId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

  const invalidateUserQueries = () => {
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: ['account-notifications', userId] });
    }
  };

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
      invalidateUserQueries();
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
      invalidateUserQueries();
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
      invalidateUserQueries();
    },
  });

  const isGuest = !token || !userId;
  const paginatedData = isPaginated && !isGuest ? (query.data as PaginatedCustomerNotificationResponse | undefined) : undefined;
  const standardData = !isPaginated && !isGuest ? (query.data as NotificationResponse | undefined) : undefined;

  const notifications = isGuest
    ? []
    : isPaginated
      ? (paginatedData?.items ?? [])
      : (standardData?.notifications ?? []);

  const unreadCount = isGuest
    ? 0
    : isPaginated
      ? (paginatedData?.unread_count ?? 0)
      : (standardData?.unread_count ?? 0);

  const pagination = paginatedData?.pagination;

  return {
    ...query,
    data: isGuest ? { notifications: [], unread_count: 0 } : query.data,
    notifications,
    unreadCount,
    pagination,
    token: isGuest ? null : token,
    user: isGuest ? null : user,
    userId: isGuest ? null : userId,
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

export function useAdminNotifications(options?: AdminNotificationsOptions) {
  const queryClient = useQueryClient();
  const isPaginated = options?.page != null;
  const queryKey = isPaginated
    ? (['admin-notifications', options.page, options.limit ?? 10, options.type ?? 'all'] as const)
    : adminNotificationsKey;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminNotifications(options ?? 100),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAdminNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['admin-notifications'] });
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
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAdminNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['admin-notifications'] });
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
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const clearMutation = useMutation({
    mutationFn: clearAllAdminNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['admin-notifications'] });
      const previous = queryClient.getQueryData<NotificationResponse>(adminNotificationsKey);
      queryClient.setQueryData<NotificationResponse>(adminNotificationsKey, { notifications: [], unread_count: 0 });
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(adminNotificationsKey, previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  return {
    ...query,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllMutation.mutateAsync,
    clearAll: clearMutation.mutateAsync,
    isMutating: markReadMutation.isPending || markAllMutation.isPending || clearMutation.isPending,
  };
}
