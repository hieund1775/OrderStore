import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';

const { Pool } = pg;
const testDbUrl = process.env.TEST_DATABASE_URL;
const enabled = process.env.POSTGRES_INTEGRATION === '1';
const testDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0026_payment_attempts_additive.sql');

function schemaName() {
  return `p1_0026_rehearsal_${crypto.randomBytes(6).toString('hex')}`;
}

async function createPost0025Baseline(client, schema) {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}", public`);
  await client.query(`
    CREATE TABLE payment_profiles (
      code VARCHAR(50) PRIMARY KEY
    );
    CREATE TABLE orders (
      id BIGINT PRIMARY KEY,
      total NUMERIC(15, 2) NOT NULL,
      checkout_group_id BIGINT,
      payment_provider VARCHAR(30),
      payment_status VARCHAR(20) NOT NULL,
      payment_profile_code VARCHAR(50),
      payment_profile_version INT,
      payment_link_id VARCHAR(100),
      payos_order_code BIGINT,
      payment_checkout_url TEXT,
      payment_qr_code TEXT,
      payment_created_at TIMESTAMPTZ,
      payment_expires_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ
    );
    CREATE TABLE checkout_groups (
      id BIGINT PRIMARY KEY,
      total_amount NUMERIC(15, 2) NOT NULL,
      payment_provider VARCHAR(30) NOT NULL DEFAULT 'payos',
      payment_status VARCHAR(30) NOT NULL,
      payment_profile_code VARCHAR(50) NOT NULL,
      payment_profile_version INT,
      payment_link_id VARCHAR(100),
      payos_order_code BIGINT,
      payment_checkout_url TEXT,
      payment_qr_code TEXT,
      payment_created_at TIMESTAMPTZ,
      payment_expires_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ
    );
    CREATE TABLE payment_events (
      id BIGINT PRIMARY KEY,
      provider VARCHAR(50) NOT NULL,
      provider_event_key VARCHAR(255) NOT NULL UNIQUE,
      order_id BIGINT,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      error_code VARCHAR(100),
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`
    INSERT INTO payment_profiles (code) VALUES
      ('QUAN__O'), ('GROUP_CHECKOUT'), ('DEFAULT_PROFILE');
    INSERT INTO orders (
      id, total, payment_provider, payment_status, payment_profile_code, payment_profile_version,
      payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code,
      payment_created_at, payment_expires_at, paid_at
    ) VALUES
      (101, 41000, 'payos', 'paid', 'QUAN__O', 3, 'direct-paid-link', 8101, 'https://payos.test/8101', 'qr-8101', '2026-09-01T00:00:00Z', '2026-09-01T00:15:00Z', '2026-09-01T00:05:00Z'),
      (102, 42000, 'payos', 'unpaid', 'DEFAULT_PROFILE', 2, 'direct-active-link', 8102, 'https://payos.test/8102', 'qr-8102', '2026-09-01T00:00:00Z', '2026-09-01T00:15:00Z', NULL),
      (103, 43000, 'payos', 'unpaid', 'QUAN__O', 3, NULL, 8103, NULL, NULL, '2026-09-01T00:00:00Z', '2026-09-01T00:15:00Z', NULL),
      (104, 44000, 'payos', 'unpaid', 'QUAN__O', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (105, 45000, 'payos', 'unpaid', 'QUAN__O', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO checkout_groups (
      id, total_amount, payment_provider, payment_status, payment_profile_code, payment_profile_version,
      payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code,
      payment_created_at, payment_expires_at, paid_at
    ) VALUES
      (201, 83000, 'payos', 'expired', 'GROUP_CHECKOUT', 1, 'group-expired-link', 8201, 'https://payos.test/8201', 'qr-8201', '2026-09-01T00:00:00Z', '2026-09-01T00:15:00Z', NULL);
  `);
}

describe('P1 phase 0026 payment-attempt migration rehearsal', () => {
  it('backfills a dedicated post-0025 baseline immutably and is idempotent', async (t) => {
    if (!enabled || !testDbUrl) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    assert.equal(validatePostgresTestGuard(testDbUrl).valid, true);
    const sql = await readFile(migrationPath, 'utf8');
    const pool = new Pool(getPostgresPoolConfig(testDbUrl));
    const client = await pool.connect();
    const schema = schemaName();

    try {
      await client.query('BEGIN');
      await createPost0025Baseline(client, schema);
      await client.query(sql);
      await client.query(sql);

      const attempts = await client.query(`
        SELECT target_type, order_id, checkout_group_id, provider, payment_profile_code,
               amount::TEXT AS amount, provider_order_code, provider_payment_link_id, status,
               paid_at IS NOT NULL AS has_paid_at, expired_at IS NOT NULL AS has_expired_at
        FROM payment_attempts
        ORDER BY id
      `);
      assert.deepEqual(attempts.rows, [
        { target_type: 'order', order_id: '101', checkout_group_id: null, provider: 'payos', payment_profile_code: 'QUAN__O', amount: '41000.00', provider_order_code: '8101', provider_payment_link_id: 'direct-paid-link', status: 'paid', has_paid_at: true, has_expired_at: false },
        { target_type: 'order', order_id: '102', checkout_group_id: null, provider: 'payos', payment_profile_code: 'DEFAULT_PROFILE', amount: '42000.00', provider_order_code: '8102', provider_payment_link_id: 'direct-active-link', status: 'active', has_paid_at: false, has_expired_at: false },
        { target_type: 'order', order_id: '103', checkout_group_id: null, provider: 'payos', payment_profile_code: 'QUAN__O', amount: '43000.00', provider_order_code: '8103', provider_payment_link_id: null, status: 'creating', has_paid_at: false, has_expired_at: false },
        { target_type: 'checkout_group', order_id: null, checkout_group_id: '201', provider: 'payos', payment_profile_code: 'GROUP_CHECKOUT', amount: '83000.00', provider_order_code: '8201', provider_payment_link_id: 'group-expired-link', status: 'expired', has_paid_at: false, has_expired_at: true },
      ]);

      const pointers = await client.query(`
        SELECT 'order' AS target_type, id, current_payment_attempt_id IS NOT NULL AS attached
        FROM orders
        UNION ALL
        SELECT 'checkout_group' AS target_type, id, current_payment_attempt_id IS NOT NULL AS attached
        FROM checkout_groups
        ORDER BY target_type, id
      `);
      assert.deepEqual(pointers.rows, [
        { target_type: 'checkout_group', id: '201', attached: true },
        { target_type: 'order', id: '101', attached: true },
        { target_type: 'order', id: '102', attached: true },
        { target_type: 'order', id: '103', attached: true },
        { target_type: 'order', id: '104', attached: false },
        { target_type: 'order', id: '105', attached: false },
      ]);

      const compatibility = await client.query(`
        SELECT payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code
        FROM orders WHERE id = 102
      `);
      assert.deepEqual(compatibility.rows[0], {
        payment_link_id: 'direct-active-link', payos_order_code: '8102',
        payment_checkout_url: 'https://payos.test/8102', payment_qr_code: 'qr-8102',
      });
      const eventColumns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'payment_events'
          AND column_name IN ('payment_attempt_id', 'checkout_group_id', 'payment_profile_code', 'provider_payment_identity')
        ORDER BY column_name
      `);
      assert.deepEqual(eventColumns.rows.map((row) => row.column_name), [
        'checkout_group_id', 'payment_attempt_id', 'payment_profile_code', 'provider_payment_identity',
      ]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });

  it('fails closed before a partial backfill when an artifact lacks a resolvable profile', async (t) => {
    if (!enabled || !testDbUrl) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    assert.equal(validatePostgresTestGuard(testDbUrl).valid, true);
    const sql = await readFile(migrationPath, 'utf8');
    const pool = new Pool(getPostgresPoolConfig(testDbUrl));
    const client = await pool.connect();
    const schema = schemaName();

    try {
      await client.query('BEGIN');
      await createPost0025Baseline(client, schema);
      await client.query(`
        INSERT INTO orders (
          id, total, payment_provider, payment_status, payment_profile_code,
          payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code,
          payment_created_at, payment_expires_at
        ) VALUES (106, 46000, 'payos', 'unpaid', 'MISSING_PROFILE', 'bad-link', 8106,
                  'https://payos.test/8106', 'qr-8106', '2026-09-01T00:00:00Z', '2026-09-01T00:15:00Z')
      `);
      await client.query('SAVEPOINT p1_0026_apply');
      await assert.rejects(
        () => client.query(sql),
        /legacy PayOS artifact has no resolvable payment profile snapshot/i,
      );
      await client.query('ROLLBACK TO SAVEPOINT p1_0026_apply');
      const tables = await client.query(`
        SELECT to_regclass('payment_attempts') AS payment_attempts_table
      `);
      assert.equal(tables.rows[0].payment_attempts_table, null);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
});
