import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateOrderInput } from '../validation/order-schemas.js';
import { reconcilePayOSOrder } from '../services/payos-reconciliation.js';

describe('POS Validation & Active Reconciliation Suite', () => {
  it('reconciles a paid PayOS order only when the amount matches exactly', async () => {
    const calls = [];
    const result = await reconcilePayOSOrder({
      order: { id: 17, payment_status: 'unpaid', payment_provider: 'payos' },
      getPaymentInfo: async (_code, _linkId, profileCode) => {
        assert.equal(profileCode, 'NUOC_UONG_DEFAULT');
        return { status: 'PAID', amountPaid: 45000, transactions: [{ reference: 'bank-ref-1' }] };
      },
      attemptsRepository: {
        findCurrentAttemptForTarget: async ({ orderId }) => {
          assert.equal(orderId, 17);
          return {
            id: 99, provider: 'payos', status: 'active', amount: 45000,
            provider_order_code: 880017, provider_payment_link_id: 'link-17', payment_profile_code: 'NUOC_UONG_DEFAULT',
          };
        },
        processSuccessfulAttemptEvent: async (payload) => {
          calls.push(payload);
          return { kind: 'paid' };
        },
      },
    });

    assert.equal(result.changed, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].attemptId, 99);
    assert.equal(calls[0].providerPaymentIdentity, 'reference:bank-ref-1');
  });

  it('does not reconcile an overpaid PayOS response', async () => {
    let called = false;
    const result = await reconcilePayOSOrder({
      order: { id: 18, payment_status: 'unpaid', payment_provider: 'payos' },
      getPaymentInfo: async () => ({ status: 'PAID', amountPaid: 45001 }),
      attemptsRepository: {
        findCurrentAttemptForTarget: async () => ({
          id: 100, provider: 'payos', status: 'active', amount: 45000,
          provider_order_code: 880018, payment_profile_code: 'NUOC_UONG_DEFAULT',
        }),
        processSuccessfulAttemptEvent: async () => { called = true; return { kind: 'paid' }; },
      },
    });

    assert.equal(result.changed, false);
    assert.equal(called, false);
  });

  it('allows POS orders with placeholder phone and default customer name', () => {
    const validated = validateCreateOrderInput({
      store_id: 1,
      order_type: 'POS',
      source: 'pos',
      payment_method: 'COD',
      customer_name: 'Khách Tại Quầy',
      customer_phone: '0000000000',
      items: [{ product_id: 1, qty: 1 }],
    });

    assert.equal(validated.orderType, 'POS');
    assert.equal(validated.source, 'pos');
    assert.equal(validated.customerName, 'Khách Tại Quầy');
    assert.equal(validated.customerPhone, '0000000000');
  });

  it('allows POS orders with empty phone and sets placeholder', () => {
    const validated = validateCreateOrderInput({
      store_id: 1,
      order_type: 'POS',
      source: 'pos',
      payment_method: 'COD',
      items: [{ product_id: 1, qty: 1 }],
    });

    assert.equal(validated.orderType, 'POS');
    assert.equal(validated.customerPhone, '0000000000');
    assert.equal(validated.customerName, 'Khách Tại Quầy');
  });

  it('normalizes an invalid optional POS phone to the placeholder', () => {
    const validated = validateCreateOrderInput({
      store_id: 1,
      order_type: 'POS',
      source: 'pos',
      payment_method: 'COD',
      customer_name: 'Khách Tại Quầy',
      customer_phone: 'not-a-phone',
      items: [{ product_id: 1, qty: 1 }],
    });

    assert.equal(validated.customerPhone, '0000000000');
  });

  it('still strictly rejects online delivery orders without valid phone', () => {
    assert.throws(
      () =>
        validateCreateOrderInput({
          store_id: 1,
          order_type: 'Delivery',
          source: 'online',
          customer_name: 'Nguyễn Văn A',
          customer_phone: '0000000000',
          delivery_addr: '123 Đường ABC',
          items: [{ product_id: 1, qty: 1 }],
        }),
      /Số điện thoại không hợp lệ/,
    );
  });

  it('reconciles CANCELLED PayOS status by closing attempt and triggering preorder expiration release', async () => {
    let expireAttemptCall = null;
    let preorderExpiredCall = null;

    const result = await reconcilePayOSOrder({
      order: { id: 25, payment_status: 'unpaid', payment_provider: 'payos' },
      getPaymentInfo: async () => ({ status: 'CANCELLED' }),
      attemptsRepository: {
        findCurrentAttemptForTarget: async () => ({
          id: 125,
          provider: 'payos',
          status: 'active',
          amount: 60000,
          provider_order_code: 880025,
          order_id: 25,
          checkout_group_id: null,
          payment_profile_code: 'TEST_PROFILE',
        }),
        expireAttemptFromProviderTerminalState: async (payload) => {
          expireAttemptCall = payload;
          return { changed: true, attempt: { id: 125, status: 'expired' } };
        },
      },
      preorderBridge: {
        onPaymentExpired: async (payload) => {
          preorderExpiredCall = payload;
        },
      },
    });

    assert.equal(result.changed, true);
    assert.equal(result.result.kind, 'expired');
    assert.deepEqual(expireAttemptCall, { attemptId: 125, providerStatus: 'CANCELLED' });
    assert.deepEqual(preorderExpiredCall, { orderId: 25, checkoutGroupId: null });
  });

  it('fails closed and does not mutate attempts on unknown status or error', async () => {
    let expireAttemptCalled = false;

    const result = await reconcilePayOSOrder({
      order: { id: 26, payment_status: 'unpaid', payment_provider: 'payos' },
      getPaymentInfo: async () => ({ status: 'UNKNOWN_CODE' }),
      attemptsRepository: {
        findCurrentAttemptForTarget: async () => ({
          id: 126,
          provider: 'payos',
          status: 'active',
          amount: 60000,
          provider_order_code: 880026,
          payment_profile_code: 'TEST_PROFILE_2',
        }),
        expireAttemptFromProviderTerminalState: async () => {
          expireAttemptCalled = true;
          return { changed: false };
        },
      },
    });

    assert.equal(result.changed, false);
    assert.equal(result.outcome, 'provider_uncertain');
    assert.equal(expireAttemptCalled, false);
  });
});
