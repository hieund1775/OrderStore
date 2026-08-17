import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Performance Index Migration & Rollback Suite', () => {
  const migrationPath = path.resolve(__dirname, '../database/phase-2-performance-indexes.sql');
  const rollbackPath = path.resolve(__dirname, '../database/phase-2-performance-indexes-rollback.sql');

  const EXPECTED_INDEXES = [
    'IX_orders_store_payment_created',
    'IX_orders_payment_expiry',
    'IX_orders_user_created',
    'IX_order_status_history_order_created',
    'IX_order_items_order_id',
    'IX_order_item_toppings_item_id',
    'IX_voucher_usage_promotion_phone',
  ];

  it('verifies migration script exists and defines all 7 indexes with IF NOT EXISTS guards', () => {
    assert.equal(fs.existsSync(migrationPath), true);
    const content = fs.readFileSync(migrationPath, 'utf-8');

    for (const indexName of EXPECTED_INDEXES) {
      assert.ok(content.includes(indexName), `Missing index ${indexName} in migration`);
      assert.ok(
        content.includes(`IF NOT EXISTS (`) && content.includes(`'${indexName}'`),
        `Missing IF NOT EXISTS guard for ${indexName}`
      );
    }

    // Safety checks: no DROP DATABASE or DROP TABLE
    assert.equal(/DROP\s+DATABASE/i.test(content), false);
    assert.equal(/DROP\s+TABLE/i.test(content), false);
  });

  it('verifies rollback script exists and defines IF EXISTS guards for all 7 indexes', () => {
    assert.equal(fs.existsSync(rollbackPath), true);
    const content = fs.readFileSync(rollbackPath, 'utf-8');

    for (const indexName of EXPECTED_INDEXES) {
      assert.ok(content.includes(indexName), `Missing index ${indexName} in rollback`);
      assert.ok(
        content.includes(`DROP INDEX ${indexName}`),
        `Missing DROP INDEX for ${indexName}`
      );
      assert.ok(
        content.includes(`IF EXISTS (`) && content.includes(`'${indexName}'`),
        `Missing IF EXISTS guard for ${indexName}`
      );
    }

    // Safety checks: no DROP DATABASE or DROP TABLE
    assert.equal(/DROP\s+DATABASE/i.test(content), false);
    assert.equal(/DROP\s+TABLE/i.test(content), false);
  });

  it('executes real SQL Server migration lifecycle: apply -> idempotent apply -> rollback -> re-apply against sys.indexes', async () => {
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');

    const querySysIndexesCount = async () => {
      const placeholders = EXPECTED_INDEXES.map(() => '?').join(', ');
      const [rows] = await db.query(
        `SELECT name FROM sys.indexes WHERE name IN (${placeholders})`,
        EXPECTED_INDEXES
      );
      return rows ? rows.length : 0;
    };

    // Step 1: Initial Apply
    await db.query(migrationSql);
    const countAfterFirstApply = await querySysIndexesCount();
    assert.equal(countAfterFirstApply, 7, 'All 7 performance indexes must exist after migration apply');

    // Step 2: Idempotent Re-apply (must succeed without errors or duplicate index failures)
    await db.query(migrationSql);
    const countAfterSecondApply = await querySysIndexesCount();
    assert.equal(countAfterSecondApply, 7, 'All 7 indexes must still exist cleanly after idempotent re-apply');

    // Step 3: Rollback (must remove all 7 indexes cleanly)
    await db.query(rollbackSql);
    const countAfterRollback = await querySysIndexesCount();
    assert.equal(countAfterRollback, 0, 'All 7 performance indexes must be dropped during rollback');

    // Step 4: Re-apply migration to restore performance indexes for system operations
    await db.query(migrationSql);
    const countAfterFinalApply = await querySysIndexesCount();
    assert.equal(countAfterFinalApply, 7, 'All 7 indexes must be successfully restored on final apply');
  });
});
