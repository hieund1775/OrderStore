import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWebhookError,
  classifyCASZeroAffected,
  PAYOS_CAS_UPDATE_SQL,
} from '../services/webhook-classifier.js';

describe('PayOS Webhook & Payment State Engine (Production Module)', () => {
  it('exports valid CAS query structure with payment_status=unpaid and total constraints', () => {
    assert.match(PAYOS_CAS_UPDATE_SQL, /payment_status = 'unpaid'/);
    assert.match(PAYOS_CAS_UPDATE_SQL, /payment_provider = 'payos'/);
    assert.match(PAYOS_CAS_UPDATE_SQL, /total = \$4/);
    assert.match(PAYOS_CAS_UPDATE_SQL, /payment_status = 'paid'/);
  });

  it('classifies zero-affected CAS results into correct business rejections and idempotent success', () => {
    // 1) Not found
    const notFound = classifyCASZeroAffected({ order: null, webhookAmount: 50000 });
    assert.equal(notFound.ok, false);
    assert.equal(notFound.statusCode, 200);
    assert.equal(notFound.reason, 'NOT_FOUND');

    // 2) Already paid (Idempotent success)
    const paidOrder = { id: 1, payment_status: 'paid', payment_provider: 'payos', total: 50000 };
    const alreadyPaid = classifyCASZeroAffected({ order: paidOrder, webhookAmount: 50000 });
    assert.equal(alreadyPaid.ok, true);
    assert.equal(alreadyPaid.statusCode, 200);
    assert.equal(alreadyPaid.reason, 'ALREADY_PAID');

    // 3) Expired order (Must NOT be revived)
    const expiredOrder = { id: 2, payment_status: 'expired', payment_provider: 'payos', total: 50000 };
    const expired = classifyCASZeroAffected({ order: expiredOrder, webhookAmount: 50000 });
    assert.equal(expired.ok, false);
    assert.equal(expired.statusCode, 200);
    assert.equal(expired.reason, 'EXPIRED');

    // 4) Amount mismatch
    const mismatchOrder = { id: 3, payment_status: 'unpaid', payment_provider: 'payos', total: 100000 };
    const mismatch = classifyCASZeroAffected({ order: mismatchOrder, webhookAmount: 50000 });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.statusCode, 200);
    assert.equal(mismatch.reason, 'AMOUNT_MISMATCH');

    // 5) Wrong payment provider
    const codOrder = { id: 4, payment_status: 'unpaid', payment_provider: 'cod', total: 50000 };
    const wrongProvider = classifyCASZeroAffected({ order: codOrder, webhookAmount: 50000 });
    assert.equal(wrongProvider.ok, false);
    assert.equal(wrongProvider.statusCode, 200);
    assert.equal(wrongProvider.reason, 'WRONG_PROVIDER');
  });

  it('verifies infrastructure error handling returns 500 while signature error returns 200', () => {
    const sigError = classifyWebhookError({ type: 'INVALID_SIGNATURE', message: 'Signature mismatch' });
    assert.equal(sigError.statusCode, 200);
    assert.equal(sigError.body.ok, false);
    assert.match(sigError.body.message, /Chữ ký không hợp lệ/);

    const dbError = classifyWebhookError({ type: 'DB_ERROR', message: 'Connection timeout' });
    assert.equal(dbError.statusCode, 500);
    assert.equal(dbError.body.ok, false);
    assert.match(dbError.body.error, /Lỗi hạ tầng/);
  });
});
