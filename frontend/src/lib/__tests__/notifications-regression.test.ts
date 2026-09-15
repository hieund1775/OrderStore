import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCustomerNotifications,
  fetchAdminNotifications,
} from '../notifications';
import * as apiModule from '../api';

describe('Notification Backward Compatibility & Pagination Regression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('customer legacy ?limit=50 returns { notifications, unread_count } for Header bell dropdown', async () => {
    const mockLegacyResponse = {
      notifications: [
        {
          id: 1,
          user_id: 10,
          type: 'order',
          title: 'Đơn hàng #TP123 đã hoàn tất',
          body: 'Cảm ơn bạn đã mua hàng',
          is_read: false,
          link: '/theo-doi-don?code=TP123',
          created_at: new Date().toISOString(),
        },
      ],
      unread_count: 1,
    };

    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce(mockLegacyResponse);

    const result = await fetchCustomerNotifications(10, 50);

    expect(apiGetSpy).toHaveBeenCalled();
    const calledUrl = String(apiGetSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/api/users/10/notifications?limit=50');
    expect(calledUrl).not.toContain('page=');

    // Header bell consumes result.notifications and result.unread_count
    expect('notifications' in result).toBe(true);
    if ('notifications' in result) {
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].title).toBe('Đơn hàng #TP123 đã hoàn tất');
      expect(result.unread_count).toBe(1);
    }
  });

  it('admin legacy ?limit=100&envelope=true returns { notifications, unread_count } for AdminTopbar', async () => {
    const mockAdminLegacyResponse = {
      notifications: [
        {
          id: 99,
          user_id: 1,
          type: 'system',
          title: 'Kho nguyên liệu sắp hết',
          body: 'Trà ô long còn dưới 5kg',
          is_read: false,
          link: '/admin/kho',
          created_at: new Date().toISOString(),
        },
      ],
      unread_count: 1,
    };

    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce(mockAdminLegacyResponse);

    const result = await fetchAdminNotifications(100);

    expect(apiGetSpy).toHaveBeenCalled();
    const calledUrl = String(apiGetSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/admin/notifications?limit=100&envelope=true');
    expect(calledUrl).not.toContain('page=');

    // AdminTopbar consumes result.notifications and result.unread_count
    expect('notifications' in result).toBe(true);
    if ('notifications' in result) {
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].title).toBe('Kho nguyên liệu sắp hết');
      expect(result.unread_count).toBe(1);
    }
  });

  it('customer ?page=1&limit=10 returns paginated { items, pagination, unread_count }', async () => {
    const mockPaginatedResponse = {
      items: [
        {
          id: 5,
          user_id: 10,
          type: 'voucher',
          title: 'Bạn nhận được voucher 20%',
          body: 'Áp dụng cho đơn từ 100k',
          is_read: true,
          link: '/khuyen-mai',
          created_at: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total_items: 15,
        total_pages: 2,
        has_prev: false,
        has_next: true,
      },
      unread_count: 0,
    };

    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce(mockPaginatedResponse);

    const result = await fetchCustomerNotifications(10, { page: 1, limit: 10 });

    expect(apiGetSpy).toHaveBeenCalled();
    const calledUrl = String(apiGetSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/api/users/10/notifications?page=1&limit=10');

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(1);
      expect(result.pagination.total_pages).toBe(2);
      expect(result.pagination.has_next).toBe(true);
      expect(result.unread_count).toBe(0);
    }
  });

  it('admin ?page=1&limit=10 returns paginated { items, pagination, unread_count }', async () => {
    const mockAdminPaginated = {
      items: [
        {
          id: 101,
          user_id: 1,
          type: 'order',
          title: 'Đơn mới #TP9999',
          body: 'Đơn giao hàng mới',
          is_read: false,
          link: '/admin/don-hang',
          created_at: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total_items: 45,
        total_pages: 5,
        has_prev: false,
        has_next: true,
      },
      unread_count: 3,
    };

    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce(mockAdminPaginated);

    const result = await fetchAdminNotifications({ page: 1, limit: 10 });

    expect(apiGetSpy).toHaveBeenCalled();
    const calledUrl = String(apiGetSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/admin/notifications?page=1&limit=10');

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(1);
      expect(result.pagination.total_pages).toBe(5);
      expect(result.pagination.has_next).toBe(true);
      expect(result.unread_count).toBe(3);
    }
  });
});
