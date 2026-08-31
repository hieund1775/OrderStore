import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const coreMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0001_core.sql');
const voucherMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0009_voucher_usage_and_validity.sql');
const wishlistCleanupMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0010_wishlist_inactive_product_cleanup.sql');
const catalogV2MigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0011_catalog_v2_foundation.sql');
const branchOffersMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0012_branch_offers_inventory.sql');
const catalogIntegrityMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0013_catalog_v2_integrity_hardening.sql');

test('PostgreSQL baseline preserves the active backend column and enum contract', async () => {
  const sql = await readFile(coreMigrationPath, 'utf8');

  const requiredFragments = [
    'admin_role VARCHAR(20)', 'admin_branch_id BIGINT', 'token_version INTEGER',
    'city VARCHAR(100)', 'district VARCHAR(100)', 'hours VARCHAR(100)', 'amenities TEXT',
    'slug VARCHAR(150)', 'sort_order INTEGER', 'is_visible BOOLEAN',
    'base_tea VARCHAR(100)', 'image_url TEXT', 'is_available BOOLEAN',
    'qr_code_token VARCHAR(100)', 'table_id BIGINT', 'location_name VARCHAR(200)',
    "order_type IN ('Delivery', 'Take-away', 'POS')",
    "payment_status IN ('unpaid', 'paid', 'expired')",
    'payment_provider VARCHAR(30)', 'payment_expires_at TIMESTAMPTZ', 'delivery_addr VARCHAR(300)',
    'cancel_token_hash CHAR(64)', 'size_label VARCHAR(50)', 'sugar_level VARCHAR(50)',
    'ice_level VARCHAR(50)', 'unit_price INTEGER', 'changed_by BIGINT', 'user_phone VARCHAR(20)',
    "status IN ('Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy')",
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing active backend schema contract: ${fragment}`);
  }
  assert.equal(sql.includes('table_number VARCHAR'), false, 'legacy routes use table_id, not table_number');
  assert.equal(sql.includes('product_price BIGINT'), false, 'legacy routes use unit_price, not product_price');
});

test('voucher migration enforces nullable validity and strict usage counters', async () => {
  const sql = await readFile(voucherMigrationPath, 'utf8');
  const requiredFragments = [
    "SET voucher_type = 'shared'",
    "ALTER COLUMN voucher_type SET DEFAULT 'shared'",
    'ALTER COLUMN end_date DROP NOT NULL',
    "voucher_type IN ('single_use', 'shared')",
    'end_date IS NULL OR end_date >= start_date',
    'usage_limit IS NULL OR usage_limit > 0',
    'used_count >= 0',
    'usage_limit IS NULL OR used_count <= usage_limit',
    "voucher_type <> 'single_use' OR usage_limit IS NULL",
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing voucher migration contract: ${fragment}`);
  }
});

test('wishlist cleanup migration 0010 notifies customers and removes inactive products from wishlists', async () => {
  const sql = await readFile(wishlistCleanupMigrationPath, 'utf8');
  const requiredFragments = [
    'INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at)',
    'Món yêu thích tạm ngưng phục vụ',
    'p.is_available = FALSE',
    'u.is_admin = FALSE',
    'DELETE FROM wishlists',
    'SELECT id FROM products WHERE is_available = FALSE',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing wishlist cleanup migration contract: ${fragment}`);
  }
});

test('catalog v2 migration 0011 establishes multi-category tree, dynamic attributes, variants, media and packing role', async () => {
  const sql = await readFile(catalogV2MigrationPath, 'utf8');
  const requiredFragments = [
    "admin_role IN ('super', 'manager', 'kitchen', 'cashier', 'packing')",
    'parent_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT',
    'depth INTEGER NOT NULL DEFAULT 0',
    'depth BETWEEN 0 AND 2',
    'product_type_id BIGINT',
    'CREATE TABLE IF NOT EXISTS product_types',
    "default_stock_mode VARCHAR(50) NOT NULL DEFAULT 'made_to_order'",
    "default_fulfillment_lane VARCHAR(50) NOT NULL DEFAULT 'kitchen'",
    'CREATE TABLE IF NOT EXISTS product_type_schemas',
    "status VARCHAR(50) NOT NULL DEFAULT 'draft'",
    'uq_product_type_version UNIQUE (product_type_id, version)',
    'CREATE TABLE IF NOT EXISTS attribute_definitions',
    "role VARCHAR(50) NOT NULL CHECK (role IN ('variant', 'modifier'))",
    "input_type VARCHAR(50) NOT NULL CHECK (input_type IN ('single_select', 'multi_select', 'text', 'number'))",
    'CREATE TABLE IF NOT EXISTS attribute_values',
    'price_adjustment INTEGER NOT NULL DEFAULT 0',
    'product_type_schema_id BIGINT REFERENCES product_type_schemas(id)',
    'CREATE TABLE IF NOT EXISTS product_variants',
    'sku VARCHAR(100) NOT NULL UNIQUE',
    'variant_signature VARCHAR(255) NOT NULL',
    'CREATE TABLE IF NOT EXISTS product_variant_values',
    'CREATE TABLE IF NOT EXISTS product_modifier_values',
    'CREATE TABLE IF NOT EXISTS product_media',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing catalog v2 migration contract: ${fragment}`);
  }
});

test('branch offers & inventory migration 0012 establishes branch pricing, SKU stock, ledger & reservations', async () => {
  const sql = await readFile(branchOffersMigrationPath, 'utf8');
  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS branch_variant_offers',
    'uq_branch_variant_offer UNIQUE (store_id, variant_id)',
    'price INTEGER NOT NULL CHECK (price >= 0)',
    'compare_at_price INTEGER',
    'CREATE TABLE IF NOT EXISTS branch_variant_inventory',
    'on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0)',
    'reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0)',
    'uq_branch_variant_inventory UNIQUE (store_id, variant_id)',
    'chk_inventory_reserved_le_on_hand CHECK (reserved <= on_hand)',
    'CREATE TABLE IF NOT EXISTS inventory_movements',
    "movement_type IN ('receive', 'adjust', 'reserve', 'release', 'sale', 'cancel_restock', 'return_restock')",
    'before_on_hand INTEGER NOT NULL CHECK (before_on_hand >= 0)',
    'after_on_hand INTEGER NOT NULL CHECK (after_on_hand >= 0)',
    'CREATE TABLE IF NOT EXISTS inventory_reservations',
    "status IN ('reserved', 'committed', 'released', 'expired')",
    'expires_at TIMESTAMPTZ NOT NULL',
    'idx_branch_offers_store_variant',
    'idx_branch_inventory_store_variant',
    'idx_inventory_movements_store_variant',
    'idx_inventory_reservations_status_expires',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing branch inventory migration contract: ${fragment}`);
  }
});

test('catalog integrity migration 0013 prevents multiple published schemas and adds lookup indexes', async () => {
  const sql = await readFile(catalogIntegrityMigrationPath, 'utf8');
  const requiredFragments = [
    'uq_product_type_one_published_schema',
    "WHERE status = 'published'",
    'idx_product_modifier_values_product',
    'idx_product_variant_values_value',
    'idx_inventory_reservations_checkout_group',
    'CREATE TABLE IF NOT EXISTS catalog_v2_backfill_runs',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing catalog integrity migration contract: ${fragment}`);
  }
});

test('root category navigation migration 0015 creates reparent history audit table', async () => {
  const rootNavMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0015_root_category_navigation.sql');
  const rootNavRollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0015_root_category_navigation.rollback.sql');
  const sql = await readFile(rootNavMigrationPath, 'utf8');
  const rollbackSql = await readFile(rootNavRollbackPath, 'utf8');
  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS catalog_category_reparent_history',
    'run_key VARCHAR(100) NOT NULL',
    'root_category_id BIGINT NOT NULL REFERENCES categories(id)',
    'category_id BIGINT NOT NULL REFERENCES categories(id)',
    'old_parent_id BIGINT REFERENCES categories(id)',
    'old_depth INTEGER NOT NULL',
    'root_was_created BOOLEAN NOT NULL',
    'uq_reparent_run_category UNIQUE (run_key, category_id)',
    'idx_reparent_history_run_key',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing root category navigation migration contract: ${fragment}`);
  }

  assert.ok(
    rollbackSql.includes("h.run_key = 'legacy-root-category-navigation-v1'"),
    'rollback must only restore the root-navigation backfill run',
  );
  assert.ok(
    rollbackSql.includes("WHERE name = 'legacy-root-category-navigation-v1'"),
    'rollback must clear the completion marker so the backfill can run again',
  );
});

test('catalog option scopes migration 0016 creates aliases, assignments and overrides', async () => {
  const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0016_catalog_option_scopes.sql');
  const rollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0016_catalog_option_scopes.rollback.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const rollbackSql = await readFile(rollbackPath, 'utf8');

  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS category_slug_aliases',
    'alias_slug VARCHAR(150) NOT NULL UNIQUE',
    'CREATE TABLE IF NOT EXISTS category_attribute_assignments',
    'uq_category_attribute_assignment UNIQUE (category_id, attribute_definition_id)',
    'CREATE TABLE IF NOT EXISTS product_attribute_overrides',
    'uq_product_attribute_override UNIQUE (product_id, attribute_definition_id)',
    'idx_category_slug_aliases_category_id',
    'idx_cat_attr_assign_category_id',
    'idx_prod_attr_override_product_id',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing migration 0016 contract: ${fragment}`);
  }

  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS product_attribute_overrides CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS category_attribute_assignments CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS category_slug_aliases CASCADE'));
});

test('fulfillment capabilities migration 0017 creates lane registry, branch capabilities and task hardening', async () => {
  const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0017_fulfillment_capabilities.sql');
  const rollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0017_fulfillment_capabilities.rollback.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const rollbackSql = await readFile(rollbackPath, 'utf8');

  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS fulfillment_lane_registry',
    'code VARCHAR(50) PRIMARY KEY',
    "('kitchen', 'Pha chế / Bếp', 'kitchen', TRUE, TRUE)",
    "('packing', 'Soạn hàng / Đóng gói', 'packing', TRUE, TRUE)",
    'CREATE TABLE IF NOT EXISTS branch_fulfillment_capabilities',
    'uq_branch_fulfillment_lane UNIQUE (store_id, lane_code)',
    'default_fulfillment_lane VARCHAR(50)',
    'fk_products_fulfillment_lane',
    'fk_fulfillment_tasks_lane',
    'uq_fulfillment_task_order_item',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing migration 0017 contract: ${fragment}`);
  }

  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS branch_fulfillment_capabilities CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS fulfillment_lane_registry CASCADE'));
});

test('hardening migration 0018 enforces DB constraints, restrict policy and task item trigger', async () => {
  const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0018_fulfillment_and_scope_hardening.sql');
  const rollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0018_fulfillment_and_scope_hardening.rollback.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const rollbackSql = await readFile(rollbackPath, 'utf8');

  const requiredFragments = [
    'chk_category_slug_alias_normalized',
    'chk_category_attribute_selection_bounds',
    'chk_product_attribute_selection_bounds',
    'chk_fulfillment_lane_code',
    'chk_fulfillment_handler_type',
    'fk_categories_default_fulfillment_lane',
    'fk_products_fulfillment_lane',
    'fk_order_items_fulfillment_lane',
    'ON DELETE RESTRICT',
    'trg_fulfillment_task_item_order',
    'enforce_fulfillment_task_item_order',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing migration 0018 contract: ${fragment}`);
  }

  assert.ok(rollbackSql.includes('DROP TRIGGER IF EXISTS trg_fulfillment_task_item_order ON fulfillment_task_items'));
  assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS enforce_fulfillment_task_item_order()'));
});

test('option presets migration 0019 establishes presets, values and integrity triggers', async () => {
  const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0019_category_product_option_presets.sql');
  const rollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0019_category_product_option_presets.rollback.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const rollbackSql = await readFile(rollbackPath, 'utf8');

  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS catalog_option_presets',
    'chk_preset_target_type',
    'uq_catalog_option_preset',
    'CREATE TABLE IF NOT EXISTS catalog_option_preset_values',
    'uq_catalog_option_preset_value',
    'trg_catalog_option_preset_target',
    'enforce_catalog_option_preset_target',
    'trg_preset_value_attribute_match',
    'enforce_preset_value_attribute_match',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing migration 0019 contract: ${fragment}`);
  }

  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS catalog_option_preset_values CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS catalog_option_presets CASCADE'));
});

test('payment profiles migration 0020 establishes profiles, root mapping, checkout groups, and allocations', async () => {
  const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0020_payment_profiles_and_grouped_checkout.sql');
  const rollbackPath = path.join(testDir, '..', 'database', 'postgres', 'rollbacks', '0020_payment_profiles_and_grouped_checkout.rollback.sql');
  const sql = await readFile(migrationPath, 'utf8');
  const rollbackSql = await readFile(rollbackPath, 'utf8');

  const requiredFragments = [
    'CREATE TABLE IF NOT EXISTS payment_profiles',
    'chk_payment_profile_code_format',
    'chk_payment_profile_status',
    'CREATE TABLE IF NOT EXISTS category_payment_profiles',
    'enforce_root_category_payment_profile',
    'trg_enforce_root_category_payment_profile',
    'CREATE TABLE IF NOT EXISTS checkout_groups',
    'chk_checkout_group_payment_status',
    'CREATE TABLE IF NOT EXISTS checkout_group_allocations',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_group_id',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_profile_code',
    'LONG_GROUPED_CHECKOUT',
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing migration 0020 contract: ${fragment}`);
  }

  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS checkout_group_allocations CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS checkout_groups CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS category_payment_profiles CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS payment_profiles CASCADE'));
});


