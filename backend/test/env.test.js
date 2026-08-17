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
            DB_SERVER: 'localhost',
            DB_NAME: 'db',
          },
          true
        ),
      /Production requires a secure, non-default JWT_SECRET/
    );
  });

  it('fails fast when FRONTEND_URL or DB config is missing in production', () => {
    assert.throws(
      () =>
        validateEnv(
          {
            JWT_SECRET: 'custom-production-secret-1234567890',
            FRONTEND_URL: '',
            DB_SERVER: 'localhost',
            DB_NAME: 'db',
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
            DB_SERVER: '',
            DB_NAME: 'db',
          },
          true
        ),
      /Production requires DB_SERVER and DB_NAME/
    );
  });

  it('fails fast when PayOS keys are partially provided', () => {
    assert.throws(
      () => validateEnv({ PAYOS_CLIENT_ID: 'client_123', PAYOS_API_KEY: '' }, false),
      /Cấu hình PayOS không đầy đủ/
    );
  });

  it('passes in production with full secure configuration', () => {
    const valid = validateEnv(
      {
        JWT_SECRET: 'super-secure-production-key-32-chars-long',
        FRONTEND_URL: 'https://order.teaplus.vn',
        DB_SERVER: 'sql-prod.internal',
        DB_NAME: 'teaplus_prod',
        PAYOS_CLIENT_ID: 'id_123',
        PAYOS_API_KEY: 'key_123',
        PAYOS_CHECKSUM_KEY: 'checksum_123',
      },
      true
    );
    assert.equal(valid, true);
  });
});
