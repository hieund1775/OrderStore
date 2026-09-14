import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminOrdersRepository } from '../repositories/postgres/admin-orders.js';

test('an operational order transition is rejected until its preorder is confirmed', async () => {
  const queries = [];
  const database = {
    async transaction(run) {
      return run({
        async query(sql) {
          queries.push(sql);
          if (sql.includes('FROM orders')) {
            return [[{ id: 11, order_code: 'PO-ORDER', user_id: 5, store_id: 2, preorder_id: 7, payment_status: 'paid', order_type: 'Take-away' }], 1];
          }
          if (sql.includes('FROM preorders')) {
            return [[{ status: 'PENDING_MANAGER_CONFIRMATION', checked_in_at: null }], 1];
          }
          throw new Error(`Unexpected query in gate test: ${sql}`);
        },
      });
    },
  };
  const repository = createAdminOrdersRepository(database, {});

  await assert.rejects(
    repository.transition({
      orderId: 11,
      scopedStoreId: 2,
      targetStatus: 'Đang chuẩn bị',
      actorId: 3,
      actorRole: 'manager',
      evaluateTransition: () => ({ allowed: true }),
    }),
    (error) => error?.code === 'PREORDER_CONFIRMATION_REQUIRED' && error?.status === 409,
  );
  assert.equal(queries.some((sql) => sql.includes('FROM preorders') && sql.includes('FOR UPDATE')), true);
  assert.equal(queries.some((sql) => sql.includes('order_status_history')), false);
});

test('an operational order transition is allowed when preorder is CONFIRMED, even before customer check-in', async () => {
  const queries = [];
  const database = {
    async transaction(run) {
      return run({
        async query(sql, params) {
          queries.push({ sql, params });
          if (sql.includes('FROM orders')) {
            return [[{ id: 11, order_code: 'PO-ORDER', user_id: 5, store_id: 2, preorder_id: 7, payment_status: 'paid', order_type: 'Take-away' }], 1];
          }
          if (sql.includes('FROM preorders')) {
            return [[{ status: 'CONFIRMED', checked_in_at: null }], 1];
          }
          if (sql.includes('FROM order_status_history')) {
            return [[{ status: 'Chờ xác nhận' }], 1];
          }
          if (sql.includes('INSERT INTO order_status_history')) {
            return [[{ id: 101 }], 1];
          }
          if (sql.includes('UPDATE orders SET kitchen_notified_at')) {
            return [[], 1];
          }
          throw new Error(`Unexpected query in gate test: ${sql}`);
        },
      });
    },
  };
  const repository = createAdminOrdersRepository(database, {
    async sendOrderNotification() {},
  });

  const result = await repository.transition({
    orderId: 11,
    scopedStoreId: 2,
    targetStatus: 'Đang chuẩn bị',
    actorId: 3,
    actorRole: 'manager',
    evaluateTransition: () => ({ allowed: true }),
  });

  assert.equal(result.order_id, 11);
  assert.equal(result.status, 'Đang chuẩn bị');
  assert.equal(queries.some((q) => q.sql.includes('INSERT INTO order_status_history')), true);
});
