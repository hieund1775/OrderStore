import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSecretHash, constantTimeEqual, generateSecureOtp, generateInviteToken, normalizeEmail } from '../repositories/postgres/auth-email-challenge.js';

test('Auth Email Challenge Utilities Suite', async (t) => {
  await t.test('normalizeEmail trims and lowercases', () => {
    assert.equal(normalizeEmail('  Test@Example.COM  '), 'test@example.com');
    assert.equal(normalizeEmail(''), '');
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
  });

  await t.test('computeSecretHash produces deterministic HMAC-SHA256', () => {
    const hash1 = computeSecretHash('123456', 'test-pepper');
    const hash2 = computeSecretHash('123456', 'test-pepper');
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA256 hex = 64 chars

    const hash3 = computeSecretHash('123456', 'different-pepper');
    assert.notEqual(hash1, hash3);
  });

  await t.test('computeSecretHash uses default pepper from env', () => {
    const previous = process.env.EMAIL_TOKEN_PEPPER;
    process.env.EMAIL_TOKEN_PEPPER = 'test-env-pepper';
    try {
      const hash = computeSecretHash('123456');
      assert.equal(hash.length, 64);
    } finally {
      if (previous === undefined) delete process.env.EMAIL_TOKEN_PEPPER;
      else process.env.EMAIL_TOKEN_PEPPER = previous;
    }
  });

  await t.test('constantTimeEqual returns true for equal strings', () => {
    assert.equal(constantTimeEqual('abc123', 'abc123'), true);
  });

  await t.test('constantTimeEqual returns false for different strings', () => {
    assert.equal(constantTimeEqual('abc123', 'xyz789'), false);
  });

  await t.test('constantTimeEqual returns false for different lengths', () => {
    assert.equal(constantTimeEqual('abc', 'abcd'), false);
  });

  await t.test('constantTimeEqual returns false for null/undefined', () => {
    assert.equal(constantTimeEqual(null, 'abc'), false);
    assert.equal(constantTimeEqual('abc', undefined), false);
    assert.equal(constantTimeEqual(null, null), false);
  });

  await t.test('generateSecureOtp produces 6-digit codes', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSecureOtp();
      assert.equal(code.length, 6);
      assert.ok(/^\d{6}$/.test(code));
      assert.notEqual(code, '123456');
    }
  });

  await t.test('generateInviteToken produces 64-char hex string', () => {
    const token = generateInviteToken();
    assert.equal(token.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(token));
  });

  await t.test('multiple tokens are unique', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateInviteToken());
    }
    assert.equal(tokens.size, 100);
  });
});
