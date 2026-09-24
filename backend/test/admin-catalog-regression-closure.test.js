import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogV2Repository } from '../repositories/postgres/catalog-v2.js';
import { createAdminCatalogV2Repository } from '../repositories/postgres/admin-catalog-v2.js';
import { runProductionCatalogResetPlan } from '../commands/plan-production-catalog-reset.js';

test('archive operations release globally unique catalog identifiers for create-after-delete', async (t) => {
  await t.test('product archive releases its slug and variant SKUs without altering its display name', async () => {
    const statements = [];
    const repo = createAdminCatalogV2Repository({
      async query(statement) {
        statements.push(statement);
        return [[{ id: 44, name: 'Cà phê sữa', slug: 'ca-phe-sua--archived-44', status: 'archived' }]];
      },
    });
    const archived = await repo.archiveProduct(44);
    assert.equal(archived.name, 'Cà phê sữa');
    const productUpdate = statements.find((s) => s.includes('UPDATE products'));
    assert.ok(productUpdate, 'Expected UPDATE products statement');
    assert.match(productUpdate, /slug = LEFT\(slug, 170\) \|\| '--archived-' \|\| id::text/);
    assert.match(productUpdate, /status = 'archived'/);

    const variantUpdate = statements.find((s) => s.includes('UPDATE product_variants'));
    assert.ok(variantUpdate, 'Expected UPDATE product_variants statement to retire SKUs');
    assert.match(variantUpdate, /status = 'archived'/);
    assert.match(variantUpdate, /sku = LEFT\(sku, 60\) \|\| '--archived-' \|\| id::text/);
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

  await t.test('createCategory retires archived duplicate name or slug before insert', async () => {
    const statements = [];
    const database = {
      async transaction(callback) {
        return callback({
          async query(statement, params) {
            statements.push({ statement, params });
            if (statement.includes('INSERT INTO categories')) {
              return [[{ id: 12, name: 'Áo', slug: 'ao', parent_id: 1, depth: 1 }]];
            }
            return [[], 0];
          },
        });
      },
      async query(statement) {
        if (statement.includes('WHERE c.id = $1')) {
          return [[{ id: 1, depth: 0, default_fulfillment_lane: 'kitchen', product_type_id: 10 }]];
        }
        return [[], 0];
      },
    };
    const repo = createCatalogV2Repository(database);
    const created = await repo.createCategory({
      name: 'Áo',
      slug: 'ao',
      parent_id: 1,
    });
    assert.equal(created.id, 12);
    const retireStmt = statements.find((s) => s.statement.includes('UPDATE categories') && s.statement.includes('archived_at IS NOT NULL'));
    assert.ok(retireStmt, 'Expected retiring query for archived categories');
    assert.equal(retireStmt.params[0], 'ao');
    assert.equal(retireStmt.params[1], 1);
    assert.equal(retireStmt.params[2], 'Áo');
  });

  await t.test('createProduct retires archived duplicate slug before insert', async () => {
    const statements = [];
    const database = {
      async transaction(callback) {
        return callback({
          async query(statement, params) {
            statements.push({ statement, params });
            if (statement.includes('SELECT c.*')) {
              return [[{ id: 10, default_fulfillment_lane: 'kitchen', archived_at: null }]];
            }
            if (statement.includes('SELECT 1 FROM categories WHERE parent_id')) {
              return [[]];
            }
            if (statement.includes('INSERT INTO products')) {
              return [[{ id: 99, name: 'Áo Thun', slug: 'ao-thun', price: 50000 }]];
            }
            return [[], 0];
          },
        });
      },
    };
    const repo = createAdminCatalogV2Repository(database);
    const product = await repo.createProduct({
      category_id: 10,
      name: 'Áo Thun',
      slug: 'ao-thun',
      price: 50000,
    });
    assert.equal(product.id, 99);
    const retireStmt = statements.find((s) => s.statement.includes('UPDATE products') && s.statement.includes("status = 'archived'"));
    assert.ok(retireStmt, 'Expected retiring query for archived products');
    assert.equal(retireStmt.params[0], 'ao-thun');
  });

  await t.test('createVariant retires archived duplicate SKU before insert', async () => {
    const statements = [];
    const database = {
      async transaction(callback) {
        return callback({
          async query(statement, params) {
            statements.push({ statement, params });
            if (statement.includes('SELECT * FROM products WHERE id = $1')) {
              return [[{ id: 99, status: 'active', product_type_schema_id: null }]];
            }
            if (statement.includes('INSERT INTO product_variants')) {
              return [[{ id: 201, product_id: 99, sku: 'AO-THUN-XL', status: 'active' }]];
            }
            return [[], 0];
          },
        });
      },
    };
    const repo = createAdminCatalogV2Repository(database);
    const variant = await repo.createVariant(99, {
      sku: 'AO-THUN-XL',
      attribute_values: [],
    });
    assert.equal(variant.sku, 'AO-THUN-XL');
    const retireStmt = statements.find((s) => s.statement.includes('UPDATE product_variants') && s.statement.includes("status = 'archived'"));
    assert.ok(retireStmt, 'Expected retiring query for archived product variants');
    assert.equal(retireStmt.params[0], 'AO-THUN-XL');
  });

  await t.test('createCategory allows identical subcategory names across different root categories and resolves unique slug', async () => {
    const categoriesDb = [
      { id: 97, name: 'Quần Áo', slug: 'quan-ao', parent_id: null, depth: 0, archived_at: null },
      { id: 98, name: 'Áo', slug: 'ao', parent_id: 97, depth: 1, archived_at: null },
      { id: 104, name: 'Quần Áo QA', slug: 'quan-ao-qa', parent_id: null, depth: 0, archived_at: null },
    ];
    let nextId = 200;

    const database = {
      async transaction(callback) {
        return callback({
          async query(statement, params = []) {
            if (statement.includes('SELECT 1 FROM categories WHERE parent_id = $1 AND name = $2 AND archived_at IS NULL')) {
              const found = categoriesDb.find((c) => c.parent_id === params[0] && c.name === params[1] && c.archived_at === null);
              return found ? [[found], 1] : [[], 0];
            }
            if (statement.includes('SELECT 1 FROM categories WHERE slug = $1 AND archived_at IS NULL')) {
              const found = categoriesDb.find((c) => c.slug === params[0] && c.archived_at === null);
              return found ? [[found], 1] : [[], 0];
            }
            if (statement.includes('UPDATE categories')) {
              return [[], 0];
            }
            if (statement.includes('INSERT INTO categories')) {
              const newCat = {
                id: nextId++,
                name: params[0],
                slug: params[1],
                parent_id: params[2],
                depth: params[3],
                archived_at: null,
              };
              categoriesDb.push(newCat);
              return [[newCat], 1];
            }
            return [[], 0];
          },
        });
      },
      async query(statement, params = []) {
        if (statement.includes('WHERE c.id = $1')) {
          const cat = categoriesDb.find((c) => c.id === params[0]);
          return cat ? [[{ ...cat, default_fulfillment_lane: 'kitchen', product_type_id: 10 }], 1] : [[], 0];
        }
        return [[], 0];
      },
    };

    const repo = createCatalogV2Repository(database);

    // Creating subcategory "Áo" under parent 104 ("Quần Áo QA")
    const created = await repo.createCategory({
      name: 'Áo',
      slug: 'ao',
      parent_id: 104,
    });
    assert.equal(created.name, 'Áo');
    // Slug 'ao' was taken by parent 97, so it automatically resolved to 'ao-1'
    assert.equal(created.slug, 'ao-1');
    assert.equal(created.parent_id, 104);

    // Attempting to create duplicate subcategory "Áo" under the SAME parent 104 must fail with 409
    await assert.rejects(
      async () => {
        await repo.createCategory({
          name: 'Áo',
          slug: 'ao',
          parent_id: 104,
        });
      },
      (err) => {
        assert.equal(err.status, 409);
        return true;
      },
    );
  });

  await t.test('createProduct allows identical product names across different categories and auto-resolves unique slug', async () => {
    const productsDb = [
      { id: 1, name: 'Món Chung QA 01', slug: 'mon-chung-qa-01', category_id: 10, status: 'active' },
    ];
    let nextProdId = 2;

    const database = {
      async transaction(callback) {
        return callback({
          async query(statement, params = []) {
            if (statement.includes('SELECT c.*')) {
              return [[{ id: params[0], default_fulfillment_lane: 'kitchen', archived_at: null }]];
            }
            if (statement.includes('SELECT 1 FROM categories WHERE parent_id')) {
              return [[]];
            }
            if (statement.includes("SELECT 1 FROM products WHERE slug = $1 AND status <> 'archived'")) {
              const found = productsDb.find((p) => p.slug === params[0] && p.status !== 'archived');
              return found ? [[found], 1] : [[], 0];
            }
            if (statement.includes('UPDATE products')) {
              return [[], 0];
            }
            if (statement.includes('INSERT INTO products')) {
              const newProd = {
                id: nextProdId++,
                name: params[1],
                slug: params[2],
                category_id: params[0],
                price: params[5],
                status: 'active',
              };
              productsDb.push(newProd);
              return [[newProd], 1];
            }
            if (statement.includes('INSERT INTO product_variants')) {
              return [[{ id: 50, product_id: params[0], sku: params[1], status: 'active' }]];
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createAdminCatalogV2Repository(database);

    // Creating second product with same name and base slug under category 20
    const prod2 = await repo.createProduct({
      category_id: 20,
      name: 'Món Chung QA 01',
      slug: 'mon-chung-qa-01',
      price: 35000,
    });
    assert.equal(prod2.name, 'Món Chung QA 01');
    assert.equal(prod2.slug, 'mon-chung-qa-01-1');
    assert.equal(prod2.category_id, 20);
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
            if (statement.includes('SELECT id, name FROM attribute_definitions')) return [[]];
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
