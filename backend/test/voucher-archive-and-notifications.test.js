import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminPromotionError, createAdminPromotionsRepository } from '../repositories/postgres/admin-promotions.js';
import { createPromotionsRepository, PromotionError } from '../repositories/postgres/promotions.js';
import { createNotificationsRepository } from '../repositories/postgres/notifications.js';
import { createOrdersRepository } from '../repositories/postgres/orders.js';
import { createAdminOrdersRepository } from '../repositories/postgres/admin-orders.js';
import { createRecruitmentRepository } from '../repositories/postgres/recruitment.js';
import { createNotificationService, NotificationServiceError } from '../services/notifications/notification-service.js';
import { validateCustomerNotificationInput } from '../validation/customer-schemas.js';

describe('Voucher Archive & Per-Account Notifications Comprehensive Suite', () => {
  describe('Task 2: Voucher Soft-Archive (deleted_at)', () => {
    it('archives a promotion with deleted_at and sets is_active = false', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          if (sql.includes('UPDATE promotions')) {
            return [[{ id: 1, code: 'SALE20', title: 'Giảm 20k' }], 1];
          }
          return [[], 0];
        },
      };

      const repo = createAdminPromotionsRepository(mockDb);
      const result = await repo.deletePromotion(1);
      assert.equal(result, true);

      const updateQuery = executed.find((q) => q.sql.includes('UPDATE promotions'));
      assert.ok(updateQuery);
      assert.ok(updateQuery.sql.includes('deleted_at = NOW()'));
      assert.ok(updateQuery.sql.includes('is_active = FALSE'));
      assert.ok(updateQuery.sql.includes('deleted_at IS NULL'));
      assert.equal(updateQuery.params[0], 1);
    });

    it('filters out archived promotions (deleted_at IS NOT NULL) from admin list while retaining inactive ones', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          return [[{ id: 1, title: 'Active Promo', is_active: true }, { id: 2, title: 'Paused Promo', is_active: false }], 2];
        },
      };

      const repo = createAdminPromotionsRepository(mockDb);
      const rows = await repo.listPromotions();
      assert.equal(rows.length, 2);

      const listQuery = executed.find((q) => q.sql.includes('SELECT p.*'));
      assert.ok(listQuery);
      assert.ok(listQuery.sql.includes('WHERE p.deleted_at IS NULL'));
    });

    it('uses the same global-or-exact-store scope rule for manager lists', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          return [[], 0];
        },
      };

      const repo = createAdminPromotionsRepository(mockDb);
      await repo.listPromotions({ scopedStoreId: 7 });
      const listQuery = executed[0];
      assert.ok(listQuery.sql.includes('NOT EXISTS (SELECT 1 FROM promotion_stores'));
      assert.ok(listQuery.sql.includes('EXISTS (SELECT 1 FROM promotion_stores'));
      assert.ok(listQuery.sql.includes('ps2.store_id = $1'));
      assert.equal(listQuery.sql.includes("p.scope = 'all'"), false);
      assert.deepEqual(listQuery.params, [7]);
    });

    it('prevents archived vouchers from being previewed or applied publicly', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          // Returns empty when filtering deleted_at IS NULL
          return [[], 0];
        },
      };

      const repo = createPromotionsRepository(mockDb);
      await assert.rejects(
        () => repo.preview({ code: 'ARCHIVED_CODE', subtotal: 100000, phone: '0901234567', storeId: 1 }),
        (err) => err instanceof PromotionError && err.message.includes('không tồn tại'),
      );

      const checkQuery = executed.find((q) => q.sql.includes('SELECT p.*'));
      assert.ok(checkQuery);
      assert.ok(checkQuery.sql.includes('p.deleted_at IS NULL'));
      assert.ok(checkQuery.sql.includes('NOT EXISTS (SELECT 1 FROM promotion_stores'));
      assert.ok(checkQuery.sql.includes('(p.end_date IS NULL OR p.end_date >= $3)'));
      assert.ok(checkQuery.params[2]); // business date parameter
    });

    it('normalizes single-use create data and rejects invalid merged update limits', async () => {
      const inserted = [];
      const createDb = {
        async transaction(callback) {
          return callback({
            async query(sql, params) {
              if (sql.includes('INSERT INTO promotions')) {
                inserted.push(params);
                return [[{ id: 1, voucher_type: params[15], usage_limit: params[16] }], 1];
              }
              return [[], 0];
            },
          });
        },
      };
      const createRepo = createAdminPromotionsRepository(createDb);
      const created = await createRepo.createPromotion({
        title: 'Một lần', code: 'ONCE', start_date: '2026-08-24', end_date: null,
        voucher_type: 'single_use', usage_limit: 99,
      });
      assert.equal(created.voucher_type, 'single_use');
      assert.equal(created.usage_limit, null);

      const updateDb = {
        async transaction(callback) {
          return callback({
            async query(sql) {
              if (sql.includes('SELECT id, voucher_type')) {
                return [[{
                  id: 1, voucher_type: 'shared', usage_limit: 10, used_count: 5,
                  start_date: '2026-08-01', end_date: null,
                }], 1];
              }
              throw new Error('UPDATE must not run for an invalid merged candidate');
            },
          });
        },
      };
      const updateRepo = createAdminPromotionsRepository(updateDb);
      await assert.rejects(
        () => updateRepo.updatePromotion(1, { usage_limit: 4 }),
        (err) => err instanceof AdminPromotionError && err.status === 400,
      );
    });
  });

  describe('Task 4: Notification Repository Isolation & Fan-Out', () => {
    it('fans out order notifications exclusively to super admins and branch kitchen/manager staff', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          return [[{ id: 101, user_id: 1 }, { id: 102, user_id: 2 }], 2];
        },
      };

      const repo = createNotificationsRepository(mockDb);
      const created = await repo.fanOutToOrderAdmins(3, {
        type: 'order',
        title: 'Đơn hàng mới — #TP123',
        body: 'Đơn Take-away',
        link: '/admin/bep',
      });
      assert.equal(created.length, 2);

      const fanQuery = executed.find((q) => q.sql.includes('INSERT INTO notifications'));
      assert.ok(fanQuery);
      assert.ok(fanQuery.sql.includes('u.admin_role = \'super\''));
      assert.ok(fanQuery.sql.includes('u.admin_role IN (\'manager\', \'kitchen\')'));
      assert.ok(fanQuery.sql.includes('u.is_active = TRUE'));
      assert.ok(fanQuery.sql.includes('u.admin_branch_id = $5'));
      assert.equal(fanQuery.sql.includes('u.admin_branch_id IS NULL'), false);
      assert.equal(fanQuery.params[4], 3); // storeId
    });

    it('requires an exact active recipient for manual notifications and defaults type to system', async () => {
      const inserted = [];
      const mockRepo = {
        async findActiveUserById(id) {
          return id === 9 ? { id: 9 } : null;
        },
        async insertForUser(payload) {
          inserted.push(payload);
          return { id: 88, ...payload };
        },
      };
      const service = createNotificationService(mockRepo);
      const input = validateCustomerNotificationInput({ user_id: 9, title: 'Bảo trì hệ thống' });
      const created = await service.createManualNotification({
        userId: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      });
      assert.equal(created.type, 'system');
      assert.equal(inserted.length, 1);

      await assert.rejects(
        () => service.createManualNotification({ userId: 10, title: 'Không gửi được' }),
        (err) => err instanceof NotificationServiceError && err.status === 404,
      );
      assert.throws(() => validateCustomerNotificationInput({ title: 'Thiếu recipient' }));
    });

    it('validates notification limits instead of silently accepting malformed values', async () => {
      const service = createNotificationService({
        async listForUser(_userId, limit) {
          assert.equal(limit, 100);
          return [];
        },
        async countUnreadForUser() { return 0; },
      });
      await service.listForUser(7, 500);
      await assert.rejects(
        () => service.listForUser(7, 'abc'),
        (err) => err instanceof NotificationServiceError && err.status === 400,
      );
    });

    it('marks one notification read, marks all read, and clears notifications per user', async () => {
      const executed = [];
      const mockDb = {
        async query(sql, params) {
          executed.push({ sql, params });
          if (sql.includes('UPDATE notifications') && sql.includes('WHERE id = $1')) {
            return [[{ id: 10 }], 1];
          }
          if (sql.includes('UPDATE notifications') && sql.includes('WHERE user_id = $1')) {
            return [[], 5];
          }
          if (sql.includes('DELETE FROM notifications')) {
            return [[], 5];
          }
          return [[], 0];
        },
      };

      const repo = createNotificationsRepository(mockDb);
      const oneRead = await repo.markOneRead(7, 10);
      assert.equal(oneRead, true);

      const allRead = await repo.markAllRead(7);
      assert.equal(allRead, 5);

      const cleared = await repo.clearAll(7);
      assert.equal(cleared, 5);

      assert.equal(executed.every((q) => q.params.includes(7)), true);
    });
  });

  describe('Task 5 & 6: Order Transitions & Recruitment Notification Dispatch', () => {
    it('dispatches customer and branch admin notifications upon order creation', async () => {
      const dispatched = [];
      const mockNotifications = {
        async insertForUser(payload, { tx }) {
          dispatched.push({ type: 'user', payload });
        },
        async fanOutToOrderAdmins(storeId, payload, { tx }) {
          dispatched.push({ type: 'admin', storeId, payload });
        },
      };

      const mockDb = {
        async transaction(cb) {
          const tx = {
            async query(sql, params) {
              if (sql.includes('stores')) {
                return [[{ id: 2, name: 'Chi nhánh 2' }]];
              }
              if (sql.includes('INSERT INTO orders')) {
                return [[{ id: 99, order_code: 'TP260824009', total: 50000, payment_status: 'unpaid' }]];
              }
              if (sql.includes('INSERT INTO order_items')) {
                return [[{ id: 1 }]];
              }
              if (sql.includes('FROM products p')) {
                return [[{ id: 1, name: 'Trà Đào', price: 50000, fulfillment_lane: 'kitchen' }]];
              }
              if (sql.includes('FROM branch_fulfillment_capabilities')) {
                return [[{ exists: 1 }]];
              }
              if (sql.includes('INSERT INTO idempotency_keys')) {
                return [[{ id: 1 }], 1];
              }
              if (sql.includes('idempotency_keys')) {
                return [[], 1];
              }
              return [[], 0];
            },
          };
          return cb(tx);
        },
      };

      const mockPromos = {
        async validateForOrder() { return null; },
        async consumeForOrder() {},
      };

      const ordersRepo = createOrdersRepository(mockDb, mockPromos, mockNotifications);
      const res = await ordersRepo.createPublicOrder({
        input: { store_id: 2, customer_phone: '0901234567', customer_name: 'Khách Test', items: [{ product_id: 1, qty: 1 }] },
        userId: 45,
        idempotencyKey: 'test-idemp-1',
      });

      assert.equal(res.id, 99);
      assert.equal(dispatched.some((d) => d.type === 'user' && d.payload.userId === 45), true);
      assert.equal(dispatched.some((d) => d.type === 'admin' && d.storeId === 2), true);
    });

    it('dispatches shipper info notification to customer when order transitions to Đang giao', async () => {
      const dispatched = [];
      const mockNotifications = {
        async insertForUser(payload, { tx }) {
          dispatched.push(payload);
        },
      };

      const mockDb = {
        async transaction(cb) {
          const tx = {
            async query(sql) {
              if (sql.includes('SELECT id, order_code')) {
                return [[{ id: 88, order_code: 'TPDELIV01', user_id: 12, store_id: 1, payment_status: 'paid', order_type: 'Delivery' }]];
              }
              if (sql.includes('SELECT status FROM order_status_history')) {
                return [[{ status: 'Đang chuẩn bị' }]];
              }
              return [[], 1];
            },
          };
          return cb(tx);
        },
      };

      const adminOrders = createAdminOrdersRepository(mockDb, mockNotifications);
      await adminOrders.transition({
        orderId: 88,
        targetStatus: 'Đang giao',
        actorId: 1,
        actorRole: 'kitchen',
        driverName: 'Nguyễn Văn Shipper',
        driverPhone: '0987654321',
        evaluateTransition: () => ({ allowed: true }),
      });

      assert.equal(dispatched.length, 1);
      assert.equal(dispatched[0].userId, 12);
      assert.ok(dispatched[0].body.includes('Nguyễn Văn Shipper'));
      assert.ok(dispatched[0].body.includes('0987654321'));
    });

    it('dispatches recruitment notification when a candidate applies', async () => {
      const dispatched = [];
      const mockNotifications = {
        async fanOutToRecruitmentAdmins(storeId, payload, { tx }) {
          dispatched.push({ storeId, payload });
        },
      };

      const mockDb = {
        async transaction(cb) {
          const tx = {
            async query(sql) {
              if (sql.includes('INSERT INTO job_applications')) {
                return [[{ id: 501, fullname: 'Trần Ứng Viên' }]];
              }
              if (sql.includes('SELECT title FROM jobs')) {
                return [[{ title: 'Pha chế Barista' }]];
              }
              return [[], 1];
            },
          };
          return cb(tx);
        },
      };

      const repo = createRecruitmentRepository(mockDb, mockNotifications);
      const app = await repo.createApplication({
        jobId: 5,
        storeId: 2,
        fullname: 'Trần Ứng Viên',
        phone: '0912345678',
        email: 'ungvien@example.com',
      });

      assert.equal(app.id, 501);
      assert.equal(dispatched.length, 1);
      assert.equal(dispatched[0].storeId, 2);
      assert.ok(dispatched[0].payload.body.includes('Trần Ứng Viên'));
      assert.ok(dispatched[0].payload.body.includes('Pha chế Barista'));
    });
  });
});
