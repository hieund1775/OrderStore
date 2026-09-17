#!/usr/bin/env node
/**
 * Read-only production Catalog reset/seed rehearsal.
 *
 * This command intentionally has no apply mode. It gives operations the exact
 * replacement manifest and a dependency count before a separately reviewed,
 * manually executed production change is ever considered.
 */
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { getPostgresPoolConfig } from '../config/db-postgres.js';

const { Pool } = pg;

export const replacementCatalog = Object.freeze({
  kitchen: {
    productType: { code: 'beverage', name: 'Đồ uống', stockMode: 'made_to_order' },
    categories: [
      { name: 'Trà trái cây', slug: 'tra-trai-cay' },
      { name: 'Trà sữa', slug: 'tra-sua' },
      { name: 'Cà phê', slug: 'ca-phe' },
    ],
    products: [
      { name: 'Trà đào cam sả', slug: 'tra-dao-cam-sa', categorySlug: 'tra-trai-cay', price: 39000, image: '/catalog/tra-dao-cam-sa.png' },
      { name: 'Trà sữa Ô long', slug: 'tra-sua-olong', categorySlug: 'tra-sua', price: 42000, image: '/catalog/tra-sua-olong.png' },
      { name: 'Cà phê sữa', slug: 'ca-phe-sua', categorySlug: 'ca-phe', price: 29000, image: '/catalog/ca-phe-sua.png' },
    ],
  },
  packing: {
    productType: { code: 'packaged_goods', name: 'Hàng đóng gói', stockMode: 'tracked' },
    categories: [
      { name: 'Snack', slug: 'snack' },
      { name: 'Phụ kiện', slug: 'phu-kien' },
    ],
    products: [
      { name: 'Hạt dinh dưỡng', slug: 'hat-dinh-duong', categorySlug: 'snack', price: 45000, image: '/catalog/hat-dinh-duong.png' },
      { name: 'Ly giữ nhiệt', slug: 'ly-giu-nhiet', categorySlug: 'phu-kien', price: 99000, image: '/catalog/ly-giu-nhiet.png' },
    ],
  },
});

function parseArgs(args) {
  const hasDryRun = args.includes('--dry-run');
  const hasMutationFlag = args.some((arg) => ['--apply', '--execute', '--confirm-production-reset'].includes(arg));
  if (!hasDryRun || hasMutationFlag) {
    throw new Error('This command is read-only. Run only with --dry-run; apply/execute flags are rejected.');
  }
}

function redactTarget(connectionString) {
  const url = new URL(connectionString);
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
}

function withAbsoluteImages(publicOrigin) {
  if (!publicOrigin) return { catalog: replacementCatalog, warnings: ['CATALOG_PUBLIC_ORIGIN is not set; image paths are relative only.'] };
  const origin = new URL(publicOrigin).origin;
  const catalog = Object.fromEntries(Object.entries(replacementCatalog).map(([lane, data]) => [lane, {
    ...data,
    products: data.products.map((product) => ({ ...product, image: new URL(product.image, origin).toString() })),
  }]));
  return { catalog, warnings: [] };
}

/** Runs only SELECT statements inside a READ ONLY transaction. */
export async function runProductionCatalogResetPlan({ args = process.argv.slice(2), env = process.env, pool = null } = {}) {
  parseArgs(args);
  const productionUrl = env.PRODUCTION_DATABASE_URL;
  if (!productionUrl) throw new Error('PRODUCTION_DATABASE_URL is required for a production catalog dry run.');

  const ownPool = !pool;
  const activePool = pool || new Pool(getPostgresPoolConfig(productionUrl, { env: { ...env, NODE_ENV: 'production' } }));
  const client = await activePool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM categories WHERE archived_at IS NULL) AS active_categories,
        (SELECT COUNT(*)::int FROM products WHERE status <> 'archived') AS active_products,
        (SELECT COUNT(*)::int FROM product_types WHERE archived_at IS NULL) AS active_product_types,
        (SELECT COUNT(*)::int FROM product_type_schemas) AS schemas,
        (SELECT COUNT(*)::int FROM attribute_definitions) AS attributes,
        (SELECT COUNT(*)::int FROM attribute_values) AS attribute_values,
        (SELECT COUNT(*)::int FROM product_variants WHERE status <> 'archived') AS active_variants,
        (SELECT COUNT(*)::int FROM product_media) AS product_media,
        (SELECT COUNT(*)::int FROM category_attribute_assignments) AS category_option_assignments,
        (SELECT COUNT(*)::int FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.status <> 'archived') AS active_catalog_order_items,
        (SELECT COUNT(*)::int FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.status <> 'archived') AS active_catalog_reviews,
        (SELECT COUNT(*)::int FROM wishlists w JOIN products p ON p.id = w.product_id WHERE p.status <> 'archived') AS active_catalog_wishlists
    `);
    await client.query('ROLLBACK');
    const manifest = withAbsoluteImages(env.CATALOG_PUBLIC_ORIGIN);
    return {
      mode: 'dry-run-only',
      target: redactTarget(productionUrl),
      counts: result.rows[0],
      replacementCatalog: manifest.catalog,
      warnings: [
        ...manifest.warnings,
        'No rows were changed. This command has no apply mode.',
        'A production mutation requires an independently reviewed runbook, backup receipt, and a maintenance window.',
      ],
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may not have started */ }
    throw error;
  } finally {
    client.release();
    if (ownPool) await activePool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runProductionCatalogResetPlan()
    .then((plan) => console.log(JSON.stringify(plan, null, 2)))
    .catch((error) => {
      console.error(`Catalog reset dry run blocked: ${error.message}`);
      process.exitCode = 1;
    });
}
