import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe('PostgreSQL P0 payment routing safety', () => {
  it('applies 0024 and enforces new group-child payment invariants', async (t) => {
    if (!enabled || !testDatabaseUrl) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(testDatabaseUrl);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();

    const suffix = Date.now() % 1_000_000;
    try {
      const [migrationRows] = await postgresDb.query(
        "SELECT version, checksum FROM schema_migrations WHERE version = '0024'",
      );
      assert.equal(migrationRows.length, 1);
      assert.match(migrationRows[0].checksum, /^[a-f0-9]{64}$/);

      const [profiles] = await postgresDb.query(
        "SELECT code, purpose, status FROM payment_profiles WHERE code = 'DEFAULT_PROFILE'",
      );
      assert.deepEqual(profiles[0], { code: 'DEFAULT_PROFILE', purpose: 'fallback', status: 'disabled' });

      const [constraints] = await postgresDb.query(
        `SELECT conname, convalidated
         FROM pg_constraint
         WHERE conname IN (
           'chk_group_child_payment_snapshots',
           'chk_group_allocation_payment_snapshots',
           'chk_group_child_has_no_direct_payos_link'
         )
         ORDER BY conname`,
      );
      assert.equal(constraints.length, 3);
      assert.equal(constraints.every((constraint) => constraint.convalidated === false), true);

      const [categories] = await postgresDb.query('SELECT id FROM categories WHERE archived_at IS NULL ORDER BY id ASC LIMIT 1');
      assert.ok(categories[0]?.id);
      const [groups] = await postgresDb.query(
        `INSERT INTO checkout_groups
           (group_code, store_id, payment_profile_code, total_amount)
         VALUES ($1, 1, 'GROUP_CHECKOUT', 50000)
         RETURNING id`,
        [`GRPP0${suffix}`],
      );
      const [orders] = await postgresDb.query(
        `INSERT INTO orders
           (order_code, store_id, order_type, payment_method, payment_status, payment_provider,
            customer_name, customer_phone, subtotal, total, checkout_group_id,
            original_payment_profile_code, group_allocated_amount)
         VALUES ($1, 1, 'Take-away', 'VietQR', 'unpaid', 'payos',
                 'P0 Integration', '0909000096', 50000, 50000, $2, 'NUOC_UONG_DEFAULT', 50000)
         RETURNING id`,
        [`TPP0${suffix}`, groups[0].id],
      );

      await assert.rejects(
        () => postgresDb.query('UPDATE orders SET payos_order_code = $2 WHERE id = $1', [orders[0].id, Number(`8${suffix}`)]),
        /chk_group_child_has_no_direct_payos_link|check constraint/i,
      );

      await assert.rejects(
        () => postgresDb.query(
          `INSERT INTO checkout_group_allocations
             (checkout_group_id, order_id, root_category_id, root_category_name, root_category_slug,
              allocated_subtotal, allocated_discount, allocated_shipping_fee, allocated_total)
           VALUES ($1, $2, $3, 'P0', 'p0', 50000, 0, 0, 50000)`,
          [groups[0].id, orders[0].id, categories[0].id],
        ),
        /chk_group_allocation_payment_snapshots|check constraint/i,
      );
    } finally {
      await postgresDb.close();
    }
  });
});
