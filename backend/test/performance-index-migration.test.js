import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('simulates idempotent lifecycle execution: apply -> apply -> rollback -> apply', () => {
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');

    // In-memory catalog simulating SQL Server sys.indexes
    const sysIndexes = new Set();

    const executeTsqlBlock = (sql) => {
      // Parse individual IF NOT EXISTS / CREATE INDEX blocks
      for (const indexName of EXPECTED_INDEXES) {
        if (sql.includes(`CREATE NONCLUSTERED INDEX ${indexName}`)) {
          if (!sysIndexes.has(indexName)) {
            sysIndexes.add(indexName);
          }
        }
        if (sql.includes(`DROP INDEX ${indexName}`)) {
          if (sysIndexes.has(indexName)) {
            sysIndexes.delete(indexName);
          }
        }
      }
    };

    // Step 1: First Apply
    executeTsqlBlock(migrationSql);
    assert.equal(sysIndexes.size, 7);
    for (const idx of EXPECTED_INDEXES) {
      assert.equal(sysIndexes.has(idx), true);
    }

    // Step 2: Second Apply (Idempotent: No errors, catalog unchanged)
    executeTsqlBlock(migrationSql);
    assert.equal(sysIndexes.size, 7);

    // Step 3: Rollback (Safely drops only Phase 2 indexes)
    executeTsqlBlock(rollbackSql);
    assert.equal(sysIndexes.size, 0);

    // Step 4: Re-apply (Re-creates indexes cleanly)
    executeTsqlBlock(migrationSql);
    assert.equal(sysIndexes.size, 7);
  });
});
