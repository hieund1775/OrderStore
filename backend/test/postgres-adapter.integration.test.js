import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { postgresDb } from '../config/db-postgres.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Adapter & Transaction Integration Suite', () => {
  it('executes parameterized queries, transactions, and rollbacks on live PostgreSQL', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping live PostgreSQL integration: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to dedicated test DB');
      return;
    }

    // 1. Guard check
    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true);

    try {
      // 2. Simple Parameterized Query Test
      await postgresDb.close();
      const [queryRows] = await postgresDb.query('SELECT $1::int as test_val, $2::text as test_text', [42, 'teaplus']);
      assert.equal(queryRows.length, 1);
      assert.equal(queryRows[0].test_val, 42);
      assert.equal(queryRows[0].test_text, 'teaplus');

      // A stable table is required because pool queries may use different sessions.
      await postgresDb.query('CREATE TABLE IF NOT EXISTS postgres_adapter_check (name TEXT PRIMARY KEY)');
      await postgresDb.query('DELETE FROM postgres_adapter_check');

      // 4. Transaction Commit Test
      await postgresDb.transaction((tx) => tx.query('INSERT INTO postgres_adapter_check (name) VALUES ($1)', ['committed_row']));
      const [commitRows] = await postgresDb.query('SELECT * FROM postgres_adapter_check WHERE name = $1', ['committed_row']);
      assert.equal(commitRows.length, 1);

      // 5. Transaction Rollback Test
      await assert.rejects(() => postgresDb.transaction(async (tx) => {
        await tx.query('INSERT INTO postgres_adapter_check (name) VALUES ($1)', ['rolled_back_row']);
        throw new Error('force rollback');
      }), /force rollback/);
      const [rollbackRows] = await postgresDb.query('SELECT * FROM postgres_adapter_check WHERE name = $1', ['rolled_back_row']);
      assert.equal(rollbackRows.length, 0, 'Rolled back row must not exist');
    } finally {
      await postgresDb.close();
    }
  });
});
