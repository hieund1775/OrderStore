import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  CONFIRMATION_PHRASE,
  runProductionCatalogReset,
  validateResetGuards,
} from '../commands/reset-production-catalog.js';

const receipt = Buffer.from('verified backup receipt');
const receiptPath = path.resolve('catalog-reset-backup-receipt.json');
const receiptHash = createHash('sha256').update(receipt).digest('hex');
const fsImpl = {
  async stat() { return { isFile: () => true, size: receipt.length }; },
  async readFile() { return receipt; },
};
const validEnv = {
  PRODUCTION_DATABASE_URL: 'postgresql://release:secret@production.example:5432/order',
  CATALOG_RESET_MAINTENANCE_APPROVED: 'true',
  CATALOG_PUBLIC_ORIGIN: 'https://order.example',
  PRODUCTION_CATALOG_BACKUP_RECEIPT: receiptPath,
  PRODUCTION_CATALOG_BACKUP_SHA256: receiptHash,
};
const validArgs = ['--apply', '--maintenance-mode', `--confirm=${CONFIRMATION_PHRASE}`];

test('production catalog reset command fails closed before opening a connection', async () => {
  await assert.rejects(
    () => validateResetGuards({ args: ['--apply', '--maintenance-mode', '--confirm=wrong'], env: validEnv, fsImpl }),
    /exact non-interactive confirmation/,
  );
  await assert.rejects(
    () => validateResetGuards({ args: ['--apply', `--confirm=${CONFIRMATION_PHRASE}`], env: validEnv, fsImpl }),
    /maintenance-mode/,
  );
  await assert.rejects(
    () => validateResetGuards({ args: validArgs, env: { ...validEnv, CATALOG_RESET_MAINTENANCE_APPROVED: 'false' }, fsImpl }),
    /MAINTENANCE_APPROVED/,
  );
  await assert.rejects(
    () => validateResetGuards({ args: validArgs, env: { ...validEnv, PRODUCTION_CATALOG_BACKUP_SHA256: '0'.repeat(64) }, fsImpl }),
    /SHA-256 does not match/,
  );

  let connected = false;
  await assert.rejects(
    () => runProductionCatalogReset({ args: ['--apply'], env: {}, pool: { async connect() { connected = true; } }, fsImpl }),
    /maintenance-mode/,
  );
  assert.equal(connected, false);
});

test('production catalog reset deletes only product-linked orders/dependencies and preserves non-catalog configuration', async () => {
  const calls = [];
  let id = 100;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('RETURNING id')) return { rows: [{ id: id++ }] };
      return { rows: [] };
    },
    release() {},
  };
  const result = await runProductionCatalogReset({
    args: validArgs,
    env: validEnv,
    fsImpl,
    pool: { async connect() { return client; } },
  });

  assert.equal(result.applied, true);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.at(-1).sql, 'COMMIT');
  const sql = calls.map((call) => call.sql).join('\n');
  assert.match(sql, /INSERT INTO catalog_reset_products \(id\) SELECT id FROM products/);
  assert.doesNotMatch(sql, /catalog_reset_products \(id\) SELECT id FROM products WHERE status/);
  assert.match(sql, /catalog_reset_orders[\s\S]*order_items oi JOIN catalog_reset_products p ON p\.id = oi\.product_id/);
  assert.match(sql, /DELETE FROM orders WHERE id IN \(SELECT id FROM catalog_reset_orders\)/);
  assert.match(sql, /DELETE FROM payment_attempts[\s\S]*order_id IN \(SELECT id FROM catalog_reset_orders\)/);
  assert.match(sql, /DELETE FROM payment_events e[\s\S]*e\.order_id IN \(SELECT id FROM catalog_reset_orders\)/);
  assert.match(sql, /DELETE FROM products WHERE id IN \(SELECT id FROM catalog_reset_products\)/);
  assert.match(sql, /catalog_reset_checkout_groups[\s\S]*HAVING NOT EXISTS[\s\S]*other\.id NOT IN \(SELECT id FROM catalog_reset_orders\)/);
  assert.match(sql, /FROM preorders p[\s\S]*catalog_reset_checkout_groups g ON g\.id = p\.checkout_group_id/);
  assert.doesNotMatch(sql, /DELETE FROM (?:users|stores|payment_profiles|promotions)\b/);
  assert.match(sql, /default_fulfillment_lane/);
  assert.match(sql, /fulfillment_lane/);
  const productInsert = calls.find((call) => call.sql.includes('INSERT INTO products'));
  assert.ok(productInsert.params.some((value) => value === 'https://order.example/catalog/tra-dao-cam-sa.png'));
});

test('production catalog reset aborts before deleting data when a preorder references a fully-target checkout group', async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('has_preorder_dependency')) return { rows: [{ has_preorder_dependency: true }] };
      return { rows: [] };
    },
    release() {},
  };
  await assert.rejects(
    () => runProductionCatalogReset({ args: validArgs, env: validEnv, fsImpl, pool: { async connect() { return client; } } }),
    /preorder references a target checkout group/,
  );
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
  const sql = calls.map((call) => call.sql).join('\n');
  assert.doesNotMatch(sql, /DELETE FROM (?:products|orders|payment_attempts)\b/);
});
