import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import postgresDb, { getPool } from '../config/db-postgres.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import { createPublicCatalogV2Repository } from '../repositories/postgres/public-catalog-v2.js';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Root Category Navigation Integration Suite', () => {
  it('keeps sections and subtree pagination correct on a live three-level catalog', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to a dedicated test DB');
      return;
    }

    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true, guard.reason || 'PostgreSQL integration target must be a dedicated test database');

    await postgresDb.close();
    await runMigrations();
    await seedDemoData();

    const client = await getPool().connect();
    await client.query('BEGIN');

    let queryCount = 0;
    const database = {
      async query(sql, params = []) {
        queryCount += 1;
        const result = await client.query(sql, params);
        return [result.rows, result.rowCount ?? 0];
      },
    };

    try {
      const insertCategory = async ({ name, slug, parentId = null, depth, sortOrder, visible = true }) => {
        const result = await client.query(
          `INSERT INTO categories (name, slug, parent_id, depth, sort_order, is_visible)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [name, slug, parentId, depth, sortOrder, visible],
        );
        return Number(result.rows[0].id);
      };

      const rootId = await insertCategory({
        name: 'Catalog Acceptance Root', slug: 'catalog-acceptance-root', depth: 0, sortOrder: 900,
      });
      const emptyRootId = await insertCategory({
        name: 'Catalog Acceptance Empty', slug: 'catalog-acceptance-empty', depth: 0, sortOrder: 901,
      });
      const intermediateId = await insertCategory({
        name: 'Catalog Acceptance Intermediate', slug: 'catalog-acceptance-intermediate', parentId: rootId, depth: 1, sortOrder: 1,
      });
      const siblingLeafId = await insertCategory({
        name: 'Catalog Acceptance Sibling', slug: 'catalog-acceptance-sibling', parentId: rootId, depth: 1, sortOrder: 2,
      });
      const hiddenLeafId = await insertCategory({
        name: 'Catalog Acceptance Hidden', slug: 'catalog-acceptance-hidden', parentId: rootId, depth: 1, sortOrder: 3, visible: false,
      });
      const deepLeafId = await insertCategory({
        name: 'Catalog Acceptance Deep', slug: 'catalog-acceptance-deep', parentId: intermediateId, depth: 2, sortOrder: 1,
      });

      const insertProduct = async (categoryId, name, slug) => {
        const result = await client.query(
          `INSERT INTO products (
             category_id, name, slug, base_tea, price, is_available, status, fulfillment_lane, stock_mode
           ) VALUES ($1, $2, $3, 'acceptance', 10000, TRUE, 'active', 'packing', 'made_to_order')
           RETURNING id`,
          [categoryId, name, slug],
        );
        return Number(result.rows[0].id);
      };

      const insertVariant = async (productId, suffix, withOffer = true) => {
        const result = await client.query(
          `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING id`,
          [productId, `ACCEPT-${productId}-${suffix}`, suffix, suffix],
        );
        const variantId = Number(result.rows[0].id);
        if (withOffer) {
          await client.query(
            `INSERT INTO branch_variant_offers (store_id, variant_id, price, is_available)
             VALUES (1, $1, $2, TRUE)`,
            [variantId, suffix === 'second' ? 12000 : 10000],
          );
        }
        return variantId;
      };

      const deepProductId = await insertProduct(deepLeafId, 'Acceptance Deep Product', 'acceptance-deep-product');
      await insertVariant(deepProductId, 'default');
      await insertVariant(deepProductId, 'second');

      const siblingProductId = await insertProduct(siblingLeafId, 'Acceptance Sibling Product', 'acceptance-sibling-product');
      await insertVariant(siblingProductId, 'default');

      const hiddenProductId = await insertProduct(hiddenLeafId, 'Acceptance Hidden Product', 'acceptance-hidden-product');
      await insertVariant(hiddenProductId, 'default');

      const missingOfferProductId = await insertProduct(deepLeafId, 'Acceptance Missing Offer', 'acceptance-missing-offer');
      await insertVariant(missingOfferProductId, 'default', false);

      const repository = createPublicCatalogV2Repository(database);
      const service = createPublicCatalogV2Service({ catalogRepository: repository });

      queryCount = 0;
      const sections = await service.getSections({ storeId: 1, limitPerRoot: 1 });
      assert.equal(queryCount, 1, 'Grouped sections must use one fixed-count SQL query');

      const rootSection = sections.find((section) => section.root_id === rootId);
      const emptySection = sections.find((section) => section.root_id === emptyRootId);
      assert.ok(rootSection);
      assert.equal(rootSection.total_products, 2);
      assert.equal(rootSection.products.length, 1);
      assert.deepEqual(
        rootSection.children.map((child) => child.slug),
        ['catalog-acceptance-intermediate', 'catalog-acceptance-sibling'],
      );
      assert.ok(emptySection);
      assert.equal(emptySection.total_products, 0);
      assert.deepEqual(emptySection.products, []);

      const firstPage = await service.listSubtreeProducts({
        storeId: 1, categorySlug: 'catalog-acceptance-root', limit: 1, offset: 0,
      });
      const secondPage = await service.listSubtreeProducts({
        storeId: 1, categorySlug: 'catalog-acceptance-root', limit: 1, offset: 1,
      });
      assert.equal(firstPage.total, 2);
      assert.equal(secondPage.total, 2);
      assert.equal(firstPage.products.length, 1);
      assert.equal(secondPage.products.length, 1);
      assert.notEqual(firstPage.products[0].id, secondPage.products[0].id);

      const deepLeaf = await service.listSubtreeProducts({
        storeId: 1, categorySlug: 'catalog-acceptance-deep', limit: 10, offset: 0,
      });
      assert.equal(deepLeaf.total, 1, 'Products without a branch offer must fail closed');
      assert.deepEqual(deepLeaf.products.map((product) => Number(product.id)), [deepProductId]);

      await assert.rejects(
        () => service.listSubtreeProducts({
          storeId: 1, categorySlug: 'catalog-acceptance-unknown', limit: 10, offset: 0,
        }),
        (error) => error.status === 404,
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await postgresDb.close();
    }
  });
});
