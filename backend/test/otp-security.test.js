import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  generateSecureOtp,
  hashOtpCode,
  requestOtpCode,
  verifyOtpCode,
} from '../services/otp-service.js';
import { ProductionSmsProvider } from '../services/otp-provider.js';

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
      assert.notEqual(code, '123456');
    }
  });

  it('calls a configured production SMS endpoint and fails on provider rejection', async () => {
    let request = null;
    const provider = new ProductionSmsProvider({
      apiUrl: 'https://sms.invalid/send',
      apiKey: 'test-key',
      senderId: 'TeaPlus',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, async json() { return { messageId: 'msg-1' }; } };
      },
    });

    const sent = await provider.sendSmsOtp({ phone: '0901234567', code: '654321' });
    assert.equal(sent.messageId, 'msg-1');
    assert.equal(request.url, 'https://sms.invalid/send');
    assert.match(request.options.headers.Authorization, /^Bearer /);
    assert.equal(JSON.parse(request.options.body).to, '0901234567');

    const rejectingProvider = new ProductionSmsProvider({
      apiUrl: 'https://sms.invalid/send',
      apiKey: 'test-key',
      fetchImpl: async () => ({ ok: false, status: 503, async json() { return {}; } }),
    });
    await assert.rejects(
      rejectingProvider.sendSmsOtp({ phone: '0901234567', code: '654321' }),
      /status 503/
    );
  });

  it('does not persist or cooldown an OTP when SMS delivery fails', async () => {
    const mockStore = new Map();
    const testAdapter = {
      async getStoredOtp(phone) { return mockStore.get(phone); },
      async saveOtp(phone, record) { mockStore.set(phone, record); },
    };
    const provider = {
      async sendSmsOtp() { throw new Error('provider unavailable'); },
    };

    await assert.rejects(
      requestOtpCode({ phone: '0908888888', provider, testAdapter }),
      /provider unavailable/
    );
    assert.equal(mockStore.has('0908888888'), false);
  });

  it('fails closed instead of using in-memory OTP storage in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await assert.rejects(
        requestOtpCode({
          phone: '0909999999',
          provider: { async sendSmsOtp() { return { success: true }; } },
        }),
        /Persistent OTP storage is not configured/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
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
