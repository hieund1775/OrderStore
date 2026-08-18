import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../config/env.js';

describe('Environment & Fail-Fast Validation Policy (Production Module)', () => {
  it('fails fast when JWT_SECRET is default or missing in production', () => {
    assert.throws(
      () =>
        validateEnv(
          {
            JWT_SECRET: 'teaplus-dev-secret-change-me',
            FRONTEND_URL: 'https://example.com',
            DATABASE_URL: 'postgresql://user:pass@db.example.test:5432/teaplus_test',
          },
          true
        ),
      /Production requires a secure, non-default JWT_SECRET/
    );
  });

  it('fails fast when FRONTEND_URL or DATABASE_URL is missing in production', () => {
    assert.throws(
      () =>
        validateEnv(
          {
            JWT_SECRET: 'custom-production-secret-1234567890',
            FRONTEND_URL: '',
            DATABASE_URL: 'postgresql://user:pass@db.example.test:5432/teaplus_test',
          },
          true
        ),
      /Production requires FRONTEND_URL/
    );
    assert.throws(
      () =>
        validateEnv(
          {
            JWT_SECRET: 'custom-production-secret-1234567890',
            FRONTEND_URL: 'https://app.com',
            DATABASE_URL: '',
          },
          true
        ),
      /Production requires DATABASE_URL/
    );
  });

  it('fails fast when PayOS keys are partially provided', () => {
    assert.throws(
      () => validateEnv({ PAYOS_CLIENT_ID: 'client_123', PAYOS_API_KEY: '' }, false),
      /Cấu hình PayOS không đầy đủ/
    );
  });

  it('fails fast when production phone OTP is enabled without a real SMS endpoint', () => {
    const base = {
      JWT_SECRET: 'super-secure-production-key-32-chars-long',
      FRONTEND_URL: 'https://order.teaplus.vn',
      DATABASE_URL: 'postgresql://user:pass@db.example.test:5432/teaplus_test',
      PHONE_OTP_ENABLED: 'true',
    };

    assert.throws(
      () => validateEnv({ ...base, SMS_PROVIDER: 'placeholder' }, true),
      /SMS_PROVIDER=generic_http/
    );
    assert.throws(
      () => validateEnv({ ...base, SMS_PROVIDER: 'generic_http', SMS_API_KEY: 'key' }, true),
      /SMS_API_URL and SMS_API_KEY/
    );
  });

  it('passes in production with full secure configuration', () => {
    const valid = validateEnv(
      {
        JWT_SECRET: 'super-secure-production-key-32-chars-long',
        FRONTEND_URL: 'https://order.teaplus.vn',
        DATABASE_URL: 'postgresql://user:pass@db.example.test:5432/teaplus_test',
        PAYOS_CLIENT_ID: 'id_123',
        PAYOS_API_KEY: 'key_123',
        PAYOS_CHECKSUM_KEY: 'checksum_123',
      },
      true
    );
    assert.equal(valid, true);
  });
});
