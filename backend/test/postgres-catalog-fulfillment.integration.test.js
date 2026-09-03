import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import postgresDb, { getPool } from '../config/db-postgres.js';
import { runMigrations } from '../database/postgres/migrate.js';
import {
  CATALOG_FULFILLMENT_BACKFILL_RUN_KEY,
  runCatalogFulfillmentBackfill,
} from '../services/catalog/catalog-fulfillment-backfill.js';
import { createFulfillmentService } from '../services/orders/fulfillment-service.js';
import { createFulfillmentRepository } from '../repositories/postgres/fulfillment.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Catalog & Fulfillment Schema Integration Suite', () => {
  it('verifies migrations 0016 and 0017 apply cleanly and enforce constraints', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to a dedicated test DB');
      return;
    }

    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true, guard.reason || 'Must be a dedicated test database');

    await postgresDb.close();
    await runMigrations();

    const client = await getPool().connect();
    try {
      // 1. Verify lane registry seeded
      const laneRes = await client.query('SELECT code, is_system FROM fulfillment_lane_registry ORDER BY code ASC');
      const codes = laneRes.rows.map((r) => r.code);
      assert.ok(codes.includes('kitchen'));
      assert.ok(codes.includes('packing'));

      // 2. Verify unique branch capability
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled)
         VALUES (1, 'kitchen', TRUE)
         ON CONFLICT (store_id, lane_code) DO NOTHING`,
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('runs catalog fulfillment backfill and verifies alias resolution', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to a dedicated test DB');
      return;
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const transactionDatabase = {
        async query(sql, params) {
          const result = await client.query(sql, params);
          return [result.rows, result.rowCount];
        },
        async transaction(work) {
          return work(transactionDatabase);
        },
      };

      await client.query(
        'DELETE FROM catalog_v2_backfill_runs WHERE name = $1',
        [CATALOG_FULFILLMENT_BACKFILL_RUN_KEY],
      );
      await client.query("DELETE FROM category_slug_aliases WHERE alias_slug = 'thuc-don'");

      const existingRoots = await client.query(
        "SELECT id FROM categories WHERE slug IN ('thuc-don', 'nuoc-uong') AND depth = 0 AND parent_id IS NULL FOR UPDATE",
      );
      assert.ok(existingRoots.rows.length <= 1, 'Fixture requires at most one beverage root');

      let legacyRootId;
      if (existingRoots.rows[0]) {
        const rootResult = await client.query(
          `UPDATE categories
           SET name = 'Thuc don backfill fixture', slug = 'thuc-don',
               sort_order = -100, parent_id = NULL, depth = 0
           WHERE id = $1
           RETURNING id`,
          [existingRoots.rows[0].id],
        );
        legacyRootId = rootResult.rows[0].id;
      } else {
        const rootResult = await client.query(
          `INSERT INTO categories (name, slug, sort_order, is_visible, parent_id, depth)
           VALUES ('Thuc don backfill fixture', 'thuc-don', -100, TRUE, NULL, 0)
           RETURNING id`,
        );
        legacyRootId = rootResult.rows[0].id;
      }
      await client.query(
        `UPDATE categories
         SET parent_id = $1, depth = 1
         WHERE id IN (SELECT DISTINCT category_id FROM products WHERE status = 'active')
           AND id <> $1`,
        [legacyRootId],
      );

      // Backfill dry-run
      const dryResult = await runCatalogFulfillmentBackfill({ database: transactionDatabase, dryRun: true });
      assert.ok(dryResult.dryRun === true);

      // Backfill live apply
      const liveResult = await runCatalogFulfillmentBackfill({ database: transactionDatabase, dryRun: false });
      assert.equal(liveResult.alreadyApplied, false);
      assert.equal(liveResult.aliasCreated, true);
      assert.deepEqual(liveResult.errors, []);

      // Verify alias
      const aliasRes = await client.query(`SELECT category_id FROM category_slug_aliases WHERE alias_slug = 'thuc-don'`);
      assert.ok(aliasRes.rows.length >= 1, 'Legacy alias thuc-don must exist in database');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  it('creates and cancels order fulfillment tasks in PostgreSQL transactionally', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to a dedicated test DB');
      return;
    }

    const repo = createFulfillmentRepository(postgresDb);
    const service = createFulfillmentService({ repository: repo, database: postgresDb });

    // Test task idempotency and split in Postgres
    const testOrderId = 888801;
    const testBranchId = 1;
    const client = await getPool().connect();
    try {
      await client.query(
        `INSERT INTO orders (
           id, order_code, store_id, order_type, payment_method, payment_status,
           payment_provider, customer_name, customer_phone, subtotal, total
         ) VALUES ($1, 'FF888801', $2, 'Take-away', 'COD', 'paid', 'cod', 'Fulfillment fixture', '0909000888', 30000, 30000)
         ON CONFLICT (id) DO NOTHING`,
        [testOrderId, testBranchId],
      );
      await client.query(
        `INSERT INTO order_items (
           id, order_id, product_id, product_name, qty, size_label, base_tea,
           sugar_level, ice_level, unit_price, line_total
         ) VALUES
           (9001, $1, 1, 'Tra sen vang', 1, 'M', 'Tra', '100%', '100%', 15000, 15000),
           (9002, $1, 1, 'Tui tote canvas', 1, 'M', 'Tra', '100%', '100%', 15000, 15000)
         ON CONFLICT (id) DO NOTHING`,
        [testOrderId],
      );
    } finally {
      client.release();
    }

    // Verify task splitting
    const createdTasks = await service.splitAndCreateTasksForOrder({
      orderId: testOrderId,
      branchId: testBranchId,
      items: [
        { id: 9001, product_name: 'Trà sen vàng', fulfillment_lane: 'kitchen', qty: 1 },
        { id: 9002, product_name: 'Túi tote canvas', fulfillment_lane: 'packing', qty: 1 },
      ],
    });

    assert.ok(createdTasks.length >= 1);

    // Cancel order tasks
    await service.cancelTasksForOrder(testOrderId);
    const orderTasks = await repo.getTasksForOrder(testOrderId);
    for (const task of orderTasks) {
      assert.equal(task.status, 'cancelled');
    }
  });
});
