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

    const summary = {
      total_tables: tableNames.length,
      tables: tableNames,
      missing_tables: missingTables,
      total_indexes: indexesRes.rows.length,
      indexes: indexesRes.rows,
      total_constraints: constraintsRes.rows.length,
      is_valid: missingTables.length === 0,
    };

    return summary;
  } finally {
    if (!pool) {
      await activePool.end();
    }
  }
}
