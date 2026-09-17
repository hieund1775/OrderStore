#!/usr/bin/env node
/**
 * Guarded production Catalog replacement.
 *
 * This is intentionally separate from the dry-run planner.  It is never
 * called by deploy/seed scripts and fails closed unless Operations supplies a
 * verified backup receipt, maintenance approval, and the exact confirmation.
 * It expects the currently tracked production schema through migration 0034,
 * including preorder checkout-group constraints introduced in 0030.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { replacementCatalog } from './plan-production-catalog-reset.js';

const { Pool } = pg;
export const CONFIRMATION_PHRASE = 'RESET_PRODUCTION_CATALOG_2026_09_17';

function parseApplyArgs(args) {
  const confirmation = args.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length);
  if (!args.includes('--apply')) throw new Error('Refusing catalog reset: --apply is required.');
  if (!args.includes('--maintenance-mode')) throw new Error('Refusing catalog reset: --maintenance-mode is required.');
  if (confirmation !== CONFIRMATION_PHRASE) throw new Error('Refusing catalog reset: exact non-interactive confirmation phrase is required.');
}

export async function validateResetGuards({ args, env, fsImpl = { readFile, stat } }) {
  parseApplyArgs(args);
  if (!env.PRODUCTION_DATABASE_URL) throw new Error('PRODUCTION_DATABASE_URL is required.');
  if (env.CATALOG_RESET_MAINTENANCE_APPROVED !== 'true') {
    throw new Error('CATALOG_RESET_MAINTENANCE_APPROVED=true is required.');
  }
  if (!env.CATALOG_PUBLIC_ORIGIN) throw new Error('CATALOG_PUBLIC_ORIGIN is required for static product image URLs.');
  const publicOrigin = new URL(env.CATALOG_PUBLIC_ORIGIN).origin;
  const receiptPath = env.PRODUCTION_CATALOG_BACKUP_RECEIPT;
  const expectedHash = String(env.PRODUCTION_CATALOG_BACKUP_SHA256 || '').toLowerCase();
  if (!receiptPath || !path.isAbsolute(receiptPath) || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('An absolute PRODUCTION_CATALOG_BACKUP_RECEIPT and its SHA-256 are required.');
  }
  const receiptStat = await fsImpl.stat(receiptPath);
  if (!receiptStat.isFile() || receiptStat.size <= 0) throw new Error('Backup receipt must be a non-empty regular file.');
  const receipt = await fsImpl.readFile(receiptPath);
  const actualHash = createHash('sha256').update(receipt).digest('hex');
  if (actualHash !== expectedHash) throw new Error('Backup receipt SHA-256 does not match PRODUCTION_CATALOG_BACKUP_SHA256.');
  return { publicOrigin, receiptPath, receiptSha256: actualHash };
}

function allSeedProducts(publicOrigin) {
  return Object.entries(replacementCatalog).flatMap(([lane, group]) => group.products.map((product) => ({
    ...product,
    lane,
    imageUrl: new URL(product.image, publicOrigin).toString(),
    productType: group.productType,
  })));
}

async function deleteLegacyCatalog(tx) {
  // Target tables are populated once, then every order-side delete is joined
  // to those IDs. Users, stores, payment_profiles, and promotions are never
  // deleted by this command.
  await tx.query('LOCK TABLE categories, products, orders IN SHARE ROW EXCLUSIVE MODE');
  await tx.query('CREATE TEMP TABLE catalog_reset_products (id BIGINT PRIMARY KEY) ON COMMIT DROP');
  await tx.query('INSERT INTO catalog_reset_products (id) SELECT id FROM products');
  await tx.query('CREATE TEMP TABLE catalog_reset_orders (id BIGINT PRIMARY KEY) ON COMMIT DROP');
  await tx.query(`INSERT INTO catalog_reset_orders (id)
    SELECT DISTINCT oi.order_id FROM order_items oi JOIN catalog_reset_products p ON p.id = oi.product_id`);
  await tx.query('CREATE TEMP TABLE catalog_reset_checkout_groups (id BIGINT PRIMARY KEY) ON COMMIT DROP');
  await tx.query(`INSERT INTO catalog_reset_checkout_groups (id)
    SELECT o.checkout_group_id
    FROM orders o
    WHERE o.id IN (SELECT id FROM catalog_reset_orders)
      AND o.checkout_group_id IS NOT NULL
    GROUP BY o.checkout_group_id
    HAVING NOT EXISTS (
      SELECT 1 FROM orders other
      WHERE other.checkout_group_id = o.checkout_group_id
        AND other.id NOT IN (SELECT id FROM catalog_reset_orders)
    )`);
  const [preorderDependency] = await tx.query(`
    SELECT EXISTS (
      SELECT 1 FROM preorders p
      JOIN catalog_reset_checkout_groups g ON g.id = p.checkout_group_id
    ) AS has_preorder_dependency
  `);
  if (preorderDependency?.has_preorder_dependency) {
    throw new Error('Refusing catalog reset: a preorder references a target checkout group. Preserve preorder data and resolve it manually first.');
  }

  await tx.query(`UPDATE reviews r SET current_revision_id = NULL
    WHERE r.product_id IN (SELECT id FROM catalog_reset_products)`);
  await tx.query(`DELETE FROM review_media_uploads u
    WHERE u.order_id IN (SELECT id FROM catalog_reset_orders)
       OR u.order_item_id IN (SELECT oi.id FROM order_items oi JOIN catalog_reset_orders o ON o.id = oi.order_id)`);
  await tx.query(`DELETE FROM review_media_uploads u
    WHERE u.review_id IN (SELECT r.id FROM reviews r JOIN catalog_reset_products p ON p.id = r.product_id)`);
  await tx.query(`DELETE FROM reviews r WHERE r.product_id IN (SELECT id FROM catalog_reset_products)`);
  await tx.query(`DELETE FROM payment_events e
    WHERE e.order_id IN (SELECT id FROM catalog_reset_orders)
       OR e.payment_attempt_id IN (
      SELECT pa.id FROM payment_attempts pa
      WHERE pa.order_id IN (SELECT id FROM catalog_reset_orders)
         OR pa.checkout_group_id IN (SELECT id FROM catalog_reset_checkout_groups)
    )`);
  await tx.query(`UPDATE orders SET current_payment_attempt_id = NULL
    WHERE id IN (SELECT id FROM catalog_reset_orders)`);
  await tx.query(`UPDATE checkout_groups SET current_payment_attempt_id = NULL
    WHERE id IN (SELECT id FROM catalog_reset_checkout_groups)`);
  await tx.query(`DELETE FROM payment_attempts
    WHERE order_id IN (SELECT id FROM catalog_reset_orders)
       OR checkout_group_id IN (SELECT id FROM catalog_reset_checkout_groups)`);
  await tx.query(`DELETE FROM voucher_usage_history WHERE order_id IN (SELECT id FROM catalog_reset_orders)`);
  await tx.query(`DELETE FROM inventory_reservations
    WHERE order_id IN (SELECT id FROM catalog_reset_orders)
       OR variant_id IN (SELECT pv.id FROM product_variants pv JOIN catalog_reset_products p ON p.id = pv.product_id)`);
  await tx.query(`DELETE FROM checkout_group_allocations WHERE order_id IN (SELECT id FROM catalog_reset_orders)`);
  await tx.query(`DELETE FROM orders WHERE id IN (SELECT id FROM catalog_reset_orders)`);
  await tx.query(`DELETE FROM checkout_groups g
    WHERE g.id IN (SELECT id FROM catalog_reset_checkout_groups)
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.checkout_group_id = g.id)`);
  await tx.query(`DELETE FROM products WHERE id IN (SELECT id FROM catalog_reset_products)`);
  await tx.query('DELETE FROM categories');
  await tx.query('DELETE FROM product_types');
}

async function seedReplacementCatalog(tx, publicOrigin) {
  for (const [lane, group] of Object.entries(replacementCatalog)) {
    const [typeResult] = await tx.query(
      `INSERT INTO product_types (code, name, default_stock_mode, default_fulfillment_lane)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [group.productType.code, group.productType.name, group.productType.stockMode, lane],
    );
    const productTypeId = typeResult.id;
    const [schemaResult] = await tx.query(
      `INSERT INTO product_type_schemas (product_type_id, version, status, published_at)
       VALUES ($1, 1, 'published', CURRENT_TIMESTAMP) RETURNING id`,
      [productTypeId],
    );
    const schemaId = schemaResult.id;
    const [rootResult] = await tx.query(
      `INSERT INTO categories (name, slug, parent_id, depth, product_type_id, default_fulfillment_lane, sort_order, is_visible)
       VALUES ($1, $2, NULL, 0, $3, $4, 0, TRUE) RETURNING id`,
      [group.productType.name, `${group.productType.code.replace(/_/g, '-')}-root`, productTypeId, lane],
    );
    const categoryIds = new Map();
    for (const [index, category] of group.categories.entries()) {
      const [row] = await tx.query(
        `INSERT INTO categories (name, slug, parent_id, depth, product_type_id, default_fulfillment_lane, sort_order, is_visible)
         VALUES ($1, $2, $3, 1, $4, $5, $6, TRUE) RETURNING id`,
        [category.name, category.slug, rootResult.id, productTypeId, lane, index + 1],
      );
      categoryIds.set(category.slug, row.id);
    }
    for (const product of group.products) {
      const [productRow] = await tx.query(
        `INSERT INTO products (category_id, name, slug, base_tea, description, price, image_url, product_type_schema_id, status, fulfillment_lane, stock_mode)
         VALUES ($1, $2, $3, 'Mặc định', NULL, $4, $5, $6, 'active', $7, $8) RETURNING id`,
        [categoryIds.get(product.categorySlug), product.name, product.slug, product.price, new URL(product.image, publicOrigin).toString(), schemaId, lane, group.productType.stockMode],
      );
      const [variantRow] = await tx.query(
        `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
         VALUES ($1, $2, 'default', 'Tiêu chuẩn', 'active') RETURNING id`,
        [productRow.id, `SEED-${product.slug.toUpperCase()}-DEF`],
      );
      await tx.query(`INSERT INTO branch_variant_offers (store_id, variant_id, price, is_available)
        SELECT id, $1, $2, TRUE FROM stores WHERE is_active = TRUE`, [variantRow.id, product.price]);
      if (group.productType.stockMode === 'tracked') {
        await tx.query(`INSERT INTO branch_variant_inventory (store_id, variant_id, on_hand, reserved)
          SELECT id, $1, 100, 0 FROM stores WHERE is_active = TRUE`, [variantRow.id]);
      }
    }
  }
}

export async function runProductionCatalogReset({ args = process.argv.slice(2), env = process.env, pool = null, fsImpl } = {}) {
  const guard = await validateResetGuards({ args, env, fsImpl });
  const ownPool = !pool;
  const activePool = pool || new Pool(getPostgresPoolConfig(env.PRODUCTION_DATABASE_URL, { env: { ...env, NODE_ENV: 'production' } }));
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    const tx = { query: async (sql, params = []) => {
      const result = await client.query(sql, params);
      return result.rows;
    } };
    await deleteLegacyCatalog(tx);
    await seedReplacementCatalog(tx, guard.publicOrigin);
    await client.query('COMMIT');
    return { applied: true, backupReceipt: guard.receiptPath, lanes: Object.keys(replacementCatalog) };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    client.release();
    if (ownPool) await activePool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runProductionCatalogReset()
    .then((receipt) => console.log(JSON.stringify(receipt, null, 2)))
    .catch((error) => { console.error(`Production catalog reset blocked: ${error.message}`); process.exitCode = 1; });
}
