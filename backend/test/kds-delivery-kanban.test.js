import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createAdminOrdersRepository, AdminOrderError } from '../repositories/postgres/admin-orders.js';
import { buildPublicLookupDto } from '../services/public-dto.js';
import { validateOrderMutationInput } from '../validation/order-schemas.js';

describe('KDS 3-Lane Kanban, Delivery Shipper Validation & Privacy Suite', () => {
  describe('Backend DB Transaction Validation for Delivery Shipper', () => {
    it('rejects transitioning a Delivery order to Đang giao without driver name', async () => {
      const mockDb = {
        transaction: async (fn) => {
          const tx = {
            query: async (sql, params) => {
              if (sql.includes('FROM orders')) {
                return [[{ id: 101, payment_status: 'paid', order_type: 'Delivery' }]];
              }
              if (sql.includes('FROM order_status_history')) {
                return [[{ status: 'Đang chuẩn bị' }]];
              }
              return [[]];
            },
          };
          return fn(tx);
        },
      };

      const repo = createAdminOrdersRepository(mockDb);
      await assert.rejects(
        () =>
          repo.transition({
            orderId: 101,
            targetStatus: 'Đang giao',
            actorId: 1,
            actorRole: 'kitchen',
            driverName: '',
            driverPhone: '0901234567',
            evaluateTransition: () => ({ allowed: true }),
          }),
        (err) => err instanceof AdminOrderError && err.status === 400 && err.message.includes('tên Shipper'),
      );
    });

    it('rejects transitioning a Delivery order to Đang giao with invalid driver phone', async () => {
      const mockDb = {
        transaction: async (fn) => {
          const tx = {
            query: async (sql, params) => {
              if (sql.includes('FROM orders')) {
                return [[{ id: 102, payment_status: 'paid', order_type: 'Delivery' }]];
              }
              if (sql.includes('FROM order_status_history')) {
                return [[{ status: 'Đang chuẩn bị' }]];
              }
              return [[]];
            },
          };
          return fn(tx);
        },
      };

      const repo = createAdminOrdersRepository(mockDb);
      await assert.rejects(
        () =>
          repo.transition({
            orderId: 102,
            targetStatus: 'Đang giao',
            actorId: 1,
            actorRole: 'kitchen',
            driverName: 'Nguyễn Văn A',
            driverPhone: 'invalid-phone-123',
            evaluateTransition: () => ({ allowed: true }),
          }),
        (err) => err instanceof AdminOrderError && err.status === 400 && err.message.toLowerCase().includes('số điện thoại shipper'),
      );
    });

    it('accepts transitioning a Delivery order to Đang giao with valid shipper info and updates DB', async () => {
      const historyInserts = [];
      const orderUpdates = [];

      const mockDb = {
        transaction: async (fn) => {
          const tx = {
            query: async (sql, params) => {
              if (sql.includes('FROM orders')) {
                return [[{ id: 103, payment_status: 'paid', order_type: 'Delivery' }]];
              }
              if (sql.includes('FROM order_status_history') && sql.includes('SELECT')) {
                return [[{ status: 'Đang chuẩn bị' }]];
              }
              if (sql.includes('INSERT INTO order_status_history')) {
                historyInserts.push(params);
                return [{ rowCount: 1 }];
              }
              if (sql.includes('UPDATE orders')) {
                orderUpdates.push({ sql, params });
                return [{ rowCount: 1 }];
              }
              return [[]];
            },
          };
          return fn(tx);
        },
      };

      const repo = createAdminOrdersRepository(mockDb);
      const res = await repo.transition({
        orderId: 103,
        targetStatus: 'Đang giao',
        actorId: 2,
        actorRole: 'kitchen',
        driverName: 'Nguyễn Văn Grab',
        driverPhone: '0901234567',
        trackingUrl: 'https://tracking.example.com/ship123',
        evaluateTransition: () => ({ allowed: true }),
      });

      assert.equal(res.status, 'Đang giao');
      assert.equal(historyInserts.length, 1);
      assert.equal(historyInserts[0][1], 'Đang giao');

      const updateCall = orderUpdates.find((u) => u.sql.includes('shipping_driver_name'));
      assert.ok(updateCall);
      assert.equal(updateCall.params[1], 'Nguyễn Văn Grab');
      assert.equal(updateCall.params[2], '0901234567');
      assert.equal(updateCall.params[3], 'https://tracking.example.com/ship123');
    });

    it('allows Take-away / POS / Dine-in orders to transition directly to Hoàn thành without shipper', async () => {
      const historyInserts = [];

      const mockDb = {
        transaction: async (fn) => {
          const tx = {
            query: async (sql, params) => {
              if (sql.includes('FROM orders')) {
                return [[{ id: 104, payment_status: 'paid', order_type: 'Take-away' }]];
              }
              if (sql.includes('FROM order_status_history') && sql.includes('SELECT')) {
                return [[{ status: 'Đang chuẩn bị' }]];
              }
              if (sql.includes('INSERT INTO order_status_history')) {
                historyInserts.push(params);
                return [{ rowCount: 1 }];
              }
              return [[]];
            },
          };
          return fn(tx);
        },
      };

      const repo = createAdminOrdersRepository(mockDb);
      const res = await repo.transition({
        orderId: 104,
        targetStatus: 'Hoàn thành',
        actorId: 3,
        actorRole: 'kitchen',
        evaluateTransition: () => ({ allowed: true }),
      });

      assert.equal(res.status, 'Hoàn thành');
      assert.equal(historyInserts.length, 1);
      assert.equal(historyInserts[0][1], 'Hoàn thành');
    });

    it('rejects non-Delivery orders transitioning to Đang giao before writing history', async () => {
      const historyInserts = [];
      const mockDb = {
        transaction: async (fn) => fn({
          query: async (sql, params) => {
            if (sql.includes('FROM orders')) {
              return [[{ id: 105, payment_status: 'paid', order_type: 'Take-away' }]];
            }
            if (sql.includes('FROM order_status_history') && sql.includes('SELECT')) {
              return [[{ status: 'Đang chuẩn bị' }]];
            }
            if (sql.includes('INSERT INTO order_status_history')) historyInserts.push(params);
            return [[], 0];
          },
        }),
      };

      const repo = createAdminOrdersRepository(mockDb);
      await assert.rejects(
        () => repo.transition({
          orderId: 105,
          targetStatus: 'Đang giao',
          actorId: 3,
          actorRole: 'kitchen',
          evaluateTransition: () => ({ allowed: true }),
        }),
        (err) => err instanceof AdminOrderError && err.status === 400 && err.message.includes('Chỉ đơn giao hàng Delivery'),
      );
      assert.equal(historyInserts.length, 0);
    });

    it('allows Delivery orders to transition from Đang giao to Hoàn thành', async () => {
      const historyInserts = [];
      const mockDb = {
        transaction: async (fn) => fn({
          query: async (sql, params) => {
            if (sql.includes('FROM orders')) {
              return [[{ id: 106, payment_status: 'paid', order_type: 'Delivery' }]];
            }
            if (sql.includes('FROM order_status_history') && sql.includes('SELECT')) {
              return [[{ status: 'Đang giao' }]];
            }
            if (sql.includes('INSERT INTO order_status_history')) {
              historyInserts.push(params);
              return [[], 1];
            }
            return [[], 0];
          },
        }),
      };

      const repo = createAdminOrdersRepository(mockDb);
      const result = await repo.transition({
        orderId: 106,
        targetStatus: 'Hoàn thành',
        actorId: 3,
        actorRole: 'kitchen',
        evaluateTransition: () => ({ allowed: true }),
      });

      assert.equal(result.status, 'Hoàn thành');
      assert.equal(historyInserts.length, 1);
      assert.equal(historyInserts[0][1], 'Hoàn thành');
    });
  });

  describe('Shipper Information Privacy & PII Masking in Public Lookup', () => {
    const cancelTokenPlain = 'cancel_secret_token_123456';
    const cancelTokenHash = crypto.createHash('sha256').update(cancelTokenPlain).digest('hex');

    const deliveryOrder = {
      id: 200,
      order_code: 'TP2608240001',
      user_id: 15,
      customer_name: 'Trần Thị B',
      customer_phone: '0912345678',
      delivery_addr: '456 Hai Bà Trưng, Q.3, TP.HCM',
      shipping_driver_name: 'Phạm Văn Shipper',
      shipping_driver_phone: '0987654321',
      shipping_tracking_url: 'https://ship.vn/track/001',
      cancel_token_hash: cancelTokenHash,
      total: 65000,
      current_status: 'Đang giao',
    };

    it('masks shipper phone and name for anonymous viewers without token', () => {
      const dto = buildPublicLookupDto(deliveryOrder, null);
      assert.equal(dto.shipping_driver_phone, '098****321');
      assert.equal(dto.shipping_driver_name, 'P***r');
      assert.equal(dto.shipping_tracking_url, null);
      assert.equal(dto.customer_phone, '091***5678');
    });

    it('reveals full shipper phone and tracking url for authenticated customer owner', () => {
      const dto = buildPublicLookupDto(deliveryOrder, { sub: 15, role: 'customer' });
      assert.equal(dto.shipping_driver_phone, '0987654321');
      assert.equal(dto.shipping_driver_name, 'Phạm Văn Shipper');
      assert.equal(dto.shipping_tracking_url, 'https://ship.vn/track/001');
      assert.equal(dto.customer_phone, '0912345678');
    });

    it('reveals full shipper phone for guest user possessing valid cancel_token', () => {
      const dto = buildPublicLookupDto(deliveryOrder, null, [], [], cancelTokenPlain);
      assert.equal(dto.shipping_driver_phone, '0987654321');
      assert.equal(dto.shipping_driver_name, 'Phạm Văn Shipper');
      assert.equal(dto.shipping_tracking_url, 'https://ship.vn/track/001');
      assert.equal(dto.customer_phone, '0912345678');
    });

    it('masks shipper phone if cancel_token is invalid', () => {
      const dto = buildPublicLookupDto(deliveryOrder, null, [], [], 'wrong_token');
      assert.equal(dto.shipping_driver_phone, '098****321');
      assert.equal(dto.shipping_tracking_url, null);
    });
  });

  describe('Mutation Input Validation for Driver Fields', () => {
    it('parses and trims driver_name, driver_phone, tracking_url', () => {
      const validated = validateOrderMutationInput({
        status: 'Đang giao',
        note: 'Giao nhanh giúp khách',
        driver_name: '  Nguyễn Văn A  ',
        driver_phone: '  0901234567  ',
        tracking_url: '  https://map.vn/123  ',
      });

      assert.equal(validated.status, 'Đang giao');
      assert.equal(validated.driverName, 'Nguyễn Văn A');
      assert.equal(validated.driverPhone, '0901234567');
      assert.equal(validated.trackingUrl, 'https://map.vn/123');
    });
  });
});
