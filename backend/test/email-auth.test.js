import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService, createFakeTransport } from '../services/email-service.js';

test('Email Authentication & Password Reset Service Suite', async (t) => {
  await t.test('sends email via fake transport', async () => {
    const fakeTransport = createFakeTransport();
    const service = createEmailService({ transport: fakeTransport });

    const result = await service.sendPasswordResetOtp('customer@example.com', '123456');
    assert.equal(result.success, true);
    assert.equal(fakeTransport.sentEmails.length, 1);
    assert.equal(fakeTransport.sentEmails[0].to, 'customer@example.com');
    assert.ok(fakeTransport.sentEmails[0].html.includes('123456'));
  });

  await t.test('sends email verification OTP', async () => {
    const fakeTransport = createFakeTransport();
    const service = createEmailService({ transport: fakeTransport });

    await service.sendEmailVerificationOtp('new@example.com', '654321');
    assert.equal(fakeTransport.sentEmails.length, 1);
    assert.equal(fakeTransport.sentEmails[0].to, 'new@example.com');
  });

  await t.test('sends staff invitation email', async () => {
    const fakeTransport = createFakeTransport();
    const service = createEmailService({ transport: fakeTransport });

    await service.sendStaffInvitation('staff@example.com', 'invite-token-123', 'Nguyen Van A');
    assert.equal(fakeTransport.sentEmails.length, 1);
    assert.equal(fakeTransport.sentEmails[0].to, 'staff@example.com');
    assert.ok(fakeTransport.sentEmails[0].html.includes('invite-token-123'));
    assert.ok(fakeTransport.sentEmails[0].html.includes('Nguyen Van A'));
  });

  await t.test('rejects invalid email formats', async () => {
    const fakeTransport = createFakeTransport();
    const service = createEmailService({ transport: fakeTransport });

    await assert.rejects(
      async () => service.sendPasswordResetOtp('invalid-email', '123456'),
      /Địa chỉ email không hợp lệ/,
    );
  });

  await t.test('fails closed in production when no email transport is configured', async () => {
    const service = createEmailService({ isProduction: true, transport: null });

    await assert.rejects(
      () => service.sendPasswordResetOtp('customer@example.com', '123456'),
      /Dịch vụ gửi email chưa được cấu hình/,
    );
  });

  await t.test('fails closed in production when Resend API key is missing', async () => {
    const { createResendTransport } = await import('../services/email-service.js');
    const transport = createResendTransport({ apiKey: '', fromEmail: 'test@example.com' });
    const service = createEmailService({ transport, isProduction: true });

    await assert.rejects(
      () => service.sendPasswordResetOtp('customer@example.com', '123456'),
      /Resend API key is not configured/,
    );
  });

  await t.test('does not log secrets', async () => {
    const fakeTransport = createFakeTransport();
    const service = createEmailService({ transport: fakeTransport });

    await service.sendPasswordResetOtp('test@example.com', '987654');
    const sent = fakeTransport.sentEmails[0];
    assert.ok(sent.html.includes('987654'));
    assert.equal(sent.to, 'test@example.com');
  });
});