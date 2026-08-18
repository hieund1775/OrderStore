import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import ordersRepository from '../repositories/postgres/orders.js';
import { hashOrderRequest } from '../services/order-idempotency.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

function input(suffix) {
  return {
    source: 'online', payment_method: 'COD', store_id: 1, order_type: 'Take-away',
    customer_name: `Order test ${suffix}`, customer_phone: `090${String(suffix).padStart(7, '0').slice(-7)}`,
    items: [{ product_id: 1, qty: 1, size_id: 1, topping_ids: [1] }],
  };
}

describe('PostgreSQL public order flows', () => {
  it('creates, replays, looks up, and preserves customer history DTO data', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const suffix = Date.now() % 1_000_000;
    const request = input(suffix);
    const idempotencyKey = `order-flow-${suffix}`;
    try {
      const created = await ordersRepository.createPublicOrder({
        input: request, idempotencyKey, requestHash: hashOrderRequest(request), paymentProvider: 'cod',
        cancelTokenHash: crypto.createHash('sha256').update('cancel-secret').digest('hex'), cancelToken: 'cancel-secret',
      });
      const replay = await ordersRepository.createPublicOrder({
        input: request, idempotencyKey, requestHash: hashOrderRequest(request), paymentProvider: 'cod',
        cancelTokenHash: crypto.createHash('sha256').update('another-secret').digest('hex'), cancelToken: 'another-secret',
      });
      assert.equal(replay.replay, true);
      assert.equal(replay.id, created.id);
      assert.equal(replay.cancel_token, 'cancel-secret');

      const order = await ordersRepository.findPublicOrder(created.order_code);
      assert.equal(Number(order.id), Number(created.id));
      const details = await ordersRepository.loadPublicDetails(order.id);
      const history = await ordersRepository.loadStatusHistory(order.id);
      assert.equal(details.length, 1);
      assert.equal(details[0].toppings.length, 1);
      assert.equal(history.at(-1).status, 'Đang chuẩn bị');

      const list = await ordersRepository.listCustomerOrders({ userId: 999999, limit: 20 });
      assert.equal(list.length, 0, 'guest order never appears in a customer history');
    } finally {
      await postgresDb.close();
    }
  });
});
