import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPayOSProviderPaymentIdentity,
  doesPayOSDataMatchAttempt,
  MAX_PAYOS_PROVIDER_PAYMENT_IDENTITY_LENGTH,
} from '../services/payment-attempt-provider-identity.js';
import {
  processPayOSWebhookWithAttempts,
  resolveVerifiedPayOSAttempt,
} from '../services/payment-attempt-settlement.js';
import { reconcilePayOSAttempt } from '../services/payos-reconciliation.js';

const directAttempt = {
  id: 701,
  provider: 'payos',
  payment_profile_code: 'DIRECT_A',
  provider_order_code: 991001,
  provider_payment_link_id: 'link-direct',
};

describe('payment-attempt webhook resolution', () => {
  it('uses one canonical provider identity for webhook and reconciliation payloads', () => {
    assert.equal(
      buildPayOSProviderPaymentIdentity({ reference: 'bank-17', paymentLinkId: 'link-17', orderCode: 17 }),
      'reference:bank-17',
    );
    assert.equal(buildPayOSProviderPaymentIdentity({ paymentLinkId: 'link-17', orderCode: 17 }), 'payment_link:link-17');
    assert.equal(
      buildPayOSProviderPaymentIdentity({ reference: 'x'.repeat(MAX_PAYOS_PROVIDER_PAYMENT_IDENTITY_LENGTH) }),
      null,
    );
    assert.equal(doesPayOSDataMatchAttempt({ orderCode: 991001, paymentLinkId: 'link-direct' }, directAttempt), true);
    assert.equal(doesPayOSDataMatchAttempt({ orderCode: 991002, paymentLinkId: 'link-direct' }, directAttempt), false);
  });

  it('accepts a webhook only when exactly one candidate verifies against its profile snapshot', async () => {
    const candidates = [
      directAttempt,
      { ...directAttempt, id: 702, payment_profile_code: 'GROUP_CHECKOUT' },
    ];
    const result = await resolveVerifiedPayOSAttempt({
      body: { data: { orderCode: 991001, paymentLinkId: 'link-direct' } },
      attemptsRepository: { findAttemptsByProviderIdentifiers: async () => candidates },
      verifyWebhook: (_body, { profileCode }) => {
        if (profileCode !== 'GROUP_CHECKOUT') throw new Error('signature mismatch');
        return { orderCode: 991001, paymentLinkId: 'link-direct', amount: 50000, code: '00' };
      },
    });
    assert.equal(result.kind, 'resolved');
    assert.equal(result.attempt.id, 702);
  });

  it('rejects ambiguous and invalid candidate signatures without settling a target', async () => {
    const candidates = [directAttempt, { ...directAttempt, id: 702, payment_profile_code: 'GROUP_CHECKOUT' }];
    const ambiguous = await resolveVerifiedPayOSAttempt({
      body: { data: { orderCode: 991001, paymentLinkId: 'link-direct' } },
      attemptsRepository: { findAttemptsByProviderIdentifiers: async () => candidates },
      verifyWebhook: () => ({ orderCode: 991001, paymentLinkId: 'link-direct', amount: 50000, code: '00' }),
    });
    assert.equal(ambiguous.kind, 'ambiguous');
    assert.equal(ambiguous.candidateCount, 2);

    let settled = false;
    const invalid = await processPayOSWebhookWithAttempts({
      body: { data: { orderCode: 991001 } },
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [directAttempt],
        processSuccessfulAttemptEvent: async () => { settled = true; },
      },
      verifyWebhook: () => { throw new Error('signature mismatch'); },
    });
    assert.equal(invalid.kind, 'signature_invalid');
    assert.equal(settled, false);
  });

  it('settles a verified late superseded attempt through immutable attempt history', async () => {
    const calls = [];
    const result = await processPayOSWebhookWithAttempts({
      body: { data: { orderCode: 991001, paymentLinkId: 'link-direct' } },
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [{ ...directAttempt, status: 'superseded' }],
        processSuccessfulAttemptEvent: async (payload) => {
          calls.push(payload);
          return { kind: 'paid' };
        },
      },
      verifyWebhook: () => ({
        orderCode: 991001, paymentLinkId: 'link-direct', reference: 'bank-late-1', amount: 50000, code: '00',
      }),
    });
    assert.equal(result.kind, 'paid');
    assert.deepEqual(calls[0], {
      attemptId: 701,
      provider: 'payos',
      providerPaymentIdentity: 'reference:bank-late-1',
      amount: 50000,
      reference: 'bank-late-1',
      paymentLinkId: 'link-direct',
      payload: {
        orderCode: 991001, paymentLinkId: 'link-direct', reference: 'bank-late-1', amount: 50000, code: '00',
      },
    });
  });

  it('builds the same idempotency identity for a webhook and reconciliation of one PayOS payment', async () => {
    const calls = [];
    const attempt = { ...directAttempt, status: 'active', amount: 50000 };
    const attemptsRepository = {
      findAttemptsByProviderIdentifiers: async () => [attempt],
      processSuccessfulAttemptEvent: async (payload) => {
        calls.push(payload);
        return { kind: calls.length === 1 ? 'paid' : 'duplicate' };
      },
    };
    await processPayOSWebhookWithAttempts({
      body: { data: { orderCode: 991001, paymentLinkId: 'link-direct' } },
      attemptsRepository,
      verifyWebhook: () => ({
        orderCode: 991001, paymentLinkId: 'link-direct', reference: 'bank-shared-1', amount: 50000, code: '00',
      }),
    });
    await reconcilePayOSAttempt({
      attempt,
      attemptsRepository,
      getPaymentInfo: async () => ({
        status: 'PAID', amountPaid: 50000, id: 'link-direct', transactions: [{ reference: 'bank-shared-1' }],
      }),
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].providerPaymentIdentity, 'reference:bank-shared-1');
    assert.equal(calls[1].providerPaymentIdentity, calls[0].providerPaymentIdentity);
  });
});
