import test from 'node:test';
import assert from 'node:assert/strict';
import { runCatalogV2Backfill } from '../services/catalog/catalog-v2-backfill.js';

test('Catalog V2 Backfill: dry-run reports unmigrated products without mutating database', async () => {
  const fakeDb = {
    async query(sql) {
      if (sql.includes('COUNT(*)::int AS count')) {
        return [[{ count: 12 }]];
      }
      return [[]];
    },
  };

  const summary = await runCatalogV2Backfill({ dryRun: true, database: fakeDb });
  assert.equal(summary.dryRun, true);
  assert.equal(summary.productsMigrated, 12);
  assert.equal(summary.productTypeCreated, false);
});
