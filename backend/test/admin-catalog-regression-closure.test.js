import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogV2Repository } from '../repositories/postgres/catalog-v2.js';
import { createAdminCatalogV2Repository } from '../repositories/postgres/admin-catalog-v2.js';
import { runProductionCatalogResetPlan } from '../commands/plan-production-catalog-reset.js';

test('archive operations release globally unique catalog identifiers for create-after-delete', async (t) => {
  await t.test('product archive releases its slug without altering its display name', async () => {
    let sql = '';
    const repo = createAdminCatalogV2Repository({
      async query(statement) {
        sql = statement;
        return [[{ id: 44, name: 'Cà phê sữa', slug: 'ca-phe-sua--archived-44', status: 'archived' }]];
      },
    });
    const archived = await repo.archiveProduct(44);
    assert.equal(archived.name, 'Cà phê sữa');
    assert.match(sql, /slug = LEFT\(slug, 170\) \|\| '--archived-' \|\| id::text/);
    assert.match(sql, /status = 'archived'/);
  });

  await t.test('category archive releases both global name and slug identities', async () => {
    let updateSql = '';
    const database = {
      async transaction(callback) {
        return callback({
          async query(statement) {
            if (statement.includes('SELECT * FROM categories')) return [[{ id: 9, name: 'Áo', slug: 'ao' }]];
            if (statement.includes('has_children')) return [[{ has_children: false, has_products: false }]];
            updateSql = statement;
            return [[{ id: 9, name: 'Áo [archived-9]', slug: 'ao--archived-9', archived_at: '2026-09-17T00:00:00Z' }]];
          },
        });
      },
    };
    const archived = await createCatalogV2Repository(database).archiveCategory(9);
    assert.match(archived.slug, /archived-9$/);
    assert.match(updateSql, /name = LEFT\(name, 120\)/);
    assert.match(updateSql, /slug = LEFT\(slug, 120\)/);
  });
});

test('category option-group creation is one rollback-safe transaction', async () => {
  let rolledBack = false;
  const statements = [];
  const database = {
    async transaction(callback) {
      try {
        return await callback({
          async query(statement) {
            statements.push(statement);
            if (statement.includes('FROM categories c')) {
              return [[{ category_id: 7, category_product_type_id: 3, schema_id: 12, schema_product_type_id: 3, schema_status: 'draft' }]];
            }
            if (statement.includes('INSERT INTO attribute_definitions')) return [[{ id: 99, code: 'size', name: 'Size' }]];
            if (statement.includes('INSERT INTO attribute_values')) return [[{ id: 199 }]];
            if (statement.includes('INSERT INTO category_attribute_assignments')) {
              throw new Error('assignment insert failed');
            }
            throw new Error(`unexpected statement: ${statement}`);
          },
        });
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
  };

  await assert.rejects(
    () => createCatalogV2Repository(database).createCategoryOptionGroup(
      7,
      12,
      { code: 'size', name: 'Size', role: 'modifier', input_type: 'multi_select', is_required: false, is_filterable: false, sort_order: 1, min_selections: 0, max_selections: null },
      [{ code: 'm', label: 'M', sort_order: 1, is_active: true, price_adjustment: 0 }],
    ),
    /assignment insert failed/,
  );
  assert.equal(rolledBack, true);
  assert.equal(statements.filter((statement) => statement.includes('INSERT INTO attribute_definitions')).length, 1);
  assert.equal(statements.filter((statement) => statement.includes('INSERT INTO category_attribute_assignments')).length, 1);
});

test('production catalog reset command is dry-run-only and uses a read-only transaction', async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('SELECT')) return { rows: [{ active_categories: 1, active_products: 2 }] };
      return { rows: [] };
    },
    release() {},
  };
  const plan = await runProductionCatalogResetPlan({
    args: ['--dry-run'],
    env: { PRODUCTION_DATABASE_URL: 'postgresql://release:secret@db.example:5432/order', CATALOG_PUBLIC_ORIGIN: 'https://order.example' },
    pool: { async connect() { return client; } },
  });
  assert.equal(plan.mode, 'dry-run-only');
  assert.equal(plan.target, 'postgresql://db.example:5432/order');
  assert.match(plan.replacementCatalog.kitchen.products[0].image, /^https:\/\/order\.example\/catalog\//);
  assert.ok(calls.some((sql) => sql === 'BEGIN READ ONLY'));
  assert.equal(calls.some((sql) => /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(sql)), false);
  await assert.rejects(
    () => runProductionCatalogResetPlan({ args: ['--dry-run', '--apply'], env: {} }),
    /read-only/,
  );
});
