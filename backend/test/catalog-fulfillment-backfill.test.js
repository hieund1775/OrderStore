import test from 'node:test';
import assert from 'node:assert/strict';
import { runCatalogFulfillmentBackfill, CATALOG_FULFILLMENT_BACKFILL_RUN_KEY } from '../services/catalog/catalog-fulfillment-backfill.js';

test('Catalog Fulfillment Backfill Suite', async (t) => {
  await t.test('dry-run reports root rename and capability seeding without mutating database', async () => {
    const mockDb = {
      async query(sql) {
        if (sql.includes("slug = 'nuoc-uong'")) return [[]];
        if (sql.includes("slug = 'thuc-don'")) return [[{ id: 1, name: 'Thực đơn', slug: 'thuc-don' }]];
        if (sql.includes('default_fulfillment_lane IS NULL')) return [[{ count: 5 }]];
        if (sql.includes('NOT EXISTS')) return [[{ count: 2 }]]; // 2 stores
        return [[]];
      },
    };

    const summary = await runCatalogFulfillmentBackfill({ dryRun: true, database: mockDb });
    assert.equal(summary.dryRun, true);
    assert.equal(summary.rootRenamed, true);
    assert.equal(summary.rootId, 1);
    assert.equal(summary.aliasCreated, true);
    assert.equal(summary.categoriesDefaultLaneSet, 5);
    assert.equal(summary.branchCapabilitiesSeeded, 4); // 2 stores * 2 lanes
  });

  await t.test('runCatalogFulfillmentBackfill applies rename, creates alias, sets lanes and is idempotent', async () => {
    let completed = false;
    const executedQueries = [];

    const mockTx = {
      async query(sql, params = []) {
        executedQueries.push({ sql, params });
        if (sql.includes('catalog_v2_backfill_runs WHERE name')) {
          return [completed ? [{ name: CATALOG_FULFILLMENT_BACKFILL_RUN_KEY }] : []];
        }
        if (sql.includes("slug = 'thuc-don'")) {
          return [[{ id: 1 }]];
        }
        if (sql.includes("slug = 'quan-ao'")) {
          return [[{ id: 10 }]];
        }
        if (sql.includes('UPDATE categories SET default_fulfillment_lane')) {
          return [[{ id: 1 }, { id: 2 }]];
        }
        if (sql.includes('SELECT id FROM stores')) {
          return [[{ id: 1 }]];
        }
        if (sql.includes('INSERT INTO branch_fulfillment_capabilities')) {
          return [[{ id: 101 }]];
        }
        if (sql.includes('INSERT INTO catalog_v2_backfill_runs')) {
          completed = true;
          return [[]];
        }
        return [[]];
      },
    };

    const mockDb = {
      async transaction(cb) {
        return await cb(mockTx);
      },
    };

    // First run (Apply)
    const result1 = await runCatalogFulfillmentBackfill({ dryRun: false, database: mockDb });
    assert.equal(result1.rootRenamed, true);
    assert.equal(result1.rootId, 1);
    assert.equal(result1.aliasCreated, true);
    assert.equal(result1.alreadyApplied, false);

    // Second run (Idempotent)
    const result2 = await runCatalogFulfillmentBackfill({ dryRun: false, database: mockDb });
    assert.equal(result2.alreadyApplied, true);
  });
});
