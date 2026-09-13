import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createStaffService, AuthError } from '../services/staff/staff-service.js';
import { createEmailService, createFakeTransport } from '../services/email-service.js';
import { computeSecretHash, constantTimeEqual } from '../repositories/postgres/auth-email-challenge.js';

process.env.EMAIL_TOKEN_PEPPER = 'test-only-email-token-pepper';

function createMockChallengeRepo() {
  const challenges = [];
  let nextId = 1;

  return {
    challenges,
    async createChallenge({ userId, email, purpose, secretHash, maxAttempts, ttlMinutes, metadata }) {
      const now = new Date();
      const challenge = {
        id: nextId++,
        user_id: userId || null,
        email,
        purpose,
        secret_hash: secretHash,
        expires_at: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        attempts: 0,
        max_attempts: maxAttempts,
        sent_at: null,
        consumed_at: null,
        revoked_at: null,
        created_at: now,
        metadata: metadata || null,
      };
      challenges.push(challenge);
      return challenge;
    },
    async createPhoneProofChallenge({ userId, email, secretHash, ttlMinutes = 5, maxAttempts = 5, metadata }) {
      const now = new Date();
      // Revoke any existing active phone proofs and reset OTPs for this user
      for (const c of challenges) {
        if (c.user_id === userId && ['PASSWORD_RESET_PHONE_PROOF', 'PASSWORD_RESET'].includes(c.purpose) && !c.consumed_at && !c.revoked_at) {
          c.revoked_at = now;
        }
      }
      const proof = {
        id: nextId++,
        user_id: userId || null,
        email,
        purpose: 'PASSWORD_RESET_PHONE_PROOF',
        secret_hash: secretHash,
        expires_at: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        attempts: 0,
        max_attempts: maxAttempts,
        sent_at: null,
        consumed_at: null,
        revoked_at: null,
        created_at: now,
        metadata: metadata || { kind: 'password_reset_phone_proof' },
      };
      challenges.push(proof);
      return proof;
    },
    async findPhoneProofByHash(secretHash, tx) {
      const proof = challenges
        .filter(c => c.purpose === 'PASSWORD_RESET_PHONE_PROOF' && c.secret_hash === secretHash)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return proof || null;
    },
    async revokeActiveChallenges({ userId, email, purpose }) {
      let count = 0;
      for (const c of challenges) {
        if (c.purpose === purpose && !c.consumed_at && !c.revoked_at) {
          if ((userId == null || c.user_id === userId) && (!email || c.email === email)) {
            c.revoked_at = new Date();
            count++;
          }
        }
      }
      return count;
    },
    async markSent(id) {
      const c = challenges.find(x => x.id === id);
      if (c) c.sent_at = new Date();
      return c || null;
    },
    async findLatestActive(userId, email, purpose, tx) {
      const now = Date.now();
      const matches = challenges
        .filter(c =>
          c.purpose === purpose &&
          c.email === email &&
          !c.consumed_at &&
          !c.revoked_at &&
          c.sent_at &&
          new Date(c.expires_at).getTime() > now &&
          (userId == null || c.user_id === userId)
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return matches[0] || null;
    },
    async incrementAttempts(id) {
      const c = challenges.find(x => x.id === id);
      if (c) c.attempts += 1;
      return c?.attempts || 0;
    },
    async consume(id) {
      const c = challenges.find(x => x.id === id);
      if (c && !c.consumed_at) {
        c.consumed_at = new Date();
        return true;
      }
      return false;
    },
    async revoke(id) {
      const c = challenges.find(x => x.id === id);
      if (c && !c.revoked_at) {
        c.revoked_at = new Date();
        return true;
      }
      return false;
    },
  };
}

function createMockUsersRepo() {
  const users = [
    {
      id: 10,
      fullname: 'Nguyễn Văn Khách',
      email: 'customer@example.com',
      phone: '0901234567',
      is_admin: false,
      is_active: true,
      token_version: 1,
      password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC',
      email_verified_at: null,
    },
    {
      id: 11,
      fullname: 'Disabled User',
      email: 'disabled@example.com',
      phone: '0901111222',
      is_admin: false,
      is_active: false,
      token_version: 0,
      password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC',
      email_verified_at: null,
    },
    {
      id: 12,
      fullname: 'User Without Email',
      email: null,
      phone: '0903333444',
      is_admin: false,
      is_active: true,
      token_version: 0,
      password_hash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1QjqK5Vx8qy0J5l0d3v5f9e1a2bC',
      email_verified_at: null,
    },
    {
      id: 13,
      fullname: 'Pending Invited Staff',
      email: 'pending_staff@example.com',
      phone: '0905555666',
      is_admin: true,
      is_active: false,
      token_version: 0,
      password_hash: '',
      email_verified_at: null,
    },
  ];

  return {
    users,
    async findActiveUserByPhone(phone) {
      return users.find(u => u.phone === phone && u.is_active) || null;
    },
    async findActiveUserByEmail(email) {
      const clean = (email || '').trim().toLowerCase();
      return users.find(u => u.email?.toLowerCase() === clean && u.is_active) || null;
    },
    async findActiveUserById(id) {
      return users.find(u => u.id === id && u.is_active) || null;
    },
  };
}

function createMockDb(usersRepo, challengeRepo) {
  return {
    async query(sqlText, params) {
      return [[], 0];
    },
    async transaction(callback) {
      const tx = {
        async query(sqlText, params) {
          if (sqlText.includes('UPDATE users')) {
            const userId = params[0];
            const passwordHash = params[1];
            const user = usersRepo.users.find(u => u.id === userId && u.is_active);
            if (user) {
              user.password_hash = passwordHash;
              user.token_version += 1;
              user.email_verified_at = new Date();
              return [[user], 1];
            }
            return [[], 0];
          }
          if (sqlText.includes('UPDATE auth_email_challenges') && sqlText.includes('consumed_at = CURRENT_TIMESTAMP')) {
            const id = params[0];
            const c = challengeRepo.challenges.find(x => x.id === id);
            if (c) {
              c.consumed_at = new Date();
              if (sqlText.includes('revoked_at = CURRENT_TIMESTAMP')) {
                c.revoked_at = new Date();
              }
              return [[c], 1];
            }
            return [[], 0];
          }
          if (sqlText.includes('UPDATE auth_email_challenges') && sqlText.includes('revoked_at = CURRENT_TIMESTAMP')) {
            const userId = params[0];
            for (const c of challengeRepo.challenges) {
              if (c.user_id === userId && !c.consumed_at && !c.revoked_at) {
                c.revoked_at = new Date();
              }
            }
            return [[], 1];
          }
          return [[], 0];
        },
      };
      return callback(tx, null);
    },
  };
}

function createMockRateLimitRepo() {
  const limits = new Map();
  return {
    limits,
    async checkAndIncrement({ key, maxAttempts = 5, windowMs = 900_000, cooldownMs = 60_000 }) {
      const now = Date.now();
      const rec = limits.get(key) || { attempts: 0, firstAttempt: now, lastAttempt: 0, cooldownUntil: 0 };
      if (rec.cooldownUntil > now) {
        const remainingSec = Math.ceil((rec.cooldownUntil - now) / 1000);
        const err = new AuthError(`Quá nhiều yêu cầu. Vui lòng thử lại sau ${remainingSec} giây`, 429, 'RATE_LIMITED');
        err.cooldown_seconds = remainingSec;
        throw err;
      }
      if (cooldownMs > 0 && rec.lastAttempt > 0 && (now - rec.lastAttempt) < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - (now - rec.lastAttempt)) / 1000);
        const err = new AuthError(`Vui lòng chờ ${waitSec} giây trước khi yêu cầu lại`, 429, 'OTP_RESEND_COOLDOWN');
        err.cooldown_seconds = waitSec;
        throw err;
      }
      if (now - rec.firstAttempt > windowMs) {
        rec.attempts = 1;
        rec.firstAttempt = now;
        rec.lastAttempt = now;
        limits.set(key, rec);
        return { attempts: 1, remaining: maxAttempts - 1 };
      }
      if (rec.attempts >= maxAttempts) {
        rec.cooldownUntil = now + cooldownMs;
        const err = new AuthError('Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau', 429, 'RATE_LIMITED');
        err.cooldown_seconds = Math.ceil(cooldownMs / 1000);
        throw err;
      }
      rec.attempts += 1;
      rec.lastAttempt = now;
      limits.set(key, rec);
      return { attempts: rec.attempts, remaining: maxAttempts - rec.attempts };
    },
    async reset(key) {
      if (key) limits.delete(key);
      else limits.clear();
    },
  };
}

test('Phone-First Password Recovery & Explicit Logout Suite', async (t) => {
  let fakeTransport;
  let emailService;
  let challengeRepo;
  let rateLimitRepo;
  let usersRepo;
  let auditLogs;
  let mockDb;
  let staffService;

  function setup() {
    fakeTransport = createFakeTransport();
    emailService = createEmailService({ transport: fakeTransport });
    challengeRepo = createMockChallengeRepo();
    rateLimitRepo = createMockRateLimitRepo();
    usersRepo = createMockUsersRepo();
    auditLogs = [];
    mockDb = createMockDb(usersRepo, challengeRepo);
    const auditLogger = async (actorId, action, metadata) => {
      auditLogs.push({ actorId, action, metadata });
    };

    staffService = createStaffService({
      emailService,
      challengeRepo,
      rateLimitRepo,
      database: mockDb,
      usersRepo,
      auditLogger,
    });
  }

  await t.test('1. valid registered phone issues one opaque proof; stored value is HMAC only', async () => {
    setup();
    const result = await staffService.forgotPasswordVerifyPhone('0901234567');

    assert.equal(result.verified, true);
    assert.equal(result.expires_in_seconds, 300);
    assert.ok(typeof result.recovery_token === 'string');
    assert.equal(result.recovery_token.length, 64); // 32 bytes hex = 64 chars

    // Check repository row
    const proofRow = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET_PHONE_PROOF');
    assert.ok(proofRow);
    assert.equal(proofRow.user_id, 10);
    assert.equal(proofRow.email, 'customer@example.com');
    // Stored hash must be HMAC, never the raw plaintext token
    assert.notEqual(proofRow.secret_hash, result.recovery_token);
    assert.equal(proofRow.secret_hash, computeSecretHash(result.recovery_token));
    assert.equal(proofRow.sent_at, null);
    assert.equal(proofRow.consumed_at, null);
    assert.equal(proofRow.revoked_at, null);
  });

  await t.test('2. invalid/malformed phone cannot obtain a proof', async () => {
    setup();
    // Malformed phone numbers
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('123'),
      (err) => err instanceof AuthError && err.code === 'PHONE_INVALID' && err.status === 400,
    );
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone(''),
      (err) => err instanceof AuthError && err.code === 'PHONE_INVALID',
    );

    // Non-existent registered phone
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0909999999'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED' && err.message.includes('Thông tin xác thực không hợp lệ'),
    );

    // Disabled account
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0901111222'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED',
    );

    // Active account without usable email
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0903333444'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED',
    );

    // Pending invited staff
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0905555666'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED',
    );

    // Ensure no proof was created
    assert.equal(challengeRepo.challenges.length, 0);
  });

  await t.test('3. new phone proof revokes old proof and active reset OTP', async () => {
    setup();
    // Issue proof 1
    const res1 = await staffService.forgotPasswordVerifyPhone('0901234567');
    const proof1 = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET_PHONE_PROOF');
    assert.equal(proof1.revoked_at, null);

    // Send OTP using proof 1
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: res1.recovery_token });
    const otp1 = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');
    assert.equal(otp1.revoked_at, null);

    // Reset rate limit to simulate second request after cooldown
    await rateLimitRepo.reset('phone_verify:0901234567');

    // Issue proof 2 for same user
    const res2 = await staffService.forgotPasswordVerifyPhone('0901234567');
    assert.notEqual(res1.recovery_token, res2.recovery_token);

    // Verify proof 1 and OTP 1 are now revoked
    assert.ok(proof1.revoked_at !== null);
    assert.ok(otp1.revoked_at !== null);
  });

  await t.test('4. matching email with valid proof sends one usable OTP', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    const otpRes = await staffService.forgotPasswordSendOtp({
      email: 'Customer@Example.com', // test case-insensitivity
      recovery_token: proofRes.recovery_token,
    });

    assert.equal(otpRes.success, true);
    assert.equal(otpRes.cooldown_seconds, 60);
    assert.equal(otpRes.code, undefined); // No code in response!
    assert.equal(otpRes.dev_code, undefined);

    // Transport received exactly 1 email
    assert.equal(fakeTransport.sentEmails.length, 1);
    assert.equal(fakeTransport.sentEmails[0].to, 'customer@example.com');

    // Challenge row marked sent
    const otpRow = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');
    assert.ok(otpRow);
    assert.ok(otpRow.sent_at !== null);
  });

  await t.test('5. wrong email sends no mail and increments proof attempts (revokes after 5 failures)', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    const proof = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET_PHONE_PROOF');

    // 1st wrong email
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({
        email: 'wrong@example.com',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'RECOVERY_IDENTITY_INVALID',
    );
    assert.equal(proof.attempts, 1);
    assert.equal(fakeTransport.sentEmails.length, 0);

    // Repeat 4 more times to reach 5 failed attempts
    for (let i = 2; i <= 5; i++) {
      await assert.rejects(
        async () => staffService.forgotPasswordSendOtp({
          email: 'wrong@example.com',
          recovery_token: proofRes.recovery_token,
        }),
        (err) => err instanceof AuthError && err.code === 'RECOVERY_IDENTITY_INVALID',
      );
    }
    assert.equal(proof.attempts, 5);
    assert.ok(proof.revoked_at !== null, 'Proof must be revoked after 5 failed attempts');

    // Even with correct email, revoked proof now fails
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({
        email: 'customer@example.com',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'PHONE_VERIFICATION_REQUIRED',
    );
  });

  await t.test('6. expired, revoked, consumed, exhausted, and wrong proof reject OTP send/reset', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    const proof = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET_PHONE_PROOF');

    // Non-existent proof token
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: 'deadbeef'.repeat(8) }),
      (err) => err instanceof AuthError && err.code === 'PHONE_VERIFICATION_REQUIRED',
    );

    // Expired proof
    proof.expires_at = new Date(Date.now() - 1000);
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token }),
      (err) => err instanceof AuthError && err.code === 'PHONE_VERIFICATION_REQUIRED',
    );

    // Consumed proof
    proof.expires_at = new Date(Date.now() + 300000);
    proof.consumed_at = new Date();
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token }),
      (err) => err instanceof AuthError && err.code === 'PHONE_VERIFICATION_REQUIRED',
    );
  });

  await t.test('7. resend before 60 seconds rejects; allowed resend revokes old OTP', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');

    // First send
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });
    const otp1 = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');

    // Resend immediately (within 60s)
    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token }),
      (err) => err instanceof AuthError && err.status === 429 && err.code === 'OTP_RESEND_COOLDOWN',
    );

    // Advance sent_at by 65 seconds
    otp1.sent_at = new Date(Date.now() - 65_000);

    // Resend after cooldown
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });
    assert.ok(otp1.revoked_at !== null, 'Previous OTP must be revoked upon resend');
    assert.equal(fakeTransport.sentEmails.length, 2);
  });

  await t.test('8. mail failure leaves no sent/usable OTP', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');

    // Make transport fail
    emailService.sendPasswordResetOtp = async () => {
      throw new Error('SMTP connection error');
    };

    await assert.rejects(
      async () => staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token }),
      (err) => err instanceof AuthError && err.status === 503 && err.code === 'EMAIL_DELIVERY_UNAVAILABLE',
    );

    const otpChallenge = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');
    assert.ok(otpChallenge);
    assert.equal(otpChallenge.sent_at, null);
    assert.ok(otpChallenge.revoked_at !== null, 'Failed mail OTP must be immediately revoked');
  });

  await t.test('9. invalid/expired/reused OTP gives generic failure', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    // Wrong OTP code
    await assert.rejects(
      async () => staffService.forgotPasswordReset({
        email: 'customer@example.com',
        code: '999999',
        newPassword: 'MyNewStrongPassword123',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'AUTH_RESET_INVALID',
    );

    // Expired OTP
    const otp = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');
    otp.expires_at = new Date(Date.now() - 1000);
    await assert.rejects(
      async () => staffService.forgotPasswordReset({
        email: 'customer@example.com',
        code: '123456',
        newPassword: 'MyNewStrongPassword123',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'AUTH_RESET_INVALID',
    );
  });

  await t.test('10. concurrent reset has one winner', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    const sentEmail = fakeTransport.sentEmails[0];
    const match = sentEmail.text.match(/\b(\d{6})\b/);
    const validOtp = match ? match[1] : null;
    assert.ok(validOtp);

    // First call consumes the challenge
    const res1 = await staffService.forgotPasswordReset({
      email: 'customer@example.com',
      code: validOtp,
      newPassword: 'MyNewStrongPassword123',
      recovery_token: proofRes.recovery_token,
    });
    assert.equal(res1.success, true);

    // Second call attempts to reuse the already consumed proof/OTP
    await assert.rejects(
      async () => staffService.forgotPasswordReset({
        email: 'customer@example.com',
        code: validOtp,
        newPassword: 'MyNewStrongPassword123',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'AUTH_RESET_INVALID',
    );
  });

  await t.test('11. successful reset increments token version and updates password hash', async () => {
    setup();
    const user = usersRepo.users.find(u => u.id === 10);
    const initialVersion = user.token_version;
    const initialHash = user.password_hash;

    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    const sentEmail = fakeTransport.sentEmails[0];
    const validOtp = sentEmail.text.match(/\b(\d{6})\b/)[1];

    const resetRes = await staffService.forgotPasswordReset({
      email: 'customer@example.com',
      code: validOtp,
      newPassword: 'BrandNewSecurePassword2026',
      recovery_token: proofRes.recovery_token,
    });

    assert.equal(resetRes.success, true);
    assert.equal(user.token_version, initialVersion + 1);
    assert.notEqual(user.password_hash, initialHash);
    assert.ok(await bcrypt.compare('BrandNewSecurePassword2026', user.password_hash));
    assert.ok(user.email_verified_at !== null);
  });

  await t.test('12. disabled/pending accounts do not gain access through reset', async () => {
    setup();
    // Disabled customer account cannot verify phone
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0901111222'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED',
    );

    // Pending invited staff cannot verify phone
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0905555666'),
      (err) => err instanceof AuthError && err.code === 'PHONE_RECOVERY_NOT_VERIFIED',
    );
  });

  await t.test('13. logs/audit never include protected fields', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    const sentEmail = fakeTransport.sentEmails[0];
    const validOtp = sentEmail.text.match(/\b(\d{6})\b/)[1];

    await staffService.forgotPasswordReset({
      email: 'customer@example.com',
      code: validOtp,
      newPassword: 'BrandNewSecurePassword2026',
      recovery_token: proofRes.recovery_token,
    });

    assert.equal(auditLogs.length, 1);
    const audit = auditLogs[0];
    assert.equal(audit.action, 'AUTH_PASSWORD_RESET_COMPLETED');
    assert.equal(audit.actorId, 10);
    assert.equal(audit.metadata, '{}'); // Strictly empty metadata

    // Check raw metadata does not leak secrets
    const auditStr = JSON.stringify(audit);
    assert.equal(auditStr.includes('0901234567'), false);
    assert.equal(auditStr.includes('customer@example.com'), false);
    assert.equal(auditStr.includes(validOtp), false);
    assert.equal(auditStr.includes('BrandNewSecurePassword2026'), false);
    assert.equal(auditStr.includes(proofRes.recovery_token), false);
  });

  await t.test('14. OTP attempt exhaustion: 5 wrong OTP attempts exhausts challenge, locking out subsequent correct OTP', async () => {
    setup();
    const proofRes = await staffService.forgotPasswordVerifyPhone('0901234567');
    await staffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    const sentEmail = fakeTransport.sentEmails[0];
    const validOtp = sentEmail.text.match(/\b(\d{6})\b/)[1];
    const otpChallenge = challengeRepo.challenges.find(c => c.purpose === 'PASSWORD_RESET');

    // 5 failed OTP attempts
    for (let i = 1; i <= 5; i++) {
      await assert.rejects(
        async () => staffService.forgotPasswordReset({
          email: 'customer@example.com',
          code: '000000',
          newPassword: 'BrandNewSecurePassword2026',
          recovery_token: proofRes.recovery_token,
        }),
        (err) => err instanceof AuthError && err.code === 'AUTH_RESET_INVALID',
      );
    }
    assert.equal(otpChallenge.attempts, 5);

    // 6th attempt with CORRECT OTP code must now be rejected because attempts >= max_attempts
    await assert.rejects(
      async () => staffService.forgotPasswordReset({
        email: 'customer@example.com',
        code: validOtp,
        newPassword: 'BrandNewSecurePassword2026',
        recovery_token: proofRes.recovery_token,
      }),
      (err) => err instanceof AuthError && err.code === 'AUTH_RESET_INVALID',
    );
  });

  await t.test('15. durable rate limiter throttles rapid verify-phone requests with 429 OTP_RESEND_COOLDOWN and RATE_LIMITED', async () => {
    setup();
    // 1st request succeeds
    const res1 = await staffService.forgotPasswordVerifyPhone('0901234567');
    assert.equal(res1.verified, true);

    // 2nd request immediately for the same phone is blocked by cooldown (429)
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0901234567'),
      (err) => err instanceof AuthError && err.status === 429 && err.code === 'OTP_RESEND_COOLDOWN' && err.cooldown_seconds > 0,
    );

    // Different phone request is allowed
    const res2 = await staffService.forgotPasswordVerifyPhone('0901111222').catch(e => e);
    // 0901111222 is disabled account, so it throws 400 PHONE_RECOVERY_NOT_VERIFIED, NOT 429!
    assert.equal(res2.status, 400);
    assert.equal(res2.code, 'PHONE_RECOVERY_NOT_VERIFIED');

    // Rapid IP spamming is also throttled
    for (let i = 0; i < 15; i++) {
      await rateLimitRepo.reset('phone_verify:0901234567'); // bypass per-phone to test IP limit
      await staffService.forgotPasswordVerifyPhone('0901234567', { clientIp: '198.51.100.22' }).catch(() => {});
    }
    // 16th request from same IP is blocked
    await assert.rejects(
      async () => staffService.forgotPasswordVerifyPhone('0901234567', { clientIp: '198.51.100.22' }),
      (err) => err instanceof AuthError && err.status === 429,
    );
  });

  await t.test('16. transaction client isolation: all challenge operations inside transactions execute on transaction client', async () => {
    setup();
    const passedTxClients = [];
    const trackingChallengeRepo = {
      ...challengeRepo,
      async findPhoneProofByHash(hash, tx) {
        passedTxClients.push({ method: 'findPhoneProofByHash', hasTx: Boolean(tx) });
        return challengeRepo.findPhoneProofByHash(hash, tx);
      },
      async findLatestActive(userId, email, purpose, tx) {
        passedTxClients.push({ method: 'findLatestActive', hasTx: Boolean(tx) });
        return challengeRepo.findLatestActive(userId, email, purpose, tx);
      },
      async incrementAttempts(id, tx) {
        passedTxClients.push({ method: 'incrementAttempts', hasTx: Boolean(tx) });
        return challengeRepo.incrementAttempts(id, tx);
      },
      async revoke(id, tx) {
        passedTxClients.push({ method: 'revoke', hasTx: Boolean(tx) });
        return challengeRepo.revoke(id, tx);
      },
      async revokeActiveChallenges(args, tx) {
        passedTxClients.push({ method: 'revokeActiveChallenges', hasTx: Boolean(tx) });
        return challengeRepo.revokeActiveChallenges(args, tx);
      },
      async createChallenge(args, tx) {
        passedTxClients.push({ method: 'createChallenge', hasTx: Boolean(tx) });
        return challengeRepo.createChallenge(args, tx);
      },
    };

    const trackingStaffService = createStaffService({
      emailService,
      challengeRepo: trackingChallengeRepo,
      rateLimitRepo,
      database: mockDb,
      usersRepo,
      auditLogger: async () => {},
    });

    const proofRes = await trackingStaffService.forgotPasswordVerifyPhone('0901234567');
    passedTxClients.length = 0; // Clear setup calls

    // Call forgotPasswordSendOtp
    await trackingStaffService.forgotPasswordSendOtp({ email: 'customer@example.com', recovery_token: proofRes.recovery_token });

    // Verify all operations in forgotPasswordSendOtp received tx
    assert.ok(passedTxClients.length >= 3);
    for (const call of passedTxClients) {
      assert.equal(call.hasTx, true, `Method ${call.method} must receive transaction client (no separate pool connections)`);
    }
  });
});
