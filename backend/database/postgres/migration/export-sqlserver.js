import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EXPORT_DATA_DIR = path.resolve(__dirname, 'data');

export const ORDERED_EXPORT_TABLES = [
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
  'promotion_stores',
  'job_stores',
  'ingredients',
  'users',
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

const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_available',
  'is_admin',
  'is_visible',
  'is_recommended',
  'is_bestseller',
  'is_seasonal',
  'is_default',
  'is_resolved',
]);

const INTEGER_COLUMNS = new Set([
  'id',
  'store_id',
  'table_id',
  'category_id',
  'product_id',
  'order_id',
  'order_item_id',
  'promotion_id',
  'user_id',
  'job_id',
  'job_application_id',
  'ingredient_id',
  'sort_order',
  'price',
  'price_extra',
  'unit_price',
  'line_total',
  'topping_price',
  'subtotal',
  'discount_amount',
  'total',
  'min_order',
  'max_discount',
  'discount_value',
  'usage_limit',
  'used_count',
  'points',
  'points_required',
  'points_earned',
  'total_spent',
  'qty',
  'rating',
  'quantity_in_stock',
  'min_stock_level',
  'quantity_delta',
]);

/**
 * Normalizes a Vietnamese phone number to 10-digit format (e.g. +8490... or 8490... -> 090...)
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }
  return digits || null;
}

/**
 * Normalizes email address
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

/**
 * Normalizes a single row according to schema constraints
 */
export function normalizeRow(tableName, row) {
  if (!row || typeof row !== 'object') return row;
  const normalized = {};

  for (const [key, rawValue] of Object.entries(row)) {
    let value = rawValue;

    if (value === undefined) {
      value = null;
    }

    // 1. Boolean conversion
    if (BOOLEAN_COLUMNS.has(key)) {
      if (typeof value === 'boolean') {
        normalized[key] = value;
      } else if (typeof value === 'number') {
        normalized[key] = value === 1;
      } else if (typeof value === 'string') {
        normalized[key] = value === '1' || value.toLowerCase() === 'true';
      } else {
        normalized[key] = false;
      }
      continue;
    }

    // 2. Integer/Bigint conversion
    if (INTEGER_COLUMNS.has(key) && value !== null) {
      const parsed = parseInt(value, 10);
      normalized[key] = Number.isFinite(parsed) ? parsed : null;
      continue;
    }

    // 3. Phone normalization
    if ((key === 'phone' || key === 'customer_phone' || key === 'user_phone') && value !== null) {
      normalized[key] = normalizePhoneNumber(String(value));
      continue;
    }

    // 4. Email normalization
    if (key === 'email' && value !== null) {
      normalized[key] = normalizeEmail(String(value));
      continue;
    }

    // 5. Date/Timestamp conversion
    if (value instanceof Date) {
      normalized[key] = value.toISOString();
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

/**
 * Extracts normalized user_identities records from legacy user records
 */
export function extractUserIdentities(users = []) {
  const identities = [];
  let nextId = 1;

  for (const user of users) {
    if (!user || !user.id) continue;

    // Password identity
    if (user.password_hash) {
      identities.push({
        id: nextId++,
        user_id: user.id,
        provider: 'password',
        provider_user_id: user.phone || user.email || String(user.id),
        credential_hash: user.password_hash,
        last_sign_in_at: user.created_at || new Date().toISOString(),
        created_at: user.created_at || new Date().toISOString(),
      });
    }

    // Google identity
    if (user.google_id) {
      identities.push({
        id: nextId++,
        user_id: user.id,
        provider: 'google',
        provider_user_id: String(user.google_id),
        credential_hash: null,
        last_sign_in_at: user.created_at || new Date().toISOString(),
        created_at: user.created_at || new Date().toISOString(),
      });
    }
  }

  return identities;
}

/**
 * Transforms an entire dataset dictionary
 */
export function transformDataset(rawDataset = {}) {
  const transformed = {};

  for (const table of ORDERED_EXPORT_TABLES) {
    const rows = rawDataset[table] || [];
    transformed[table] = rows.map((r) => normalizeRow(table, r));
  }

  // Generate user_identities
  if (transformed.users && transformed.users.length > 0) {
    transformed.user_identities = extractUserIdentities(rawDataset.users || transformed.users);
  } else {
    transformed.user_identities = [];
  }

  return transformed;
}

/**
 * Writes dataset to JSON export files
 */
export function writeExportFiles(transformedDataset, outputDir = EXPORT_DATA_DIR) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifest = {
    exported_at: new Date().toISOString(),
    tables: {},
  };

  for (const [table, rows] of Object.entries(transformedDataset)) {
    const filePath = path.join(outputDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    manifest.tables[table] = rows.length;
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}
