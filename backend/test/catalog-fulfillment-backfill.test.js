import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runCatalogFulfillmentBackfill,
  CATALOG_FULFILLMENT_BACKFILL_RUN_KEY,
} from '../services/catalog/catalog-fulfillment-backfill.js';

function createBackfillDatabase() {
  let completed = false;
  let rootSlug = 'thuc-don';
  const statements = [];

  const connection = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      statements.push({ sql: normalized, params });

      if (normalized.includes('FROM catalog_v2_backfill_runs WHERE name')) {
        return [completed ? [{ exists: 1 }] : []];
      }
      if (normalized.includes("slug IN ('thuc-don', 'nuoc-uong')")) {
        return [[{ id: 1, name: 'Beverages', slug: rootSlug }]];
      }
      if (normalized.startsWith('INSERT INTO category_attribute_assignments')) {
        return [[{ id: 11 }, { id: 12 }, { id: 13 }]];
      }
      if (normalized.includes('FROM attribute_definitions ad')) return [[{ count: 3 }]];
      if (normalized.startsWith('WITH RECURSIVE walk AS')) {
        return [[{ cycle_count: 0, orphan_count: 0 }]];
      }
      if (normalized.includes("FROM products p WHERE p.status = 'active'")) {
        return [[{ count: 0 }]];
      }
      if (normalized.includes('FROM ( SELECT DISTINCT bvo.store_id')) {
        return [[{ count: completed ? 0 : 2 }]];
      }
      if (normalized.includes('COUNT(*) FILTER') && normalized.includes('FROM order_items oi')) {
        return [[{ resolvable: completed ? 0 : 4, unresolved: 0 }]];
      }
      if (normalized.includes("WHERE slug = 'thuc-don'") && normalized.includes('FOR UPDATE')) {
        return [rootSlug === 'thuc-don' ? [{ id: 1 }] : []];
      }
      if (normalized.startsWith('UPDATE categories') && normalized.includes("slug = 'nuoc-uong'")) {
        rootSlug = 'nuoc-uong';
        return [[{ id: 1 }]];
      }
      if (normalized.startsWith('UPDATE categories') && normalized.includes("default_fulfillment_lane = 'kitchen'")) {
        return [[{ id: 1 }]];
      }
      if (normalized.startsWith('UPDATE categories') && normalized.includes("default_fulfillment_lane = 'packing'")) {
        return [[{ id: 10 }]];
      }
      if (normalized.startsWith('INSERT INTO branch_fulfillment_capabilities')) {
        return [[{ id: 21 }, { id: 22 }]];
      }
      if (normalized.startsWith('UPDATE order_items')) {
        return [[{ id: 31 }, { id: 32 }, { id: 33 }, { id: 34 }]];
      }
      if (normalized.startsWith('INSERT INTO fulfillment_tasks')) {
        return [[{ id: 41 }, { id: 42 }]];
      }
      if (normalized.startsWith('INSERT INTO fulfillment_task_items')) {
        return [[{ id: 51 }, { id: 52 }, { id: 53 }, { id: 54 }]];
      }
      if (normalized.startsWith('INSERT INTO catalog_v2_backfill_runs')) {
        completed = true;
        return [[]];
      }
      return [[]];
    },
  };

  return {
    statements,
    query: connection.query.bind(connection),
    async transaction(callback) {
      return callback(connection);
    },
  };
}

test('Catalog Fulfillment Backfill Suite', async (t) => {
  await t.test('dry-run reports planned work without issuing mutations', async () => {
    const database = createBackfillDatabase();
    const summary = await runCatalogFulfillmentBackfill({ dryRun: true, database });

    assert.equal(summary.dryRun, true);
    assert.equal(summary.rootRenamed, true);
    assert.equal(summary.rootId, 1);
    assert.equal(summary.assignedCategoryAttributesCount, 3);
    assert.equal(summary.branchCapabilitiesSeeded, 2);
    assert.equal(summary.orderItemsSnapshotted, 4);
    assert.deepEqual(summary.errors, []);
    assert.equal(
      database.statements.some(({ sql }) => /^(INSERT|UPDATE|DELETE)\b/i.test(sql)),
      false,
    );
  });

  await t.test('apply records the run once and is idempotent', async () => {
    const database = createBackfillDatabase();
    const first = await runCatalogFulfillmentBackfill({ dryRun: false, database });

    assert.equal(first.alreadyApplied, false);
    assert.equal(first.rootId, 1);
    assert.equal(first.aliasCreated, true);
    assert.equal(first.assignedCategoryAttributesCount, 3);
    assert.equal(first.branchCapabilitiesSeeded, 2);
    assert.equal(first.tasksCreated, 2);
    assert.equal(first.taskItemsCreated, 4);

    const second = await runCatalogFulfillmentBackfill({ dryRun: false, database });
    assert.equal(second.alreadyApplied, true);
    assert.equal(second.runKey, CATALOG_FULFILLMENT_BACKFILL_RUN_KEY);

    const auditWrites = database.statements.filter(({ sql }) =>
      sql.startsWith('INSERT INTO catalog_v2_backfill_runs'),
    );
    assert.equal(auditWrites.length, 1);
  });
});
