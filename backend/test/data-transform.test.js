import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  normalizeEmail,
  normalizeRow,
  extractUserIdentities,
  transformDataset,
} from '../database/postgres/migration/export-sqlserver.js';
import {
  buildSequenceResetSql,
  buildInsertStatement,
  IMPORT_DEPENDENCY_ORDER,
} from '../database/postgres/migration/import-postgres.js';
import {
  computeDatasetAggregates,
  reconcileData,
} from '../database/postgres/migration/reconcile.js';

describe('Data Migration & Transform Pipeline Suite', () => {
  it('normalizes Vietnamese phone numbers into canonical 10-digit format', () => {
    assert.equal(normalizePhoneNumber('+84901234567'), '0901234567');
    assert.equal(normalizePhoneNumber('84901234567'), '0901234567');
    assert.equal(normalizePhoneNumber('0901234567'), '0901234567');
    assert.equal(normalizePhoneNumber('090-123-4567'), '0901234567');
    assert.equal(normalizePhoneNumber('  090 123 4567  '), '0901234567');
    assert.equal(normalizePhoneNumber(''), null);
    assert.equal(normalizePhoneNumber(null), null);
  });

  it('normalizes email addresses strictly to trimmed lowercase', () => {
    assert.equal(normalizeEmail('  Admin@TeaPlus.VN  '), 'admin@teaplus.vn');
    assert.equal(normalizeEmail('User.Name+tag@GMAIL.COM'), 'user.name+tag@gmail.com');
    assert.equal(normalizeEmail('invalid-email'), null);
    assert.equal(normalizeEmail(null), null);
  });

  it('normalizes boolean and integer column types accurately for PostgreSQL compatibility', () => {
    const rawProduct = {
      id: '15',
      category_id: '2',
      name: 'Trà Đào Cam Sả',
      price: '35000',
      is_available: 1,
      is_recommended: 0,
      is_bestseller: '1',
      created_at: new Date('2026-08-17T10:00:00.000Z'),
    };

    const normalized = normalizeRow('products', rawProduct);

    assert.equal(normalized.id, 15);
    assert.equal(normalized.category_id, 2);
    assert.equal(normalized.price, 35000);
    assert.equal(normalized.is_available, true);
    assert.equal(normalized.is_recommended, false);
    assert.equal(normalized.is_bestseller, true);
    assert.equal(normalized.created_at, '2026-08-17T10:00:00.000Z');
  });

  it('extracts decoupled user_identities (password & google) from legacy user records', () => {
    const legacyUsers = [
      {
        id: 1,
        fullname: 'Quản Trị Viên',
        phone: '0901111111',
        email: 'admin@teaplus.vn',
        password_hash: '$2a$10$hashed_admin_pass',
        google_id: null,
        created_at: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 2,
        fullname: 'Khách Hàng Google',
        phone: '0902222222',
        email: 'customer@gmail.com',
        password_hash: null,
        google_id: 'google_oauth_id_12345',
        created_at: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 3,
        fullname: 'Khách Hàng Dual Auth',
        phone: '0903333333',
        email: 'dual@gmail.com',
        password_hash: '$2a$10$hashed_pass_dual',
        google_id: 'google_oauth_id_99999',
        created_at: '2026-08-03T00:00:00.000Z',
      },
    ];

    const identities = extractUserIdentities(legacyUsers);

    assert.equal(identities.length, 4); // User 1: 1, User 2: 1, User 3: 2

    const adminIdentity = identities.find((i) => i.user_id === 1);
    assert.equal(adminIdentity.provider, 'password');
    assert.equal(adminIdentity.credential_hash, '$2a$10$hashed_admin_pass');
    assert.equal(adminIdentity.provider_user_id, '0901111111');

    const googleIdentity = identities.find((i) => i.user_id === 2);
    assert.equal(googleIdentity.provider, 'google');
    assert.equal(googleIdentity.credential_hash, null);
    assert.equal(googleIdentity.provider_user_id, 'google_oauth_id_12345');

    const dualIdentities = identities.filter((i) => i.user_id === 3);
    assert.equal(dualIdentities.length, 2);
    assert.ok(dualIdentities.some((i) => i.provider === 'password'));
    assert.ok(dualIdentities.some((i) => i.provider === 'google'));
  });

  it('generates valid PostgreSQL sequence reset SQL query', () => {
    const resetSql = buildSequenceResetSql('orders', 'id');
    assert.ok(resetSql.includes("pg_get_serial_sequence('orders', 'id')"));
    assert.ok(resetSql.includes('COALESCE((SELECT MAX(id) FROM orders), 1)'));
  });

  it('builds parameterized batch INSERT statement with conflict protection', () => {
    const rows = [
      { id: 1, name: 'Chi nhánh 1', is_active: true },
      { id: 2, name: 'Chi nhánh 2', is_active: true },
    ];

    const stmt = buildInsertStatement('stores', rows);

    assert.ok(stmt.sql.includes('INSERT INTO "stores" ("id", "name", "is_active") VALUES'));
    assert.ok(stmt.sql.includes('($1, $2, $3)'));
    assert.ok(stmt.sql.includes('($4, $5, $6)'));
    assert.ok(stmt.sql.includes('ON CONFLICT ("id") DO NOTHING'));
    assert.equal(stmt.params.length, 6);
    assert.deepEqual(stmt.params, [1, 'Chi nhánh 1', true, 2, 'Chi nhánh 2', true]);
  });

  it('verifies topological IMPORT_DEPENDENCY_ORDER satisfies relational foreign key constraints', () => {
    // Check key dependencies
    const storeIdx = IMPORT_DEPENDENCY_ORDER.indexOf('stores');
    const tableIdx = IMPORT_DEPENDENCY_ORDER.indexOf('tables');
    const orderIdx = IMPORT_DEPENDENCY_ORDER.indexOf('orders');
    const itemIdx = IMPORT_DEPENDENCY_ORDER.indexOf('order_items');
    const toppingIdx = IMPORT_DEPENDENCY_ORDER.indexOf('order_item_toppings');

    assert.ok(storeIdx < tableIdx, 'stores must precede tables');
    assert.ok(tableIdx < orderIdx, 'tables must precede orders');
    assert.ok(orderIdx < itemIdx, 'orders must precede order_items');
    assert.ok(itemIdx < toppingIdx, 'order_items must precede order_item_toppings');
  });

  it('reconciles dataset correctly and catches mismatches in row count and core aggregates', () => {
    const dataset = {
      orders: [
        { id: 1, total: 50000, subtotal: 60000, discount_amount: 10000 },
        { id: 2, total: 40000, subtotal: 40000, discount_amount: 0 },
      ],
      order_items: [
        { id: 1, order_id: 1, qty: 2, line_total: 60000 },
        { id: 2, order_id: 2, qty: 1, line_total: 40000 },
      ],
      order_item_toppings: [
        { id: 1, order_item_id: 1, topping_price: 5000 },
      ],
      order_status_history: [{ id: 1, order_id: 1 }],
      voucher_usage_history: [{ id: 1, promotion_id: 1 }],
      users: [{ id: 1, fullname: 'A' }],
      user_identities: [{ id: 1, user_id: 1 }],
    };

    const expectedAggs = computeDatasetAggregates(dataset);

    // 1. Perfect match case
    const matchResult = reconcileData(expectedAggs, expectedAggs);
    assert.equal(matchResult.success, true);
    assert.equal(matchResult.mismatch_count, 0);

    // 2. Mismatch case (lost order revenue)
    const corruptedAggs = JSON.parse(JSON.stringify(expectedAggs));
    corruptedAggs.aggregates.orders_total_sum = 80000; // missing 10,000

    const failResult = reconcileData(expectedAggs, corruptedAggs);
    assert.equal(failResult.success, false);
    assert.equal(failResult.mismatch_count, 1);
    assert.equal(failResult.mismatches[0].metric, 'aggregate:orders_total_sum');
    assert.equal(failResult.mismatches[0].expected, 90000);
    assert.equal(failResult.mismatches[0].actual, 80000);
  });
});
