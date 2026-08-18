import fs from 'node:fs';
import path from 'node:path';
import postgresDb from '../../../config/db-postgres.js';
import { ORDERED_EXPORT_TABLES, EXPORT_DATA_DIR } from './export-sqlserver.js';

/**
 * Computes core aggregates from an in-memory dataset dictionary
 */
export function computeDatasetAggregates(dataset = {}) {
  const orders = dataset.orders || [];
  const orderItems = dataset.order_items || [];
  const toppings = dataset.order_item_toppings || [];
  const statusHistory = dataset.order_status_history || [];
  const voucherUsage = dataset.voucher_usage_history || [];
  const users = dataset.users || [];
  const identities = dataset.user_identities || [];

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalSubtotal = orders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
  const totalDiscount = orders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0);
  const totalItemQty = orderItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const totalItemLineTotal = orderItems.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  const totalToppingPrice = toppings.reduce((sum, t) => sum + (Number(t.topping_price) || 0), 0);

  const tableCounts = {};
  for (const table of ORDERED_EXPORT_TABLES) {
    tableCounts[table] = (dataset[table] || []).length;
  }
  tableCounts.user_identities = identities.length;

  return {
    table_counts: tableCounts,
    aggregates: {
      orders_count: orders.length,
      orders_total_sum: totalRevenue,
      orders_subtotal_sum: totalSubtotal,
      orders_discount_sum: totalDiscount,
      order_items_count: orderItems.length,
      order_items_qty_sum: totalItemQty,
      order_items_line_total_sum: totalItemLineTotal,
      toppings_count: toppings.length,
      toppings_price_sum: totalToppingPrice,
      status_history_count: statusHistory.length,
      voucher_usage_count: voucherUsage.length,
      users_count: users.length,
      user_identities_count: identities.length,
    },
  };
}

/**
 * Queries PostgreSQL database for live table counts and core business aggregates
 */
export async function queryPostgresAggregates(q = postgresDb.query) {
  const tableCounts = {};

  for (const table of [...ORDERED_EXPORT_TABLES, 'user_identities']) {
    try {
      const [rows] = await q(`SELECT COUNT(*)::bigint AS cnt FROM "${table}"`);
      tableCounts[table] = parseInt(rows[0]?.cnt || '0', 10);
    } catch {
      tableCounts[table] = 0;
    }
  }

  // Core aggregates queries
  let orderAggs = { count: 0, total_sum: 0, subtotal_sum: 0, discount_sum: 0 };
  let itemAggs = { count: 0, qty_sum: 0, line_total_sum: 0 };
  let toppingAggs = { count: 0, price_sum: 0 };

  try {
    const [rows] = await q(`
      SELECT 
        COUNT(*)::bigint AS count,
        COALESCE(SUM(total), 0)::bigint AS total_sum,
        COALESCE(SUM(subtotal), 0)::bigint AS subtotal_sum,
        COALESCE(SUM(discount_amount), 0)::bigint AS discount_sum
      FROM orders
    `);
    if (rows[0]) {
      orderAggs = {
        count: parseInt(rows[0].count, 10),
        total_sum: parseInt(rows[0].total_sum, 10),
        subtotal_sum: parseInt(rows[0].subtotal_sum, 10),
        discount_sum: parseInt(rows[0].discount_sum, 10),
      };
    }
  } catch {}

  try {
    const [rows] = await q(`
      SELECT 
        COUNT(*)::bigint AS count,
        COALESCE(SUM(qty), 0)::bigint AS qty_sum,
        COALESCE(SUM(line_total), 0)::bigint AS line_total_sum
      FROM order_items
    `);
    if (rows[0]) {
      itemAggs = {
        count: parseInt(rows[0].count, 10),
        qty_sum: parseInt(rows[0].qty_sum, 10),
        line_total_sum: parseInt(rows[0].line_total_sum, 10),
      };
    }
  } catch {}

  try {
    const [rows] = await q(`
      SELECT 
        COUNT(*)::bigint AS count,
        COALESCE(SUM(topping_price), 0)::bigint AS price_sum
      FROM order_item_toppings
    `);
    if (rows[0]) {
      toppingAggs = {
        count: parseInt(rows[0].count, 10),
        price_sum: parseInt(rows[0].price_sum, 10),
      };
    }
  } catch {}

  return {
    table_counts: tableCounts,
    aggregates: {
      orders_count: orderAggs.count,
      orders_total_sum: orderAggs.total_sum,
      orders_subtotal_sum: orderAggs.subtotal_sum,
      orders_discount_sum: orderAggs.discount_sum,
      order_items_count: itemAggs.count,
      order_items_qty_sum: itemAggs.qty_sum,
      order_items_line_total_sum: itemAggs.line_total_sum,
      toppings_count: toppingAggs.count,
      toppings_price_sum: toppingAggs.price_sum,
      status_history_count: tableCounts.order_status_history || 0,
      voucher_usage_count: tableCounts.voucher_usage_history || 0,
      users_count: tableCounts.users || 0,
      user_identities_count: tableCounts.user_identities || 0,
    },
  };
}

/**
 * Reconciles expected dataset vs target PostgreSQL aggregates
 */
export function reconcileData(expectedAggs, actualAggs) {
  const mismatches = [];

  // 1. Compare table row counts
  for (const [table, expectedCount] of Object.entries(expectedAggs.table_counts || {})) {
    const actualCount = actualAggs.table_counts?.[table] ?? 0;
    if (expectedCount !== actualCount) {
      mismatches.push({
        metric: `table_count:${table}`,
        expected: expectedCount,
        actual: actualCount,
        diff: actualCount - expectedCount,
      });
    }
  }

  // 2. Compare business aggregates
  for (const [metric, expectedVal] of Object.entries(expectedAggs.aggregates || {})) {
    const actualVal = actualAggs.aggregates?.[metric] ?? 0;
    if (expectedVal !== actualVal) {
      mismatches.push({
        metric: `aggregate:${metric}`,
        expected: expectedVal,
        actual: actualVal,
        diff: actualVal - expectedVal,
      });
    }
  }

  const success = mismatches.length === 0;

  return {
    success,
    reconciled_at: new Date().toISOString(),
    mismatch_count: mismatches.length,
    mismatches,
    expected_summary: expectedAggs.aggregates,
    actual_summary: actualAggs.aggregates,
  };
}

/**
 * Reconciles exported JSON directory against live PostgreSQL
 */
export async function reconcileDirectoryAgainstPostgres(dataDir = EXPORT_DATA_DIR, q = postgresDb.query) {
  const manifestPath = path.join(dataDir, 'manifest.json');
  let expectedDataset = {};

  if (fs.existsSync(manifestPath)) {
    for (const table of [...ORDERED_EXPORT_TABLES, 'user_identities']) {
      const filePath = path.join(dataDir, `${table}.json`);
      if (fs.existsSync(filePath)) {
        expectedDataset[table] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  }

  const expectedAggs = computeDatasetAggregates(expectedDataset);
  const actualAggs = await queryPostgresAggregates(q);

  return reconcileData(expectedAggs, actualAggs);
}
