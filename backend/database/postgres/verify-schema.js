import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';

const { Pool } = pg;

export const EXPECTED_POSTGRES_TABLES = [
  'users',
  'stores',
  'tables',
  'categories',
  'products',
  'size_options',
  'base_options',
  'sugar_options',
  'ice_options',
  'toppings',
  'orders',
  'order_items',
  'order_item_toppings',
  'order_status_history',
  'promotions',
  'promotion_stores',
  'voucher_usage_history',
  'reviews',
  'wishlists',
  'notifications',
  'tier_rules',
  'rewards',
  'point_transactions',
  'user_vouchers',
  'jobs',
  'job_stores',
  'job_applications',
  'ingredients',
  'ingredient_logs',
  'audit_logs',
  'user_identities',
  'otp_codes',
  'payment_events',
  'idempotency_keys',
  'background_jobs',
  'schema_migrations',
  'catalog_category_reparent_history',
  'category_slug_aliases',
  'category_attribute_assignments',
  'product_attribute_overrides',
  'fulfillment_lane_registry',
  'branch_fulfillment_capabilities',
  'fulfillment_tasks',
  'fulfillment_task_items',
];

// These fields are used directly by the current routes. Keeping this compact
// but explicit catches accidental schema drift before the SQL dialect port.
export const REQUIRED_POSTGRES_COLUMNS = {
  users: ['id', 'fullname', 'phone', 'password_hash', 'is_admin', 'admin_role', 'admin_branch_id', 'token_version'],
  stores: ['id', 'name', 'city', 'district', 'address', 'hours', 'phone', 'amenities'],
  categories: ['id', 'name', 'slug', 'sort_order', 'is_visible'],
  products: ['id', 'category_id', 'slug', 'base_tea', 'price', 'image_url', 'is_available'],
  tables: ['id', 'store_id', 'name', 'qr_code_token', 'is_active'],
  orders: ['id', 'order_code', 'store_id', 'table_id', 'order_type', 'payment_status', 'payment_provider', 'payment_link_id', 'payos_order_code', 'payment_checkout_url', 'payment_qr_code', 'payment_expires_at', 'delivery_addr', 'cancel_token_hash'],
  order_items: ['id', 'order_id', 'product_id', 'size_label', 'base_tea', 'sugar_level', 'ice_level', 'unit_price', 'line_total'],
  order_status_history: ['id', 'order_id', 'status', 'changed_by'],
  voucher_usage_history: ['id', 'promotion_id', 'user_phone', 'order_id'],
  promotions: ['id', 'code', 'is_active', 'deleted_at'],
};

export const REQUIRED_POSTGRES_INDEXES = [
  'ix_orders_store_payment_created',
  'ix_orders_payment_expiry',
  'ix_orders_user_created',
  'ix_order_status_history_order_created',
  'ix_order_items_order_id',
  'ix_order_item_toppings_item_id',
  'ix_voucher_usage_promotion_phone',
];

/**
 * Introspects and verifies the PostgreSQL database schema
 */
export async function verifyPostgresSchema({ customUrl = null, pool = null } = {}) {
  const activePool = pool || new Pool(getPostgresPoolConfig(customUrl));

  try {
    // 1. Fetch all user tables in public schema
    const tablesRes = await activePool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);
    const tableNames = tablesRes.rows.map((r) => r.table_name);

    // 2. Check for missing tables
    const missingTables = EXPECTED_POSTGRES_TABLES.filter((t) => !tableNames.includes(t));

    const columnsRes = await activePool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    const columnsByTable = new Map();
    for (const row of columnsRes.rows) {
      const columns = columnsByTable.get(row.table_name) || [];
      columns.push(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }
    const missingColumns = Object.entries(REQUIRED_POSTGRES_COLUMNS).flatMap(([table, columns]) =>
      columns
        .filter((column) => !(columnsByTable.get(table) || []).includes(column))
        .map((column) => `${table}.${column}`)
    );

    // 3. Fetch indexes
    const indexesRes = await activePool.query(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    // 4. Fetch check and foreign key constraints
    const constraintsRes = await activePool.query(`
      SELECT tc.constraint_name, tc.table_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name;
    `);
    const indexNames = indexesRes.rows.map((row) => row.indexname);
    const missingIndexes = REQUIRED_POSTGRES_INDEXES.filter((index) => !indexNames.includes(index));

    const summary = {
      total_tables: tableNames.length,
      tables: tableNames,
      missing_tables: missingTables,
      missing_columns: missingColumns,
      total_indexes: indexesRes.rows.length,
      indexes: indexesRes.rows,
      missing_indexes: missingIndexes,
      total_constraints: constraintsRes.rows.length,
      is_valid: missingTables.length === 0 && missingColumns.length === 0 && missingIndexes.length === 0,
    };

    return summary;
  } finally {
    if (!pool) {
      await activePool.end();
    }
  }
}
