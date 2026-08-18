import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import ordersRepository from '../repositories/postgres/orders.js';
import { hashOrderRequest } from '../services/order-idempotency.js';
import { evaluateOrderTransition } from '../services/order-transition-policy.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL public order concurrency', () => {
  it('deduplicates simultaneous create retries and records one cancellation transition', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const suffix = Date.now() % 1_000_000;
    const request = {
      source: 'online', payment_method: 'COD', store_id: 1, order_type: 'Take-away',
      customer_name: 'Concurrency test', customer_phone: `091${String(suffix).padStart(7, '0').slice(-7)}`,
      items: [{ product_id: 1, qty: 1, size_id: 1, topping_ids: [1] }],
    };
    const token = `cancel-${suffix}`;
    const key = `order-concurrent-${suffix}`;
    const args = {
      input: request, idempotencyKey: key, requestHash: hashOrderRequest(request), paymentProvider: 'cod',
      cancelToken: token, cancelTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    };
    try {
      const createResults = await Promise.all([ordersRepository.createPublicOrder(args), ordersRepository.createPublicOrder(args)]);
      assert.equal(createResults.filter((result) => !result.replay).length, 1);
      assert.equal(new Set(createResults.map((result) => String(result.id))).size, 1);
      const order = createResults[0];
      const cancelled = await Promise.all([
        ordersRepository.cancelCustomerOrder({ identifier: order.id, cancelToken: token, evaluateTransition: evaluateOrderTransition }),
        ordersRepository.cancelCustomerOrder({ identifier: order.id, cancelToken: token, evaluateTransition: evaluateOrderTransition }),
      ]);
      assert.equal(cancelled.filter((result) => !result.already_cancelled).length, 1);
      const history = await ordersRepository.loadStatusHistory(order.id);
      assert.equal(history.filter((entry) => entry.status === 'Đã hủy').length, 1);
    } finally {
      await postgresDb.close();
    }
  });
});
