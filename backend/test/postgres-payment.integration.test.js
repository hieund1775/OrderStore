import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import { createPaymentsRepository } from '../repositories/postgres/payments.js';
import { createOnlinePayOSOrder } from '../services/online-payos-order.js';
import { setPayOSForTest } from '../services/payos.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const url = process.env.TEST_DATABASE_URL;

describe('PostgreSQL PayOS Integration Suite', () => {
  it('keeps webhook retries, amount checks, and expiry idempotent', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const payments = createPaymentsRepository(postgresDb);
    const suffix = Date.now() % 1_000_000;
    const [rows] = await postgresDb.query(
      `INSERT INTO orders (order_code, store_id, order_type, payment_method, payment_status, payment_provider, customer_name, customer_phone, subtotal, total)
       VALUES ($1, 1, 'Take-away', 'VietQR', 'unpaid', 'payos', 'PayOS Test', '0909000099', 50000, 50000) RETURNING id`,
      [`TPPAY${suffix}`],
    );
    const reserved = await payments.reservePayOSOrder({ orderId: rows[0].id, payosOrderCode: Number(`8${suffix}01`), paymentExpiresAt: new Date(Date.now() + 60_000) });
    await payments.attachPaymentLink({ orderId: rows[0].id, paymentLinkId: `link-${suffix}`, payosOrderCode: reserved.payos_order_code, paymentExpiresAt: reserved.payment_expires_at });
    const paid = await payments.processSuccessfulWebhook({ eventKey: `event-${suffix}`, orderCode: reserved.payos_order_code, amount: 50000, reference: `ref-${suffix}`, paymentLinkId: `link-${suffix}` });
    assert.equal(paid.kind, 'paid');
    assert.equal((await payments.processSuccessfulWebhook({ eventKey: `event-${suffix}`, orderCode: reserved.payos_order_code, amount: 50000, paymentLinkId: `link-${suffix}` })).kind, 'duplicate');
    const status = await payments.findStatusByOrderCode(`TPPAY${suffix}`);
    assert.equal(status.payment_status, 'paid');

    const [mismatchRows] = await postgresDb.query(
      `INSERT INTO orders (order_code, store_id, order_type, payment_method, payment_status, payment_provider, customer_name, customer_phone, subtotal, total)
       VALUES ($1, 1, 'Take-away', 'VietQR', 'unpaid', 'payos', 'PayOS Test', '0909000098', 50000, 50000) RETURNING id`,
      [`TPMIS${suffix}`],
    );
    const mismatchCode = Number(`7${suffix}01`);
    await payments.reservePayOSOrder({ orderId: mismatchRows[0].id, payosOrderCode: mismatchCode, paymentExpiresAt: new Date(Date.now() + 60_000) });
    const mismatch = await payments.processSuccessfulWebhook({ eventKey: `mismatch-${suffix}`, orderCode: mismatchCode, amount: 40000 });
    assert.equal(mismatch.kind, 'amount_mismatch');
    const [eventRows] = await postgresDb.query(
      'SELECT processing_status, error_code FROM payment_events WHERE provider_event_key = $1',
      [`mismatch-${suffix}`],
    );
    assert.deepEqual(eventRows[0], { processing_status: 'ignored', error_code: 'AMOUNT_MISMATCH' });

    const [expiredRows] = await postgresDb.query(
      `INSERT INTO orders (order_code, store_id, order_type, payment_method, payment_status, payment_provider, payment_expires_at, customer_name, customer_phone, subtotal, total)
       VALUES ($1, 1, 'Take-away', 'VietQR', 'unpaid', 'payos', CURRENT_TIMESTAMP - INTERVAL '1 minute', 'PayOS Test', '0909000097', 50000, 50000) RETURNING id`,
      [`TPEXP${suffix}`],
    );
    await payments.expireUnpaidPayOSOrders(1000);
    await payments.expireUnpaidPayOSOrders(1000);
    const [expiredStatus] = await postgresDb.query('SELECT payment_status FROM orders WHERE id = $1', [expiredRows[0].id]);
    assert.equal(expiredStatus[0].payment_status, 'expired');
    await postgresDb.close();
  });

  it('creates one PostgreSQL order for an idempotent PayOS checkout retry', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    let calls = 0;
    const suffix = Date.now();
    setPayOSForTest({ paymentRequests: { create: async () => ({ checkoutUrl: 'https://sandbox.payos.test', qrCode: 'qr', paymentLinkId: `link-${suffix}-${++calls}` }) } });
    const input = { source: 'online', payment_method: 'VietQR', store_id: 1, customer_name: 'Idempotent test', customer_phone: '0909000088', items: [{ product_id: 1, qty: 1, size_id: 1, topping_ids: [] }] };
    const key = `payos-${suffix}`;
    try {
      const first = await createOnlinePayOSOrder({ input, userId: null, idempotencyKey: key });
      const retry = await createOnlinePayOSOrder({ input, userId: null, idempotencyKey: key });
      assert.equal(first.id, retry.id);
      assert.equal(calls, 1);
      assert.ok(first.checkout_url);
    } finally {
      setPayOSForTest();
      await postgresDb.close();
    }
  });
});
