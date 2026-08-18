import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgresDb from '../../../config/db-postgres.js';
import { ORDERED_EXPORT_TABLES, EXPORT_DATA_DIR } from './export-sqlserver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const IMPORT_DEPENDENCY_ORDER = [
  // 1. Independent parent lookup tables
  'stores',
  'categories',
  // 2. Child tables of stores/categories
  'tables',
  'products',
  'jobs',
  'promotions',
  'tier_rules',
  'rewards',
  // 3. Option & relation tables
  'size_options',
  'base_options',
  'sugar_options',
  'ice_options',
  'toppings',
  'promotion_stores',
  'job_stores',
  'ingredients',
  // 4. Users
  'users',
  // 5. User dependent tables
  'user_identities',
  'orders',
  'wishlists',
  'notifications',
  'point_transactions',
  'user_vouchers',
  'job_applications',
  // 6. Order dependent tables
  'order_items',
  'order_status_history',
  'voucher_usage_history',
  'reviews',
  'ingredient_logs',
  'audit_logs',
  // 7. Leaf child tables
  'order_item_toppings',
];

export const TABLES_WITH_SERIAL_ID = [
  'stores',
  'categories',
  'tables',
  'products',
  'jobs',
  'promotions',
  'tier_rules',
  'rewards',
  'size_options',
  'base_options',
  'sugar_options',
  'ice_options',
  'toppings',
  'ingredients',
  'users',
  'user_identities',
  'orders',
  'order_items',
  'order_item_toppings',
  'order_status_history',
  'voucher_usage_history',
  'reviews',
  'wishlists',
  'notifications',
  'point_transactions',
  'user_vouchers',
  'job_applications',
  'ingredient_logs',
  'audit_logs',
];

/**
 * Builds sequence reset SQL for a specific table
 */
export function buildSequenceResetSql(tableName, idColumn = 'id') {
  return `SELECT setval(pg_get_serial_sequence('${tableName}', '${idColumn}'), COALESCE((SELECT MAX(${idColumn}) FROM ${tableName}), 1), (SELECT MAX(${idColumn}) FROM ${tableName}) IS NOT NULL);`;
}

/**
 * Resets all auto-increment sequences after data import
 */
export async function resetPostgresSequences(q = postgresDb.query) {
  const resetResults = [];
  for (const table of TABLES_WITH_SERIAL_ID) {
    try {
      const sql = buildSequenceResetSql(table);
      const [rows] = await q(sql);
      resetResults.push({ table, lastVal: rows[0]?.setval || null, success: true });
    } catch (err) {
      resetResults.push({ table, error: err.message, success: false });
    }
  }
  return resetResults;
}

/**
 * Builds parameterized batch INSERT query for arbitrary table
 */
export function buildInsertStatement(tableName, rows = []) {
  if (!rows || rows.length === 0) return null;

  // Filter out any undefined keys, keep stable column order from first row
  const sample = rows[0];
  const columns = Object.keys(sample);
  const columnList = columns.map((col) => `"${col}"`).join(', ');

  const valuePlaceholders = [];
  const params = [];
  let paramIdx = 1;

  for (const row of rows) {
    const rowPlaceholders = [];
    for (const col of columns) {
      rowPlaceholders.push(`$${paramIdx++}`);
      params.push(row[col] !== undefined ? row[col] : null);
    }
    valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  // Use ON CONFLICT DO NOTHING for idempotent re-runs
  const conflictClause = columns.includes('id')
    ? 'ON CONFLICT ("id") DO NOTHING'
    : 'ON CONFLICT DO NOTHING';

  const sql = `INSERT INTO "${tableName}" (${columnList}) VALUES\n  ${valuePlaceholders.join(',\n  ')}\n${conflictClause};`;
  return { sql, params };
}

/**
 * Imports dataset dictionary into PostgreSQL
 */
export async function importDataset(dataset = {}, q = postgresDb.query, batchSize = 100) {
  const importSummary = {
    started_at: new Date().toISOString(),
    tables: {},
    total_rows: 0,
    errors: [],
  };

  for (const table of IMPORT_DEPENDENCY_ORDER) {
    const rows = dataset[table] || [];
    if (rows.length === 0) {
      importSummary.tables[table] = { imported: 0, total: 0 };
      continue;
    }

    let importedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const stmt = buildInsertStatement(table, batch);
      if (stmt) {
        try {
          const [, affected] = await q(stmt.sql, stmt.params);
          importedCount += affected;
        } catch (err) {
          importSummary.errors.push({
            table,
            batchIndex: Math.floor(i / batchSize),
            error: err.message,
          });
          throw new Error(`Failed to import batch into "${table}": ${err.message}`);
        }
      }
    }

    importSummary.tables[table] = { imported: importedCount, total: rows.length };
    importSummary.total_rows += importedCount;
  }

  // Reset sequences after import
  const sequenceResets = await resetPostgresSequences(q);
  importSummary.sequence_resets = sequenceResets;
  importSummary.finished_at = new Date().toISOString();

  return importSummary;
}

/**
 * Loads JSON export files from directory and imports into PostgreSQL
 */
export async function importFromDirectory(dataDir = EXPORT_DATA_DIR, q = postgresDb.query) {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Import data directory does not exist at ${dataDir}`);
  }

  const dataset = {};
  for (const table of ORDERED_EXPORT_TABLES) {
    const filePath = path.join(dataDir, `${table}.json`);
    if (fs.existsSync(filePath)) {
      dataset[table] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  // Also read user_identities if present
  const identitiesFile = path.join(dataDir, 'user_identities.json');
  if (fs.existsSync(identitiesFile)) {
    dataset.user_identities = JSON.parse(fs.readFileSync(identitiesFile, 'utf-8'));
  }

  return importDataset(dataset, q);
}
