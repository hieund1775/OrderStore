import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Demo Seed & Integrity Integration Suite', () => {
  it('seeds deterministic demo dataset and verifies relational counts and integrity', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping live PostgreSQL seed integration: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to dedicated test DB');
      return;
    }

    // 1. Guard check
    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true);

    const pool = new Pool({ connectionString: testDbUrl });

    try {
      // 2. Ensure migrations applied first
      await runMigrations({ pool });

      // 3. Seed demo data
      const seedResult = await seedDemoData({ pool });
      assert.ok(seedResult.stores >= 2);
      assert.ok(seedResult.products >= 4);
      assert.ok(seedResult.users >= 5);

      // 4. Verify query against PostgreSQL tables
      const storeCountRes = await pool.query('SELECT COUNT(*)::int as cnt FROM stores WHERE is_active = true');
      assert.ok(storeCountRes.rows[0].cnt >= 2);

      const productCountRes = await pool.query('SELECT COUNT(*)::int as cnt FROM products WHERE is_available = true');
      assert.ok(productCountRes.rows[0].cnt >= 4);

      const userRoleRes = await pool.query('SELECT admin_role, COUNT(*)::int as cnt FROM users WHERE admin_role IS NOT NULL GROUP BY admin_role');
      const roles = userRoleRes.rows.map((r) => r.admin_role);
      assert.ok(roles.includes('super'));
      assert.ok(roles.includes('manager'));
    } finally {
      await pool.end();
    }
  });
});
