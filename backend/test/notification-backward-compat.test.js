import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationService } from '../services/notifications/notification-service.js';
import { buildOffsetPagination } from '../services/offset-pagination.js';

describe('Notification Backward Compatibility Contract', () => {
  const mockNotifications = [
    { id: 1, user_id: 10, title: 'Đơn hàng thành công', is_read: false, created_at: new Date().toISOString() },
    { id: 2, user_id: 10, title: 'Khuyến mãi mới', is_read: true, created_at: new Date().toISOString() },
  ];

  const mockRepo = {
    async countUnreadForUser(userId) {
      return 1;
    },
    async listForUser(userId, optionsOrLimit) {
      if (typeof optionsOrLimit === 'object' && optionsOrLimit !== null && optionsOrLimit.page != null) {
        return {
          items: mockNotifications.slice(0, optionsOrLimit.limit || 10),
          totalItems: mockNotifications.length,
        };
      }
      const limit = typeof optionsOrLimit === 'number' ? optionsOrLimit : 50;
      return mockNotifications.slice(0, limit);
    },
  };

  const notificationService = createNotificationService(mockRepo);

  it('Customer legacy ?limit=50 without page returns { notifications, unread_count }', async () => {
    // Legacy Header bell request: no page query parameter
    const result = await notificationService.listForUser(10, 50);

    assert.ok(Array.isArray(result.notifications), 'Must return notifications array for legacy caller');
    assert.equal(typeof result.unread_count, 'number');
    assert.equal(result.items, undefined, 'Must NOT contain items key in legacy response');
    assert.equal(result.pagination, undefined, 'Must NOT contain pagination key in legacy response');
    assert.equal(result.notifications.length, 2);
    assert.equal(result.unread_count, 1);
  });

  it('Admin legacy ?limit=100&envelope=true without page returns { notifications, unread_count } for AdminTopbar', async () => {
    // AdminTopbar request: limit=100, envelope=true, no page
    const result = await notificationService.listForUser(1, 100);

    assert.ok(Array.isArray(result.notifications), 'Must return notifications array for AdminTopbar');
    assert.equal(typeof result.unread_count, 'number');
    assert.equal(result.items, undefined, 'Must NOT contain items key in legacy response');
    assert.equal(result.pagination, undefined, 'Must NOT contain pagination key in legacy response');
    assert.equal(result.notifications.length, 2);
    assert.equal(result.unread_count, 1);
  });

  it('Customer/Admin request with ?page=1&limit=10 returns paginated { items, pagination, unread_count }', async () => {
    // Paginated call from Profile or Admin Notifications page
    const page = 1;
    const limit = 10;
    const result = await notificationService.listForUser(10, limit, { page });

    assert.ok(Array.isArray(result.items), 'Must return items array for paginated caller');
    assert.equal(result.notifications, undefined, 'Must NOT contain notifications key in paginated response');
    assert.equal(typeof result.unread_count, 'number');
    assert.equal(result.totalItems, 2);

    const pagination = buildOffsetPagination({ totalItems: result.totalItems, page, limit });
    assert.deepEqual(pagination, {
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
    });
  });
});
