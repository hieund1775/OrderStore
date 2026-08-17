import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  generateSecureOtp,
  hashOtpCode,
  requestOtpCode,
  verifyOtpCode,
} from '../services/otp-service.js';

describe('OTP Security & Provider Service Suite', () => {
  it('normalizes Vietnamese phone numbers into canonical 10-digit format', () => {
    assert.equal(normalizePhone('0901234567'), '0901234567');
    assert.equal(normalizePhone('+84901234567'), '0901234567');
    assert.equal(normalizePhone('84901234567'), '0901234567');
    assert.equal(normalizePhone('090 123 4567'), '0901234567');
    assert.equal(normalizePhone('(090) 123-4567'), '0901234567');
    assert.equal(normalizePhone(''), '');
  });

  it('generates secure 6-digit numeric OTP', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateSecureOtp();
      assert.equal(typeof code, 'string');
      assert.equal(code.length, 6);
      assert.ok(/^\d{6}$/.test(code), `Code must be 6 digits, got: ${code}`);
    }
  });

  it('hashes OTP code using HMAC-SHA256 producing 64-char hex string', () => {
    const hash1 = hashOtpCode('123456', 'test_secret');
    const hash2 = hashOtpCode('123456', 'test_secret');
    const hashDiff = hashOtpCode('654321', 'test_secret');

    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hashDiff);
  });

  it('verifies valid OTP and enforces anti-replay (cannot reuse consumed OTP)', async () => {
    const mockStore = new Map();
    const testAdapter = {
      async getStoredOtp(p) {
        return mockStore.get(p);
      },
      async saveOtp(p, record) {
        mockStore.set(p, record);
      },
    };

    let sentCode = null;
    const testProvider = {
      async sendSmsOtp({ phone, code }) {
        sentCode = code;
        return { success: true };
      },
    };

    // 1. Request OTP
    const reqRes = await requestOtpCode({
      phone: '0901234567',
      provider: testProvider,
      testAdapter,
    });
    assert.equal(reqRes.success, true);
    assert.ok(sentCode);

    // 2. First verification -> Success
    const verify1 = await verifyOtpCode({
      phone: '0901234567',
      code: sentCode,
      testAdapter,
    });
    assert.equal(verify1.valid, true);

    // 3. Second verification (replay) -> Must fail
    const verify2 = await verifyOtpCode({
      phone: '0901234567',
      code: sentCode,
      testAdapter,
    });
    assert.equal(verify2.valid, false);
  });

  it('enforces lockout after 5 incorrect attempts', async () => {
    const mockStore = new Map();
    const testAdapter = {
      async getStoredOtp(p) {
        return mockStore.get(p);
      },
      async saveOtp(p, record) {
        mockStore.set(p, record);
      },
    };

    let sentCode = null;
    const testProvider = {
      async sendSmsOtp({ phone, code }) {
        sentCode = code;
        return { success: true };
      },
    };

    await requestOtpCode({
      phone: '0905555555',
      provider: testProvider,
      testAdapter,
    });

    // Try wrong code 5 times
    for (let i = 0; i < 5; i++) {
      const failRes = await verifyOtpCode({
        phone: '0905555555',
        code: '000000',
        testAdapter,
      });
      assert.equal(failRes.valid, false);
    }

    // 6th attempt with CORRECT code must still be rejected due to lockout
    const lockedRes = await verifyOtpCode({
      phone: '0905555555',
      code: sentCode,
      testAdapter,
    });
    assert.equal(lockedRes.valid, false);
    assert.ok(lockedRes.error.includes('quá 5 lần'));
  });

  it('enforces 60-second cooldown between resend requests for the same phone', async () => {
    const mockStore = new Map();
    const testAdapter = {
      async getStoredOtp(p) {
        return mockStore.get(p);
      },
      async saveOtp(p, record) {
        mockStore.set(p, record);
      },
    };

    const testProvider = {
      async sendSmsOtp() {
        return { success: true };
      },
    };

    // First send -> ok
    await requestOtpCode({ phone: '0907777777', provider: testProvider, testAdapter });

    // Immediate second send -> must throw 429 cooldown error
    await assert.rejects(
      async () => {
        await requestOtpCode({ phone: '0907777777', provider: testProvider, testAdapter });
      },
      (err) => {
        assert.equal(err.status, 429);
        assert.ok(err.message.includes('giây'));
        return true;
      }
    );
  });
});
