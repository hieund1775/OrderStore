import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateOrderInput } from '../validation/order-schemas.js';
import { setPayOSForTest } from '../services/payos.js';
import { reconcilePayOSOrder } from '../services/payos-reconciliation.js';

describe('POS Validation & Active Reconciliation Suite', () => {
  it('reconciles a paid PayOS order only when the amount matches exactly', async () => {
    const calls = [];
    const result = await reconcilePayOSOrder({
      order: { payment_status: 'unpaid', payment_provider: 'payos', payos_order_code: `recon-${Date.now()}`, payment_profile_code: 'NUOC_UONG_DEFAULT', total: 45000 },
      getPaymentInfo: async (_code, _linkId, profileCode) => {
        assert.equal(profileCode, 'NUOC_UONG_DEFAULT');
        return { status: 'PAID', amountPaid: 45000, transactions: [{ reference: 'bank-ref-1' }] };
      },
      paymentRepository: {
        processSuccessfulWebhook: async (payload) => {
          calls.push(payload);
          return { kind: 'paid' };
        },
      },
    });

    assert.equal(result.changed, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].eventKey, `reconcile-${calls[0].orderCode}-bank-ref-1`);
  });

  it('does not reconcile an overpaid PayOS response', async () => {
    let called = false;
    const result = await reconcilePayOSOrder({
      order: { payment_status: 'unpaid', payment_provider: 'payos', payos_order_code: `recon-over-${Date.now()}`, total: 45000 },
      getPaymentInfo: async () => ({ status: 'PAID', amountPaid: 45001 }),
      paymentRepository: { processSuccessfulWebhook: async () => { called = true; return { kind: 'paid' }; } },
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
});
