import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentLinkForOrder, setPayOSForTest, verifyWebhookData } from '../services/payos.js';

afterEach(() => setPayOSForTest());

describe('PayOS SDK boundary', () => {
  it('uses the reserved PostgreSQL PayOS order code when creating a link', async () => {
    let captured;
    setPayOSForTest({ paymentRequests: { create: async (payload) => {
      captured = payload;
      return { checkoutUrl: 'https://sandbox.payos.test/checkout', qrCode: 'qr', paymentLinkId: 'link-1' };
    } } });
    const result = await createPaymentLinkForOrder({ orderId: 12, orderCode: 'TPTEST', total: 50000, payosOrderCode: '812345001' });
    assert.equal(captured.orderCode, 812345001);
    assert.equal(captured.amount, 50000);
    assert.equal(result.payosOrderCode, 812345001);
    assert.equal(result.paymentLinkId, 'link-1');
  });

  it('delegates webhook verification only through the SDK boundary', () => {
    setPayOSForTest({ webhooks: { verify: (body) => ({ ...body.data, code: '00' }) } });
    assert.deepEqual(verifyWebhookData({ data: { orderCode: 12, amount: 50000 } }), { orderCode: 12, amount: 50000, code: '00' });
  });
});
