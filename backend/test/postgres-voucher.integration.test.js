import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import promotionsRepository from '../repositories/postgres/promotions.js';
import { createOnlinePayOSOrder } from '../services/online-payos-order.js';
import { setPayOSForTest } from '../services/payos.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL voucher integration suite', () => {
  it('checks branch eligibility and allows only one concurrent single-use checkout', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const suffix = Date.now() % 1_000_000;
    const code = `ONE-${suffix}`;
    let payosCalls = 0;
    try {
      const [promotions] = await postgresDb.query(
        `INSERT INTO promotions (title, type, code, discount_type, discount_value, voucher_type, min_order, start_date, end_date, is_active)
         VALUES ('One use test', 'voucher', $1, 'percent', 20, 'single_use', 0, CURRENT_DATE - 1, CURRENT_DATE + 1, TRUE)
         RETURNING id`,
        [code],
      );
      await postgresDb.query('INSERT INTO promotion_stores (promotion_id, store_id) VALUES ($1, 1)', [promotions[0].id]);
      await assert.rejects(
        () => promotionsRepository.preview({ code, subtotal: 50000, phone: '0909000011', storeId: 2 }),
        /không tồn tại|không áp dụng/i,
      );

      setPayOSForTest({ paymentRequests: { create: async () => ({ checkoutUrl: 'https://sandbox.payos.test', qrCode: 'qr', paymentLinkId: `voucher-link-${suffix}-${++payosCalls}` }) } });
      const input = {
        source: 'online', payment_method: 'VietQR', store_id: 1,
        customer_name: 'Voucher race', customer_phone: '0909000011', voucher_code: code,
        items: [{ product_id: 1, qty: 1, size_id: 1, topping_ids: [1] }],
      };
      const results = await Promise.allSettled([
        createOnlinePayOSOrder({ input, userId: null, idempotencyKey: `voucher-a-${suffix}` }),
        createOnlinePayOSOrder({ input, userId: null, idempotencyKey: `voucher-b-${suffix}` }),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
      const [orders] = await postgresDb.query('SELECT discount_amount, total FROM orders WHERE voucher_code = $1', [code]);
      assert.equal(orders.length, 1);
      assert.equal(Number(orders[0].discount_amount), 10000);
      assert.equal(Number(orders[0].total), 40000);
      const [usage] = await postgresDb.query('SELECT COUNT(*)::int AS count FROM voucher_usage_history WHERE promotion_id = $1', [promotions[0].id]);
      assert.equal(usage[0].count, 1);
      assert.equal(payosCalls, 1);
    } finally {
      setPayOSForTest();
      await postgresDb.close();
    }
  });
});
