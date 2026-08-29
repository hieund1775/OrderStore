import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import postgresDb, { getPool } from '../config/db-postgres.js';
import { runMigrations } from '../database/postgres/migrate.js';

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
});
