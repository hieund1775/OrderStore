import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePaymentMode,
  isSandboxPaymentMode,
  assertSandboxPaymentMode,
  PaymentModeConfigurationError,
  PAYMENT_MODES,
} from '../config/payment-mode.js';
import { validateEnv } from '../config/env.js';

describe('Payment Mode Resolver & Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts qa_sandbox and payos modes', () => {
    assert.equal(resolvePaymentMode({ PAYMENT_MODE: 'qa_sandbox' }), PAYMENT_MODES.QA_SANDBOX);
    assert.equal(resolvePaymentMode({ PAYMENT_MODE: 'payos' }), PAYMENT_MODES.PAYOS);
    assert.equal(resolvePaymentMode({ PAYMENT_MODE: '  qa_sandbox  ' }), PAYMENT_MODES.QA_SANDBOX);
  });

  it('fails closed when PAYMENT_MODE is missing or empty', () => {
    assert.throws(
      () => resolvePaymentMode({}),
      (err) => err instanceof PaymentModeConfigurationError && err.message.includes('Cấu hình PAYMENT_MODE không hợp lệ')
    );

    assert.throws(
      () => resolvePaymentMode({ PAYMENT_MODE: '   ' }),
      (err) => err instanceof PaymentModeConfigurationError
    );

    assert.throws(
      () => resolvePaymentMode({}, true),
      (err) => err instanceof PaymentModeConfigurationError && err.message.includes('Production requires PAYMENT_MODE')
    );
  });

  it('fails closed when PAYMENT_MODE is an unknown value', () => {
    for (const invalid of ['sandbox', 'zalopay', 'momo', 'test', 'unknown']) {
      assert.throws(
        () => resolvePaymentMode({ PAYMENT_MODE: invalid }),
        (err) => err instanceof PaymentModeConfigurationError && err.message.includes('không hợp lệ')
      );
    }
  });

  it('never defaults silently to sandbox', () => {
    assert.throws(() => resolvePaymentMode({}));
    assert.throws(() => resolvePaymentMode({ PAYMENT_MODE: '' }));
    assert.equal(isSandboxPaymentMode({}), false);
    assert.equal(isSandboxPaymentMode({ PAYMENT_MODE: 'invalid' }), false);
  });

  it('correctly evaluates isSandboxPaymentMode', () => {
    assert.equal(isSandboxPaymentMode({ PAYMENT_MODE: 'qa_sandbox' }), true);
    assert.equal(isSandboxPaymentMode({ PAYMENT_MODE: 'payos' }), false);
  });

  it('assertSandboxPaymentMode allows qa_sandbox and rejects payos with 404', () => {
    assert.equal(assertSandboxPaymentMode({ PAYMENT_MODE: 'qa_sandbox' }), true);

    assert.throws(
      () => assertSandboxPaymentMode({ PAYMENT_MODE: 'payos' }),
      (err) => err.status === 404 && err.code === 'SANDBOX_PAYMENT_UNAVAILABLE'
    );
  });

  describe('validateEnv integration', () => {
    const baseValidProdEnv = {
      JWT_SECRET: 'a-very-secure-jwt-secret-for-testing-12345',
      FRONTEND_URL: 'https://example.com',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    };

    it('requires PAYMENT_MODE in production', () => {
      assert.throws(
        () => validateEnv({ ...baseValidProdEnv }, true),
        (err) => err instanceof PaymentModeConfigurationError
      );
    });

    it('passes in production with qa_sandbox without PayOS keys', () => {
      const valid = validateEnv({
        ...baseValidProdEnv,
        PAYMENT_MODE: 'qa_sandbox',
      }, true);
      assert.equal(valid, true);
    });

    it('requires full PayOS keys in production when in payos mode', () => {
      assert.throws(
        () => validateEnv({
          ...baseValidProdEnv,
          PAYMENT_MODE: 'payos',
        }, true),
        (err) => err.message.includes('Production in "payos" mode requires')
      );

      const valid = validateEnv({
        ...baseValidProdEnv,
        PAYMENT_MODE: 'payos',
        PAYOS_CLIENT_ID: 'client-id',
        PAYOS_API_KEY: 'api-key',
        PAYOS_CHECKSUM_KEY: 'checksum-key',
      }, true);
      assert.equal(valid, true);
    });
  });
});
