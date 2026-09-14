import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_ATTEMPT_STATUSES,
  PaymentAttemptError,
  createPaymentAttemptsRepository,
  isPaymentAttemptTransitionAllowed,
} from '../repositories/postgres/payment-attempts.js';

describe('payment-attempt repository lifecycle contract', () => {
  it('permits the approved lifecycle, including late expired/superseded payments only', () => {
    assert.deepEqual(PAYMENT_ATTEMPT_STATUSES, ['creating', 'active', 'expired', 'superseded', 'paid', 'failed']);
    assert.equal(isPaymentAttemptTransitionAllowed('creating', 'active'), true);
    assert.equal(isPaymentAttemptTransitionAllowed('active', 'expired'), true);
    assert.equal(isPaymentAttemptTransitionAllowed('active', 'superseded'), true);
    assert.equal(isPaymentAttemptTransitionAllowed('expired', 'paid'), true);
    assert.equal(isPaymentAttemptTransitionAllowed('superseded', 'paid'), true);
    assert.equal(isPaymentAttemptTransitionAllowed('failed', 'paid'), false);
    assert.equal(isPaymentAttemptTransitionAllowed('paid', 'active'), false);
    assert.equal(isPaymentAttemptTransitionAllowed('expired', 'active'), false);
  });

  it('rejects malformed target/identifier/artifact inputs before issuing SQL', async () => {
    let queryCalls = 0;
    const repo = createPaymentAttemptsRepository({
      transaction: async (runner) => runner({ query: async () => { queryCalls += 1; return [[], 0]; } }),
    });

    await assert.rejects(
      () => repo.createCreatingAttempt({ orderId: 1, checkoutGroupId: 2, amount: 1, paymentProfileCode: 'DIRECT', providerOrderCode: 1001 }),
      (error) => error instanceof PaymentAttemptError && error.code === 'PAYMENT_ATTEMPT_TARGET_REQUIRED',
    );
    await assert.rejects(
      () => repo.findAttemptsByProviderIdentifiers({}),
      (error) => error instanceof PaymentAttemptError && error.code === 'PAYMENT_ATTEMPT_IDENTIFIER_REQUIRED',
    );
    await assert.rejects(
      () => repo.activateAttempt({ attemptId: 1, providerOrderCode: 1001, paymentLinkId: 'link-only' }),
      (error) => error instanceof PaymentAttemptError && error.code === 'PAYMENT_ATTEMPT_ARTIFACTS_INCOMPLETE',
    );
    assert.equal(queryCalls, 0);
  });

  it('locks the target and reserves a creating attempt without moving the current pointer early', async () => {
    const queries = [];
    const repo = createPaymentAttemptsRepository({
      transaction: async (runner) => runner({
        query: async (sql, params = []) => {
          queries.push({ sql, params });
          if (/FROM orders(?: o)?/i.test(sql) && /id =/i.test(sql) && !sql.includes('FOR UPDATE')) {
            return [[{ id: 11, total: 50000, payment_provider: 'payos', payment_status: 'unpaid', checkout_group_id: null, current_status: 'Chờ xác nhận', current_payment_attempt_id: null }], 1];
          }
          if (/FROM orders(?: o)?/i.test(sql) && /id =/i.test(sql) && sql.includes('FOR UPDATE')) {
            return [[{ id: 11, total: 50000, payment_provider: 'payos', payment_status: 'unpaid', checkout_group_id: null, current_status: 'Chờ xác nhận', current_payment_attempt_id: null }], 1];
          }
          if (sql.includes('SELECT id FROM payment_attempts')) return [[], 0];
          if (sql.includes('INSERT INTO payment_attempts')) {
            return [[{ id: 91, target_type: 'order', order_id: 11, status: 'creating', provider_order_code: '990011' }], 1];
          }
          return [[], 1];
        },
      }),
    });

    const created = await repo.createCreatingAttempt({
      orderId: 11, provider: 'payos', paymentProfileCode: 'DIRECT_A', paymentProfileVersion: 2,
      amount: 50000, providerOrderCode: 990011, expiresAt: '2026-09-06T12:00:00.000Z',
    });
    assert.equal(created.id, 91);
    const targetLock = queries.find((query) => /FROM orders(?: o)?/i.test(query.sql) && /id =/i.test(query.sql));
    const creatingLock = queries.find((query) => query.sql.includes("status = 'creating'"));
    const insert = queries.find((query) => query.sql.includes('INSERT INTO payment_attempts'));
    const pointer = queries.find((query) => query.sql.includes('current_payment_attempt_id = $2'));
    assert.match(targetLock.sql, /FOR UPDATE/);
    assert.equal(queries.some((query) => query.sql.includes('pg_advisory_xact_lock')), true);
    assert.match(creatingLock.sql, /FOR UPDATE/);
    assert.equal(insert.params[7], 990011);
    assert.equal(pointer, undefined);
  });

  it('expireAttemptFromProviderTerminalState locks target first then attempt, updates pointer when current, and writes audit event', async () => {
    const queries = [];
    const repo = createPaymentAttemptsRepository({
      transaction: async (runner) => runner({
        query: async (sql, params = []) => {
          queries.push({ sql, params });
          if (sql.includes('SELECT * FROM payment_attempts WHERE id = $1') && !sql.includes('FOR UPDATE')) {
            return [[{ id: 101, order_id: 11, checkout_group_id: null, status: 'active', payment_profile_code: 'DIRECT', provider: 'payos', provider_order_code: 990011 }], 1];
          }
          if (/FROM orders(?: o)?/i.test(sql) && /id =/i.test(sql) && sql.includes('FOR UPDATE')) {
            return [[{ id: 11, total: 50000, payment_provider: 'payos', payment_status: 'unpaid', current_payment_attempt_id: 101 }], 1];
          }
          if (sql.includes('FROM payment_attempts') && sql.includes('FOR UPDATE')) {
            return [[{ id: 101, order_id: 11, checkout_group_id: null, status: 'active', payment_profile_code: 'DIRECT', provider: 'payos', provider_order_code: 990011 }], 1];
          }
          if (sql.includes('UPDATE payment_attempts') && sql.includes("SET status = 'expired'")) {
            return [[{ id: 101, order_id: 11, status: 'expired' }], 1];
          }
          if (/UPDATE\s+orders(?: o)?\s+SET[\s\S]*payment_status\s*=\s*'expired'/i.test(sql)) {
            return [[{ id: 11, payment_status: 'expired' }], 1];
          }
          if (sql.includes('INSERT INTO payment_events')) {
            return [[{ id: 801 }], 1];
          }
          return [[], 1];
        },
      }),
    });

    const result = await repo.expireAttemptFromProviderTerminalState({
      attemptId: 101,
      providerStatus: 'CANCELLED',
    });

    assert.equal(result.changed, true);
    assert.equal(result.attempt.status, 'expired');

    const targetLockIndex = queries.findIndex((q) => /FROM orders(?: o)?/i.test(q.sql) && /id =/i.test(q.sql) && q.sql.includes('FOR UPDATE'));
    const attemptLockIndex = queries.findIndex((q) => q.sql.includes('FROM payment_attempts') && q.sql.includes('FOR UPDATE'));
    assert.ok(targetLockIndex >= 0 && attemptLockIndex >= 0);
    assert.ok(targetLockIndex < attemptLockIndex, 'target must be locked before attempt');

    const targetExpire = queries.find((q) => /UPDATE\s+orders(?: o)?\s+SET[\s\S]*payment_status\s*=\s*'expired'/i.test(q.sql));
    assert.ok(targetExpire, 'target must be marked expired when attempt is current pointer');
    assert.equal(targetExpire.params[0], 11);

    const auditEvent = queries.find((q) => q.sql.includes('INSERT INTO payment_events'));
    assert.ok(auditEvent, 'payment_events audit entry must be inserted');
    assert.match(auditEvent.params[2], /PROVIDER_LINK_CANCELLED/);
  });

  it('expireAttemptFromProviderTerminalState does not mark target expired if attempt is not the current pointer', async () => {
    const queries = [];
    const repo = createPaymentAttemptsRepository({
      transaction: async (runner) => runner({
        query: async (sql, params = []) => {
          queries.push({ sql, params });
          if (sql.includes('SELECT * FROM payment_attempts WHERE id = $1') && !sql.includes('FOR UPDATE')) {
            return [[{ id: 101, order_id: 11, checkout_group_id: null, status: 'active', payment_profile_code: 'DIRECT', provider: 'payos', provider_order_code: 990011 }], 1];
          }
          if (/FROM orders(?: o)?/i.test(sql) && /id =/i.test(sql) && sql.includes('FOR UPDATE')) {
            // Note: current pointer is 102, NOT 101
            return [[{ id: 11, total: 50000, payment_provider: 'payos', payment_status: 'unpaid', current_payment_attempt_id: 102 }], 1];
          }
          if (sql.includes('FROM payment_attempts') && sql.includes('FOR UPDATE')) {
            return [[{ id: 101, order_id: 11, checkout_group_id: null, status: 'active', payment_profile_code: 'DIRECT', provider: 'payos', provider_order_code: 990011 }], 1];
          }
          if (sql.includes('UPDATE payment_attempts') && sql.includes("SET status = 'expired'")) {
            return [[{ id: 101, order_id: 11, status: 'expired' }], 1];
          }
          if (sql.includes('INSERT INTO payment_events')) {
            return [[{ id: 801 }], 1];
          }
          return [[], 1];
        },
      }),
    });

    const result = await repo.expireAttemptFromProviderTerminalState({
      attemptId: 101,
      providerStatus: 'EXPIRED',
    });

    assert.equal(result.changed, true);
    const targetExpire = queries.find((q) => q.sql.includes('UPDATE orders o SET payment_status = \'expired\''));
    assert.equal(targetExpire, undefined, 'must NOT mark target expired if attempt is not current pointer');
  });

  it('expireAttemptFromProviderTerminalState returns changed:false idempotently when attempt is already expired or non-active', async () => {
    const repo = createPaymentAttemptsRepository({
      transaction: async (runner) => runner({
        query: async (sql) => {
          if (sql.includes('SELECT * FROM payment_attempts WHERE id = $1') && !sql.includes('FOR UPDATE')) {
            return [[{ id: 101, order_id: 11, checkout_group_id: null, status: 'expired' }], 1];
          }
          if (/FROM orders(?: o)?/i.test(sql) && /id =/i.test(sql) && sql.includes('FOR UPDATE')) {
            return [[{ id: 11, current_payment_attempt_id: 101 }], 1];
          }
          if (sql.includes('FROM payment_attempts') && sql.includes('FOR UPDATE')) {
            return [[{ id: 101, status: 'expired' }], 1];
          }
          return [[], 1];
        },
      }),
    });

    const result = await repo.expireAttemptFromProviderTerminalState({ attemptId: 101, providerStatus: 'CANCELLED' });
    assert.equal(result.changed, false);
    assert.equal(result.attempt.status, 'expired');
  });
});
