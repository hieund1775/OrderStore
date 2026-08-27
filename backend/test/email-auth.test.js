import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../services/email-service.js';

test('Email Authentication & Password Reset Service Suite', async (t) => {
  await t.test('sends and verifies password reset OTP correctly', async () => {
    const service = createEmailService({ isProduction: false });
    const email = 'customer@example.com';

    const sendRes = await service.sendPasswordResetOtp(email);
    assert.equal(sendRes.success, true);
    assert.ok(sendRes.demo_otp);

    // Wrong OTP code
    const wrongRes = await service.verifyPasswordResetOtp(email, '999999');
    assert.equal(wrongRes.valid, false);

    // Correct OTP code
    const validRes = await service.verifyPasswordResetOtp(email, sendRes.demo_otp);
    assert.equal(validRes.valid, true);

    // Anti-replay (cannot be used twice)
    const replayRes = await service.verifyPasswordResetOtp(email, sendRes.demo_otp);
    assert.equal(replayRes.valid, false);
  });

  await t.test('sends and verifies email update OTP correctly', async () => {
    const service = createEmailService({ isProduction: false });
    const email = 'new-customer@example.com';

    const sendRes = await service.sendEmailUpdateOtp(email);
    assert.equal(sendRes.success, true);
    assert.ok(sendRes.demo_otp);

    const validRes = await service.verifyEmailUpdateOtp(email, sendRes.demo_otp);
    assert.equal(validRes.valid, true);
  });

  await t.test('rejects invalid email formats', async () => {
    const service = createEmailService({ isProduction: false });

    await assert.rejects(
      async () => service.sendPasswordResetOtp('invalid-email'),
      /Địa chỉ email không hợp lệ/,
    );
  });
});
