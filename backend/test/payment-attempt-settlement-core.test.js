import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { settleVerifiedAttemptEvent } from '../services/payment-attempt-settlement-core.js';

describe('Payment Attempt Settlement Core', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENT_MODE = 'qa_sandbox';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('settles direct order and triggers preorder bridge exactly once on paid', async () => {
    const attempt = {
      id: 101,
      target_type: 'order',
      order_id: 501,
      checkout_group_id: null,
      status: 'active',
    };

    let repoCalledWith = null;
    const mockRepo = {
      processSuccessfulAttemptEvent: async (params) => {
        repoCalledWith = params;
        return { kind: 'paid', attemptId: params.attemptId };
      },
    };

    let preorderBridgeCalls = [];
    const mockPreorderBridge = {
      onPaymentSettled: async (params) => {
        preorderBridgeCalls.push(params);
      },
    };

    const result = await settleVerifiedAttemptEvent({
      attempt,
      provider: 'sandbox',
      providerPaymentIdentity: 'sandbox_transfer:101',
      amount: 45000,
      reference: 'REF123',
      paymentLinkId: 'token-sha256',
      payload: { test: true },
      attemptsRepository: mockRepo,
      preorderBridge: mockPreorderBridge,
    });

    assert.equal(result.kind, 'paid');
    assert.deepEqual(repoCalledWith, {
      attemptId: 101,
      provider: 'sandbox',
      providerPaymentIdentity: 'sandbox_transfer:101',
      amount: 45000,
      reference: 'REF123',
      paymentLinkId: 'token-sha256',
      payload: { test: true },
    });

    assert.equal(preorderBridgeCalls.length, 1);
    assert.deepEqual(preorderBridgeCalls[0], {
      orderId: 501,
      checkoutGroupId: null,
      late: false,
    });
  });

  it('settles checkout group and marks late if attempt was expired or superseded', async () => {
    const attempt = {
      id: 202,
      target_type: 'checkout_group',
      order_id: null,
      checkout_group_id: 88,
      status: 'expired',
    };

    const mockRepo = {
      processSuccessfulAttemptEvent: async () => ({ kind: 'paid' }),
    };

    let preorderBridgeCalls = [];
    const mockPreorderBridge = {
      onPaymentSettled: async (params) => {
        preorderBridgeCalls.push(params);
      },
    };

    const result = await settleVerifiedAttemptEvent({
      attempt,
      provider: 'payos',
      providerPaymentIdentity: 'reference:PAYOS99',
      amount: 90000,
      attemptsRepository: mockRepo,
      preorderBridge: mockPreorderBridge,
    });

    assert.equal(result.kind, 'paid');
    assert.equal(preorderBridgeCalls.length, 1);
    assert.deepEqual(preorderBridgeCalls[0], {
      orderId: null,
      checkoutGroupId: 88,
      late: true,
    });
  });

  it('triggers preorder bridge for duplicate and already_paid idempotent states', async () => {
    for (const kind of ['duplicate', 'already_paid']) {
      const attempt = {
        id: 303,
        target_type: 'order',
        order_id: 601,
        checkout_group_id: null,
        status: 'active',
      };

      const mockRepo = {
        processSuccessfulAttemptEvent: async () => ({ kind }),
      };

      let bridgeCalled = false;
      const mockPreorderBridge = {
        onPaymentSettled: async () => { bridgeCalled = true; },
      };

      const result = await settleVerifiedAttemptEvent({
        attempt,
        provider: 'sandbox',
        providerPaymentIdentity: 'sandbox_transfer:303',
        amount: 25000,
        attemptsRepository: mockRepo,
        preorderBridge: mockPreorderBridge,
      });

      assert.equal(result.kind, kind);
      assert.equal(bridgeCalled, true);
    }
  });

  it('does NOT trigger preorder bridge on rejection or non-paid kinds', async () => {
    for (const kind of ['amount_mismatch', 'invalid_provider', 'target_closed', 'already_processed']) {
      const attempt = {
        id: 404,
        target_type: 'order',
        order_id: 701,
        checkout_group_id: null,
        status: 'active',
      };

      const mockRepo = {
        processSuccessfulAttemptEvent: async () => ({ kind }),
      };

      let bridgeCalled = false;
      const mockPreorderBridge = {
        onPaymentSettled: async () => { bridgeCalled = true; },
      };

      const result = await settleVerifiedAttemptEvent({
        attempt,
        provider: 'sandbox',
        providerPaymentIdentity: 'sandbox_transfer:404',
        amount: 25000,
        attemptsRepository: mockRepo,
        preorderBridge: mockPreorderBridge,
      });

      assert.equal(result.kind, kind);
      assert.equal(bridgeCalled, false);
    }
  });

  it('rejects invalid payload arguments without calling repo', async () => {
    let repoCalled = false;
    const mockRepo = {
      processSuccessfulAttemptEvent: async () => {
        repoCalled = true;
        return { kind: 'paid' };
      },
    };

    const res1 = await settleVerifiedAttemptEvent({
      attempt: null,
      provider: 'sandbox',
      providerPaymentIdentity: 'id',
      amount: 100,
      attemptsRepository: mockRepo,
    });
    assert.equal(res1.kind, 'invalid_payload');

    const res2 = await settleVerifiedAttemptEvent({
      attempt: { id: 1 },
      provider: '',
      providerPaymentIdentity: 'id',
      amount: 100,
      attemptsRepository: mockRepo,
    });
    assert.equal(res2.kind, 'invalid_payload');

    const res3 = await settleVerifiedAttemptEvent({
      attempt: { id: 1 },
      provider: 'sandbox',
      providerPaymentIdentity: '',
      amount: 100,
      attemptsRepository: mockRepo,
    });
    assert.equal(res3.kind, 'invalid_payload');

    const res4 = await settleVerifiedAttemptEvent({
      attempt: { id: 1 },
      provider: 'sandbox',
      providerPaymentIdentity: 'id',
      amount: NaN,
      attemptsRepository: mockRepo,
    });
    assert.equal(res4.kind, 'invalid_payload');

    assert.equal(repoCalled, false);
  });
});
