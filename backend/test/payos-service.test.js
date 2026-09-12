import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentLinkForOrder,
  getPayOS,
  isPayOSConfigured,
  lookupPaymentLinkForRecovery,
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

  it('reports only sanitized safe metadata for ambiguous provider lookup failures', async () => {
    const originalWarn = console.warn;
    const diagnostics = [];
    console.warn = (...args) => diagnostics.push(args);
    try {
      const cases = [
        { status: 401, code: 'AUTH_FAILED' },
        { status: 403, code: 'FORBIDDEN' },
        { status: 429, code: 'RATE_LIMITED' },
        { status: 503, code: 'UPSTREAM_UNAVAILABLE' },
        { code: 'ECONNRESET' },
        { status: 'not-a-status', code: 'unsafe code with payload 123' },
      ];

      for (const failure of cases) {
        setPayOSForTest({ paymentRequests: { get: async () => {
          const error = new Error('raw provider response must never be logged');
          error.name = 'APIError';
          error.status = failure.status;
          error.code = failure.code;
          error.response = { data: { code: 'raw-provider-payload-code', orderCode: 12345 } };
          throw error;
        } } });
        const result = await lookupPaymentLinkForRecovery(12345, 'DEFAULT_PROFILE');
        assert.deepEqual(result, { kind: 'unknown', reason: 'LOOKUP_UNCERTAIN' });
      }

      assert.equal(diagnostics.length, cases.length);
      for (let index = 0; index < cases.length; index += 1) {
        const [marker, diagnostic] = diagnostics[index];
        assert.equal(marker, '[PAYOS_RECOVERY_DIAGNOSTIC]');
        assert.equal(diagnostic.outcome, 'LOOKUP_UNCERTAIN');
        assert.equal(diagnostic.profileCode, 'DEFAULT_PROFILE');
        assert.equal(diagnostic.errorName, 'APIError');
        assert.equal(Object.hasOwn(diagnostic, 'message'), false);
        assert.equal(Object.hasOwn(diagnostic, 'response'), false);
      }
      assert.deepEqual(diagnostics.map(([, diagnostic]) => diagnostic.errorStatus), [401, 403, 429, 503, null, null]);
      assert.deepEqual(diagnostics.map(([, diagnostic]) => diagnostic.errorCode), [
        'AUTH_FAILED', 'FORBIDDEN', 'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'ECONNRESET', null,
      ]);
      assert.equal(JSON.stringify(diagnostics).includes('raw-provider-payload-code'), false);
      assert.equal(JSON.stringify(diagnostics).includes('raw provider response'), false);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('reports configuration, unsupported SDK, and empty responses without identifiers or payloads', async () => {
    const originalWarn = console.warn;
    const diagnostics = [];
    console.warn = (...args) => diagnostics.push(args);
    try {
      assert.deepEqual(await lookupPaymentLinkForRecovery(12345, 'TEA_INDUSTRY'), {
        kind: 'unknown', reason: 'PROFILE_NOT_CONFIGURED',
      });
      setPayOSForTest({});
      assert.deepEqual(await lookupPaymentLinkForRecovery(12345, 'DEFAULT_PROFILE'), {
        kind: 'unknown', reason: 'LOOKUP_UNSUPPORTED',
      });
      setPayOSForTest({ paymentRequests: { get: async () => null } });
      assert.deepEqual(await lookupPaymentLinkForRecovery(12345, 'DEFAULT_PROFILE'), {
        kind: 'unknown', reason: 'EMPTY_RESPONSE',
      });

      assert.deepEqual(diagnostics.map(([, diagnostic]) => diagnostic.outcome), [
        'PROFILE_NOT_CONFIGURED', 'LOOKUP_UNSUPPORTED', 'EMPTY_RESPONSE',
      ]);
      assert.equal(JSON.stringify(diagnostics).includes('12345'), false);
    } finally {
      console.warn = originalWarn;
    }
  });
});
