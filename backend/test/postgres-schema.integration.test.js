import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { verifyPostgresSchema } from '../database/postgres/verify-schema.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Schema & Migration Integration Suite', () => {
  it('applies migrations zero-to-current, verifies idempotency, schema tables, and check constraints', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping live PostgreSQL schema integration: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to dedicated test DB');
      return;
    }

    // 1. Guard check
    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true);

    const pool = new Pool({ connectionString: testDbUrl });

    try {
      // 2. Apply migrations first time
      const firstRun = await runMigrations({ pool });
      assert.ok(Array.isArray(firstRun));
      assert.ok(firstRun.length >= 3);

      // 3. Apply migrations second time (Idempotency)
      const secondRun = await runMigrations({ pool });
      assert.equal(secondRun.every((m) => m.status === 'already_applied'), true, 'Second migration run must be idempotent');

      // 4. Verify schema completeness
      const schemaReport = await verifyPostgresSchema({ pool });
      assert.equal(schemaReport.is_valid, true, `Missing tables: ${schemaReport.missing_tables.join(', ')}`);
      assert.equal(schemaReport.missing_tables.length, 0);
      assert.ok(schemaReport.total_tables >= 34);

      // 5. Test Check Constraints
      // Negative price rejected
      await pool.query(`INSERT INTO categories (name, slug) VALUES ('Test category', 'test-category') ON CONFLICT (slug) DO NOTHING`);
      await assert.rejects(
        async () => {
          await pool.query(`INSERT INTO products (category_id, name, slug, base_tea, price) VALUES (1, $1, $2, $3, $4)`, ['Invalid Product', 'invalid-product', 'Trà đen', -5000]);
        },
        /chk_products_price|check constraint/i
      );

      // Invalid user role rejected
      await assert.rejects(
        async () => {
          await pool.query(`INSERT INTO users (fullname, phone, is_admin, admin_role) VALUES ($1, $2, true, $3)`, ['Invalid Role User', '0999999999', 'hacker']);
        },
        /check constraint|users_role_check/i
      );

      // Invalid promotion date order (start_date > end_date) rejected
      await assert.rejects(
        async () => {
          await pool.query(`
            INSERT INTO promotions (code, title, type, discount_type, discount_value, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['BAD_DATE', 'Bad Date Promo', 'voucher', 'percent', 10, '2026-12-31', '2026-01-01']);
        },
        /chk_promo_dates|check constraint/i
      );
    } finally {
      await pool.end();
    }
  });
});
