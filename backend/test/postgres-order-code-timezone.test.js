import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrdersRepository, OrderError } from '../repositories/postgres/orders.js';

describe('PostgreSQL Order Code Vietnam Timezone & Collision Resilience', () => {
  it('generates order codes using Vietnam business date prefix (Asia/Ho_Chi_Minh / UTC+7)', async () => {
    let insertedOrderCode = null;
    const mockTx = {
      async query(sql, params) {
        if (sql.includes('idempotency_keys')) return [[{ id: 1 }], 1];
        if (sql.includes('SELECT id FROM stores')) return [[{ id: 1, is_active: true }], 1];
        if (sql.includes('FROM products p')) return [[{ id: 1, name: 'Trà Đào', price: 35000, fulfillment_lane: 'kitchen' }], 1];
        if (sql.includes('FROM branch_fulfillment_capabilities')) return [[{ exists: 1 }], 1];
        if (sql.includes('INSERT INTO orders')) {
          insertedOrderCode = params[0];
          return [[{ id: 100, order_code: params[0], subtotal: 35000, discount_amount: 0, total: 35000, payment_status: 'unpaid', payment_provider: 'cod' }], 1];
        }
        if (sql.includes('INSERT INTO order_items')) return [[{ id: 1 }], 1];
        if (sql.includes('INSERT INTO order_status_history')) return [[{ id: 1 }], 1];
        if (sql.includes('SAVEPOINT') || sql.includes('RELEASE')) return [[], 0];
        return [[], 0];
      },
    };

    const mockDb = {
      async transaction(cb) {
        return cb(mockTx);
      },
    };

    const mockPromotions = {
      async validateForOrder() { return null; },
      async consumeForOrder() {},
    };

    const mockNotifications = {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    };

    // 17:05 UTC on 24/08/2026 is 00:05 AM on 25/08/2026 in Vietnam
    const clock = () => new Date('2026-08-24T17:05:00.000Z');
    const randomInt = () => 9534;

    const repo = createOrdersRepository(mockDb, mockPromotions, mockNotifications, { clock, randomInt });

    const order = await repo.createPublicOrder({
      input: {
        store_id: 1,
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        items: [{ product_id: 1, qty: 1 }],
      },
      idempotencyKey: 'test-key-1',
      requestHash: 'hash-1',
    });

    assert.equal(insertedOrderCode, 'TP2608259534');
    assert.equal(order.order_code, 'TP2608259534');
  });

  it('retries with SAVEPOINT on unique constraint collision and succeeds on next candidate', async () => {
    let attempts = 0;
    const executedQueries = [];

    const mockTx = {
      async query(sql, params) {
        executedQueries.push({ sql, params });
        if (sql.includes('idempotency_keys')) return [[{ id: 1 }], 1];
        if (sql.includes('SELECT id FROM stores')) return [[{ id: 1, is_active: true }], 1];
        if (sql.includes('FROM products p')) return [[{ id: 1, name: 'Trà Đào', price: 35000, fulfillment_lane: 'kitchen' }], 1];
        if (sql.includes('FROM branch_fulfillment_capabilities')) return [[{ exists: 1 }], 1];
        if (sql.includes('INSERT INTO orders')) {
          attempts++;
          if (attempts === 1) {
            const err = new Error('duplicate key value violates unique constraint "orders_order_code_key"');
            err.code = '23505';
            err.constraint = 'orders_order_code_key';
            throw err;
          }
          return [[{ id: 101, order_code: params[0], subtotal: 35000, discount_amount: 0, total: 35000, payment_status: 'unpaid', payment_provider: 'cod' }], 1];
        }
        if (sql.includes('INSERT INTO order_items')) return [[{ id: 1 }], 1];
        if (sql.includes('INSERT INTO order_status_history')) return [[{ id: 1 }], 1];
        return [[], 0];
      },
    };

    const mockDb = {
      async transaction(cb) {
        return cb(mockTx);
      },
    };

    const mockPromotions = {
      async validateForOrder() { return null; },
      async consumeForOrder() {},
    };

    const mockNotifications = {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    };

    const numbers = [1111, 2222];
    let numIdx = 0;
    const randomInt = () => numbers[numIdx++];

    const repo = createOrdersRepository(mockDb, mockPromotions, mockNotifications, {
      clock: () => new Date('2026-08-24T17:05:00.000Z'),
      randomInt,
    });

    const order = await repo.createPublicOrder({
      input: {
        store_id: 1,
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        items: [{ product_id: 1, qty: 1 }],
      },
      idempotencyKey: 'test-key-collision',
      requestHash: 'hash-collision',
    });

    assert.equal(attempts, 2);
    assert.equal(order.order_code, 'TP2608252222');
    assert.ok(executedQueries.some((q) => q.sql.includes('ROLLBACK TO SAVEPOINT order_code_attempt')));
    assert.equal(executedQueries.filter((q) => q.sql.includes('RELEASE SAVEPOINT order_code_attempt')).length, 2);
  });

  it('does not retry an unrelated unique constraint violation', async () => {
    let orderInsertAttempts = 0;
    const queries = [];
    const unrelatedError = Object.assign(new Error('duplicate customer reference'), {
      code: '23505',
      constraint: 'orders_customer_reference_key',
    });
    const mockTx = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes('idempotency_keys')) return [[{ id: 1 }], 1];
        if (sql.includes('SELECT id FROM stores')) return [[{ id: 1 }], 1];
        if (sql.includes('FROM products p')) return [[{ id: 1, name: 'Trà Đào', price: 35000, fulfillment_lane: 'kitchen' }], 1];
        if (sql.includes('FROM branch_fulfillment_capabilities')) return [[{ exists: 1 }], 1];
        if (sql.includes('INSERT INTO orders')) {
          orderInsertAttempts++;
          throw unrelatedError;
        }
        return [[], 0];
      },
    };
    const repo = createOrdersRepository(
      { async transaction(callback) { return callback(mockTx); } },
      { async validateForOrder() { return null; } },
      { async insertForUser() {}, async fanOutToOrderAdmins() {} },
      { clock: () => new Date('2026-08-24T17:05:00.000Z'), randomInt: () => 1111 },
    );

    await assert.rejects(
      () => repo.createPublicOrder({
        input: { store_id: 1, customer_phone: '0901234567', items: [{ product_id: 1, qty: 1 }] },
        idempotencyKey: 'unrelated-constraint',
        requestHash: 'hash',
      }),
      (err) => err === unrelatedError,
    );
    assert.equal(orderInsertAttempts, 1);
    assert.ok(queries.some((sql) => sql.includes('ROLLBACK TO SAVEPOINT order_code_attempt')));
    assert.ok(queries.some((sql) => sql.includes('RELEASE SAVEPOINT order_code_attempt')));
  });

  it('returns a completed idempotency replay without generating another order code', async () => {
    const queries = [];
    const replayResponse = { id: 77, order_code: 'TP2608257777', total: 35000 };
    const mockTx = {
      async query(sql) {
        queries.push(sql);
        if (sql.startsWith('INSERT INTO idempotency_keys')) return [[], 0];
        if (sql.includes('FROM idempotency_keys')) {
          return [[{
            scope: 'online-order:user:42',
            request_hash: 'same-hash',
            status: 'completed',
            response_body: replayResponse,
          }], 1];
        }
        throw new Error(`Unexpected query during replay: ${sql}`);
      },
    };
    const repo = createOrdersRepository(
      { async transaction(callback) { return callback(mockTx); } },
      { async validateForOrder() { throw new Error('voucher validation must not run on replay'); } },
      { async insertForUser() {}, async fanOutToOrderAdmins() {} },
    );

    const result = await repo.createPublicOrder({
      input: { store_id: 1, customer_phone: '0901234567', items: [] },
      userId: 42,
      idempotencyKey: 'completed-key',
      requestHash: 'same-hash',
    });

    assert.deepEqual(result, { replay: true, ...replayResponse });
    assert.equal(queries.some((sql) => sql.includes('INSERT INTO orders')), false);
    assert.equal(queries.some((sql) => sql.includes('SAVEPOINT')), false);
  });

  it('exhausts max attempts and throws safe OrderError', async () => {
    const mockTx = {
      async query(sql) {
        if (sql.includes('idempotency_keys')) return [[{ id: 1 }], 1];
        if (sql.includes('SELECT id FROM stores')) return [[{ id: 1, is_active: true }], 1];
        if (sql.includes('FROM products p')) return [[{ id: 1, name: 'Trà Đào', price: 35000, fulfillment_lane: 'kitchen' }], 1];
        if (sql.includes('FROM branch_fulfillment_capabilities')) return [[{ exists: 1 }], 1];
        if (sql.includes('INSERT INTO orders')) {
          const err = new Error('duplicate key value violates unique constraint "orders_order_code_key"');
          err.code = '23505';
          err.constraint = 'orders_order_code_key';
          throw err;
        }
        return [[], 0];
      },
    };

    const mockDb = {
      async transaction(cb) {
        return cb(mockTx);
      },
    };

    const repo = createOrdersRepository(mockDb, { async validateForOrder() { return null; } }, { async insertForUser() {}, async fanOutToOrderAdmins() {} });

    await assert.rejects(
      () => repo.createPublicOrder({
        input: { store_id: 1, customer_phone: '0901234567', items: [{ product_id: 1, qty: 1 }] },
        idempotencyKey: 'exhaust-key',
        requestHash: 'hash',
      }),
      (err) => err instanceof OrderError && err.status === 500 && err.code === 'ORDER_CODE_COLLISION',
    );
  });
});
