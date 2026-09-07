import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { createPaymentAttemptsRepository } from '../repositories/postgres/payment-attempts.js';

const { Pool } = pg;
const enabled = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0026_payment_attempts_additive.sql');

function schemaName() {
  return `p1_0026_repo_${crypto.randomBytes(6).toString('hex')}`;
}

async function createPost0025RepositoryFixture(client, schema) {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}", public`);
  await client.query(`
    CREATE TABLE payment_profiles (code VARCHAR(50) PRIMARY KEY);
    CREATE TABLE checkout_groups (
      id BIGINT PRIMARY KEY,
      group_code VARCHAR(50),
      total_amount NUMERIC(15, 2) NOT NULL,
      payment_provider VARCHAR(30) NOT NULL DEFAULT 'payos',
      payment_status VARCHAR(30) NOT NULL,
      payment_profile_code VARCHAR(50) NOT NULL,
      payment_profile_version INT,
      payment_link_id VARCHAR(100), payos_order_code BIGINT,
      payment_checkout_url TEXT, payment_qr_code TEXT,
      payment_created_at TIMESTAMPTZ, payment_expires_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE orders (
      id BIGINT PRIMARY KEY,
      order_code VARCHAR(50), user_id BIGINT, cancel_token_hash VARCHAR(255),
      total NUMERIC(15, 2) NOT NULL,
      checkout_group_id BIGINT,
      payment_provider VARCHAR(30), payment_status VARCHAR(20) NOT NULL,
      current_status VARCHAR(30), payment_profile_code VARCHAR(50), payment_profile_version INT,
      payment_link_id VARCHAR(100), payos_order_code BIGINT,
      payment_checkout_url TEXT, payment_qr_code TEXT,
      payment_created_at TIMESTAMPTZ, payment_expires_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE payment_events (
      id BIGINT PRIMARY KEY, provider VARCHAR(50) NOT NULL,
      provider_event_key VARCHAR(255) NOT NULL UNIQUE, order_id BIGINT,
      event_type VARCHAR(100) NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      processing_status VARCHAR(50) NOT NULL DEFAULT 'pending', error_code VARCHAR(100),
      processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO payment_profiles (code) VALUES ('DIRECT_A'), ('GROUP_CHECKOUT');
    INSERT INTO checkout_groups (id, total_amount, payment_status, payment_profile_code, payment_profile_version)
    VALUES (10, 50000, 'unpaid', 'GROUP_CHECKOUT', 1),
           (11, 51000, 'cancelled', 'GROUP_CHECKOUT', 1),
           (12, 52000, 'unpaid', 'GROUP_CHECKOUT', 1);
    INSERT INTO orders (id, total, checkout_group_id, payment_provider, payment_status, current_status, payment_profile_code, payment_profile_version)
    VALUES (1, 10000, NULL, 'payos', 'unpaid', 'Chờ xác nhận', 'DIRECT_A', 1),
           (2, 20000, 10, 'payos', 'unpaid', 'Chờ xác nhận', 'DIRECT_A', 1),
           (3, 30000, NULL, 'payos', 'unpaid', 'Đã hủy', 'DIRECT_A', 1),
           (4, 40000, NULL, 'payos', 'unpaid', 'Chờ xác nhận', 'DIRECT_A', 1),
           (5, 60000, NULL, 'payos', 'unpaid', 'Chờ xác nhận', 'DIRECT_A', 1);
  `);
}

function transactionAdapter(client) {
  return {
    transaction: async (runner) => runner({
      query: async (sql, params = []) => {
        const result = await client.query(sql, params);
        return [result.rows, result.rowCount ?? 0];
      },
    }),
  };
}

describe('PostgreSQL payment-attempt repository primitives', () => {
  it('keeps attempts immutable, locks target lifecycle, and preserves a correct current pointer', async (t) => {
    if (!enabled || !testDbUrl) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    assert.equal(validatePostgresTestGuard(testDbUrl).valid, true);
    const sql = await readFile(migrationPath, 'utf8');
    const pool = new Pool(getPostgresPoolConfig(testDbUrl));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await createPost0025RepositoryFixture(client, schemaName());
      await client.query(sql);
      const repo = createPaymentAttemptsRepository(transactionAdapter(client));
      const expiry = '2026-09-06T12:15:00.000Z';
      // Provider identity locks intentionally survive only for the transaction.
      // Keep each rehearsal run distinct so an interrupted prior test cannot
      // block a fresh, isolated schema.
      const providerCodeBase = (Number.parseInt(crypto.randomBytes(5).toString('hex'), 16) % 800000000) + 100000000;
      const firstProviderCode = providerCodeBase + 1;
      const secondProviderCode = providerCodeBase + 2;
      const expiringProviderCode = providerCodeBase + 4;
      const groupedProviderCode = providerCodeBase + 10;
      const failedProviderCode = providerCodeBase + 5;

      const first = await repo.createCreatingAttempt({ orderId: 1, paymentProfileCode: 'DIRECT_A', paymentProfileVersion: 1, amount: 10000, providerOrderCode: firstProviderCode, expiresAt: expiry });
      assert.equal(first.status, 'creating');
      const activatedFirst = await repo.activateAttempt({ attemptId: first.id, providerOrderCode: firstProviderCode, paymentLinkId: 'link-first', checkoutUrl: 'https://payos.test/first', qrCode: 'qr-first', expiresAt: expiry });
      assert.equal(activatedFirst.status, 'active');
      const activatedRetry = await repo.activateAttempt({ attemptId: first.id, providerOrderCode: firstProviderCode, paymentLinkId: 'link-first', checkoutUrl: 'https://payos.test/first', qrCode: 'qr-first', expiresAt: expiry });
      assert.equal(Number(activatedRetry.id), Number(first.id));
      const { rows: [firstMirror] } = await client.query('SELECT current_payment_attempt_id, payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code FROM orders WHERE id = 1');
      assert.deepEqual(firstMirror, { current_payment_attempt_id: String(first.id), payment_link_id: 'link-first', payos_order_code: String(firstProviderCode), payment_checkout_url: 'https://payos.test/first', payment_qr_code: 'qr-first' });

      await assert.rejects(
        () => repo.activateAttempt({ attemptId: first.id, providerOrderCode: firstProviderCode, paymentLinkId: 'link-mutated', checkoutUrl: 'https://payos.test/first', qrCode: 'qr-first', expiresAt: expiry }),
        (error) => error.code === 'PAYMENT_ATTEMPT_ARTIFACT_IMMUTABLE',
      );

      const second = await repo.createCreatingAttempt({ orderId: 1, paymentProfileCode: 'DIRECT_A', paymentProfileVersion: 1, amount: 10000, providerOrderCode: secondProviderCode, expiresAt: expiry });
      const { rows: [beforePromotion] } = await client.query(`
        SELECT o.current_payment_attempt_id, o.payment_link_id,
               first_attempt.status AS first_status, second_attempt.status AS second_status
        FROM orders o
        JOIN payment_attempts first_attempt ON first_attempt.id = $1
        JOIN payment_attempts second_attempt ON second_attempt.id = $2
        WHERE o.id = 1
      `, [first.id, second.id]);
      assert.deepEqual(beforePromotion, {
        current_payment_attempt_id: String(first.id), payment_link_id: 'link-first',
        first_status: 'active', second_status: 'creating',
      });
      await repo.activateAttempt({ attemptId: second.id, providerOrderCode: secondProviderCode, paymentLinkId: 'link-second', checkoutUrl: 'https://payos.test/second', qrCode: 'qr-second', expiresAt: expiry });
      const { rows: afterReplacement } = await client.query('SELECT id, status, provider_payment_link_id FROM payment_attempts WHERE id = ANY($1::bigint[]) ORDER BY id', [[first.id, second.id]]);
      assert.deepEqual(afterReplacement, [
        { id: String(first.id), status: 'superseded', provider_payment_link_id: 'link-first' },
        { id: String(second.id), status: 'active', provider_payment_link_id: 'link-second' },
      ]);

      const latePaid = await repo.markAttemptPaid({ attemptId: first.id, paidAt: '2026-09-06T12:05:00.000Z' });
      assert.equal(latePaid.status, 'paid');
      const { rows: [afterLatePaid] } = await client.query(`
        SELECT o.payment_status, o.current_payment_attempt_id, o.payment_link_id,
               (o.paid_at IS NOT NULL) AS has_paid_at,
               a1.status AS first_status, a2.status AS second_status
        FROM orders o
        JOIN payment_attempts a1 ON a1.id = $1
        JOIN payment_attempts a2 ON a2.id = $2
        WHERE o.id = 1
      `, [first.id, second.id]);
      assert.deepEqual(afterLatePaid, {
        payment_status: 'paid', current_payment_attempt_id: String(first.id), payment_link_id: 'link-first', has_paid_at: true,
        first_status: 'paid', second_status: 'superseded',
      });
      await assert.rejects(
        () => repo.createCreatingAttempt({ orderId: 1, paymentProfileCode: 'DIRECT_A', amount: 10000, providerOrderCode: providerCodeBase + 3, expiresAt: expiry }),
        (error) => error.code === 'PAYMENT_ATTEMPT_TARGET_PAID',
      );

      const expiring = await repo.createCreatingAttempt({ orderId: 4, paymentProfileCode: 'DIRECT_A', amount: 40000, providerOrderCode: expiringProviderCode, expiresAt: expiry });
      await repo.activateAttempt({ attemptId: expiring.id, providerOrderCode: expiringProviderCode, paymentLinkId: 'link-expiring', checkoutUrl: 'https://payos.test/expiring', qrCode: 'qr-expiring', expiresAt: expiry });
      const expired = await repo.expireAttempt({ attemptId: expiring.id, expiredAt: '2026-09-06T12:16:00.000Z' });
      assert.equal(expired.status, 'expired');
      const lateExpiredPaid = await repo.markAttemptPaid({ attemptId: expiring.id, paidAt: '2026-09-06T12:17:00.000Z' });
      assert.equal(lateExpiredPaid.status, 'paid');
      const { rows: [expiredTarget] } = await client.query('SELECT payment_status, current_payment_attempt_id FROM orders WHERE id = 4');
      assert.deepEqual(expiredTarget, { payment_status: 'paid', current_payment_attempt_id: String(expiring.id) });

      const grouped = await repo.createCreatingAttempt({ checkoutGroupId: 10, paymentProfileCode: 'GROUP_CHECKOUT', amount: 50000, providerOrderCode: groupedProviderCode, expiresAt: expiry });
      await repo.activateAttempt({ attemptId: grouped.id, providerOrderCode: groupedProviderCode, paymentLinkId: 'link-group', checkoutUrl: 'https://payos.test/group', qrCode: 'qr-group', expiresAt: expiry });
      const { rows: [groupMirror] } = await client.query('SELECT current_payment_attempt_id, payment_link_id, payos_order_code FROM checkout_groups WHERE id = 10');
      assert.deepEqual(groupMirror, { current_payment_attempt_id: String(grouped.id), payment_link_id: 'link-group', payos_order_code: String(groupedProviderCode) });

      const groupedReplacement = await repo.createCreatingAttempt({ checkoutGroupId: 10, paymentProfileCode: 'GROUP_CHECKOUT', amount: 50000, providerOrderCode: providerCodeBase + 12, expiresAt: expiry });
      const { rows: [groupBeforePromotion] } = await client.query(`
        SELECT cg.current_payment_attempt_id, cg.payment_link_id,
               old_attempt.status AS old_status, replacement.status AS replacement_status
        FROM checkout_groups cg
        JOIN payment_attempts old_attempt ON old_attempt.id = $1
        JOIN payment_attempts replacement ON replacement.id = $2
        WHERE cg.id = 10
      `, [grouped.id, groupedReplacement.id]);
      assert.deepEqual(groupBeforePromotion, {
        current_payment_attempt_id: String(grouped.id), payment_link_id: 'link-group',
        old_status: 'active', replacement_status: 'creating',
      });
      await repo.activateAttempt({ attemptId: groupedReplacement.id, providerOrderCode: providerCodeBase + 12, paymentLinkId: 'link-group-replacement', checkoutUrl: 'https://payos.test/group-replacement', qrCode: 'qr-group-replacement', expiresAt: expiry });
      const { rows: [groupAfterPromotion] } = await client.query(`
        SELECT cg.current_payment_attempt_id, cg.payment_link_id,
               old_attempt.status AS old_status, replacement.status AS replacement_status
        FROM checkout_groups cg
        JOIN payment_attempts old_attempt ON old_attempt.id = $1
        JOIN payment_attempts replacement ON replacement.id = $2
        WHERE cg.id = 10
      `, [grouped.id, groupedReplacement.id]);
      assert.deepEqual(groupAfterPromotion, {
        current_payment_attempt_id: String(groupedReplacement.id), payment_link_id: 'link-group-replacement',
        old_status: 'superseded', replacement_status: 'active',
      });

      const groupRace = await repo.createCreatingAttempt({ checkoutGroupId: 12, paymentProfileCode: 'GROUP_CHECKOUT', amount: 52000, providerOrderCode: providerCodeBase + 13, expiresAt: expiry });
      await client.query("UPDATE checkout_groups SET payment_status = 'paid' WHERE id = 12");
      const lateGroupActivation = await repo.activateAttempt({ attemptId: groupRace.id, providerOrderCode: providerCodeBase + 13, paymentLinkId: 'link-group-race', checkoutUrl: 'https://payos.test/group-race', qrCode: 'qr-group-race', expiresAt: expiry });
      assert.equal(lateGroupActivation.kind, 'target_closed');
      assert.equal(lateGroupActivation.attempt.status, 'superseded');

      await assert.rejects(
        () => repo.createCreatingAttempt({ orderId: 2, paymentProfileCode: 'DIRECT_A', amount: 20000, providerOrderCode: providerCodeBase + 20, expiresAt: expiry }),
        (error) => error.code === 'GROUP_CHILD_DIRECT_ATTEMPT_FORBIDDEN',
      );
      await assert.rejects(
        () => repo.createCreatingAttempt({ orderId: 3, paymentProfileCode: 'DIRECT_A', amount: 30000, providerOrderCode: providerCodeBase + 30, expiresAt: expiry }),
        (error) => error.code === 'PAYMENT_ATTEMPT_TARGET_CANCELLED',
      );
      await assert.rejects(
        () => repo.createCreatingAttempt({ checkoutGroupId: 11, paymentProfileCode: 'GROUP_CHECKOUT', amount: 51000, providerOrderCode: providerCodeBase + 11, expiresAt: expiry }),
        (error) => error.code === 'PAYMENT_ATTEMPT_TARGET_CANCELLED',
      );

      const failing = await repo.createCreatingAttempt({ orderId: 5, paymentProfileCode: 'DIRECT_A', amount: 60000, providerOrderCode: failedProviderCode, expiresAt: expiry });
      const failed = await repo.failAttempt({ attemptId: failing.id, failureCode: 'PROVIDER_TIMEOUT' });
      assert.equal(failed.status, 'failed');
      await assert.rejects(
        () => repo.expireAttempt({ attemptId: failing.id }),
        (error) => error.code === 'PAYMENT_ATTEMPT_TRANSITION_INVALID',
      );

      const candidates = await repo.findAttemptsByProviderIdentifiers({ providerOrderCode: firstProviderCode });
      assert.equal(candidates.length, 1);
      assert.equal(Number(candidates[0].id), Number(first.id));
      const activeGroup = await repo.findActiveOrCreatingAttemptForTarget({ checkoutGroupId: 10 });
      assert.equal(Number(activeGroup.id), Number(grouped.id));
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
});
