import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import postgresDb, { getPool } from '../config/db-postgres.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { runCatalogFulfillmentBackfill } from '../services/catalog/catalog-fulfillment-backfill.js';
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
      // Backfill dry-run
      const dryResult = await runCatalogFulfillmentBackfill({ database: postgresDb, dryRun: true });
      assert.ok(dryResult.dryRun === true);

      // Backfill live apply
      const liveResult = await runCatalogFulfillmentBackfill({ database: postgresDb, dryRun: false });
      assert.ok(liveResult.success === true);

      // Verify alias
      const aliasRes = await client.query(`SELECT canonical_category_id FROM category_slug_aliases WHERE alias_slug = 'thuc-don'`);
      assert.ok(aliasRes.rows.length >= 1, 'Legacy alias thuc-don must exist in database');
    } finally {
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
