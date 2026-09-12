import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentLinkForOrder,
  getPayOS,
  isPayOSConfigured,
  setPayOSForTest,
  SYSTEM_FALLBACK_PROFILE_CODES,
  verifyWebhookData,
} from '../services/payos.js';

const credentialEnvKeys = [
  'PAYOS_CLIENT_ID',
  'PAYOS_API_KEY',
  'PAYOS_CHECKSUM_KEY',
  'PAYOS_PROFILE_DEFAULT_PROFILE_CLIENT_ID',
  'PAYOS_PROFILE_DEFAULT_PROFILE_API_KEY',
  'PAYOS_PROFILE_DEFAULT_PROFILE_CHECKSUM_KEY',
  'PAYOS_PROFILE_GROUP_CHECKOUT_CLIENT_ID',
  'PAYOS_PROFILE_GROUP_CHECKOUT_API_KEY',
  'PAYOS_PROFILE_GROUP_CHECKOUT_CHECKSUM_KEY',
  'PAYOS_PROFILE_TEA_INDUSTRY_CLIENT_ID',
  'PAYOS_PROFILE_TEA_INDUSTRY_API_KEY',
  'PAYOS_PROFILE_TEA_INDUSTRY_CHECKSUM_KEY',
];
const originalCredentialEnv = new Map();

beforeEach(() => {
  for (const key of credentialEnvKeys) {
    originalCredentialEnv.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
    delete process.env[key];
  }
  setPayOSForTest();
});

afterEach(() => {
  setPayOSForTest();
  for (const key of credentialEnvKeys) {
    const value = originalCredentialEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  originalCredentialEnv.clear();
});

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
    assert.match(captured.returnUrl, /order_code=TPTEST/);
    assert.match(captured.cancelUrl, /order_code=TPTEST/);
    assert.equal(result.payosOrderCode, 812345001);
    assert.equal(result.paymentLinkId, 'link-1');
  });

  it('delegates webhook verification only through the SDK boundary', () => {
    setPayOSForTest({ webhooks: { verify: (body) => ({ ...body.data, code: '00' }) } });
    assert.deepEqual(verifyWebhookData({ data: { orderCode: 12, amount: 50000 } }), { orderCode: 12, amount: 50000, code: '00' });
  });

  it('allows only canonical system fallback profiles to use root credentials', () => {
    process.env.PAYOS_CLIENT_ID = 'test-client';
    process.env.PAYOS_API_KEY = 'test-api-key';
    process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';

    assert.equal(SYSTEM_FALLBACK_PROFILE_CODES.has('DEFAULT_PROFILE'), true);
    assert.equal(SYSTEM_FALLBACK_PROFILE_CODES.has('GROUP_CHECKOUT'), true);
    assert.equal(isPayOSConfigured('DEFAULT_PROFILE'), true);
    assert.equal(isPayOSConfigured('GROUP_CHECKOUT'), true);
    assert.ok(getPayOS('DEFAULT_PROFILE'));
    assert.ok(getPayOS('GROUP_CHECKOUT'));
  });

  it('keeps an industry profile fail-closed when only root credentials exist', () => {
    process.env.PAYOS_CLIENT_ID = 'test-client';
    process.env.PAYOS_API_KEY = 'test-api-key';
    process.env.PAYOS_CHECKSUM_KEY = 'test-checksum-key';

    assert.equal(isPayOSConfigured('TEA_INDUSTRY'), false);
    assert.equal(getPayOS('TEA_INDUSTRY'), null);
  });
});
