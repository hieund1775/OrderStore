import test from 'node:test';
import assert from 'node:assert/strict';
import { runCatalogV2Backfill, runRootCategoryReparentBackfill } from '../services/catalog/catalog-v2-backfill.js';

test('Catalog V2 Backfill Suite', async (t) => {
  await t.test('dry-run reports unmigrated products and categories to reparent without mutating database', async () => {
    const fakeDb = {
      async query(sql, params) {
        if (sql.includes('COUNT(*)::int AS count FROM products')) {
          return [[{ count: 12 }]];
        }
        if (sql.includes("code = 'beverage'")) {
          return [[{ id: 1 }]];
        }
        if (sql.includes('FROM categories c')) {
          return [[
            { id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay', depth: 0, parent_id: null },
            { id: 3, name: 'Trà sữa', slug: 'tra-sua', depth: 0, parent_id: null },
          ]];
        }
        if (sql.includes("slug = 'thuc-don'")) {
          return [[]]; // 'thuc-don' does not exist yet
        }
        return [[]];
      },
    };

    const summary = await runCatalogV2Backfill({ dryRun: true, database: fakeDb });
    assert.equal(summary.dryRun, true);
    assert.equal(summary.productsMigrated, 12);
    assert.equal(summary.productTypeCreated, false);
    assert.ok(summary.reparentSummary);
    assert.equal(summary.reparentSummary.categoriesToReparent, 2);
    assert.equal(summary.reparentSummary.rootCategoryCreated, true);
  });

  await t.test('runRootCategoryReparentBackfill: moves depth 0 categories under thuc-don root and writes audit', async () => {
    const executedQueries = [];
    const fakeTx = {
      async query(sql, params) {
        executedQueries.push({ sql, params });
        if (sql.includes('catalog_v2_backfill_runs WHERE name = $1')) {
          return [[]]; // not applied
        }
        if (sql.includes("code = 'beverage'")) {
          return [[{ id: 1 }]];
        }
        if (sql.includes('FROM categories c')) {
          return [[
            { id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay', depth: 0, parent_id: null },
          ]];
        }
        if (sql.includes("slug = 'thuc-don'")) {
          return [[]]; // not exists
        }
        if (sql.includes('INSERT INTO categories')) {
          return [[{ id: 99 }]]; // created root
        }
        if (sql.includes('INSERT INTO catalog_category_reparent_history')) {
          return [[]];
        }
        if (sql.includes('UPDATE categories')) {
          return [[]];
        }
        return [[]];
      },
    };

    const fakeDb = {
      async transaction(cb) {
        return cb(fakeTx);
      },
    };

    const summary = await runRootCategoryReparentBackfill({ dryRun: false, database: fakeDb });
    assert.equal(summary.rootCategoryCreated, true);
    assert.equal(summary.rootCategoryId, 99);
    assert.equal(summary.categoriesReparented, 1);
    assert.equal(summary.alreadyApplied, false);

    // Verify audit insert happened
    const auditInsert = executedQueries.find((q) =>
      q.sql.includes('INSERT INTO catalog_category_reparent_history'),
    );
    assert.ok(auditInsert, 'Must insert into catalog_category_reparent_history');
    assert.equal(auditInsert.params[0], 'legacy-root-category-navigation-v1');
    assert.equal(auditInsert.params[1], 99); // root_category_id
    assert.equal(auditInsert.params[2], 2); // category_id
    assert.equal(auditInsert.params[4], 0); // old_depth
    assert.match(executedQueries[0].sql, /pg_advisory_xact_lock/);
    assert.deepEqual(executedQueries[0].params, ['legacy-root-category-navigation-v1']);
  });

  await t.test('runRootCategoryReparentBackfill: idempotent when already applied', async () => {
    const fakeTx = {
      async query(sql) {
        if (sql.includes('SELECT 1 FROM catalog_v2_backfill_runs WHERE name = $1')) {
          return [[{ '?column?': 1 }]]; // already applied
        }
        return [[]];
      },
    };

    const fakeDb = {
      async transaction(cb) {
        return cb(fakeTx);
      },
    };

    const summary = await runRootCategoryReparentBackfill({ dryRun: false, database: fakeDb });
    assert.equal(summary.alreadyApplied, true);
    assert.equal(summary.categoriesReparented, 0);
  });

  await t.test('dry-run does not reparent unrelated roots when beverage type is missing', async () => {
    let categoryQueryExecuted = false;
    const fakeDb = {
      async query(sql) {
        if (sql.includes("code = 'beverage'")) return [[]];
        if (sql.includes('FROM categories c')) categoryQueryExecuted = true;
        return [[]];
      },
    };

    const summary = await runRootCategoryReparentBackfill({ dryRun: true, database: fakeDb });
    assert.equal(summary.categoriesToReparent, 0);
    assert.equal(categoryQueryExecuted, false);
    assert.equal(summary.errors.length, 1);
  });
});
