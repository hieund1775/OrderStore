import bcrypt from 'bcryptjs';
import { createEmailService, createResendTransport } from '../email-service.js';
import {
  authEmailChallengeRepository,
  generateSecureOtp,
  generateInviteToken,
  generateRecoveryToken,
  computeSecretHash,
  constantTimeEqual,
  normalizeEmail,
} from '../../repositories/postgres/auth-email-challenge.js';
import { usersRepository } from '../../repositories/postgres/users.js';
import { authRateLimitRepository } from '../../repositories/postgres/auth-rate-limit.js';
import { logAudit } from '../audit.js';
import postgresDb from '../../config/db-postgres.js';
import { normalizeAndValidateFullName, normalizeAndValidatePhone } from '../../validation/customer-schemas.js';

/**
 * Authorization errors
 */
export class AuthError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Extract actor user ID from req.user
 */
export function extractActorId(user) {
  if (!user) return null;
  return Number(user.id || user.sub || 0);
}

const BCRYPT_COST = 12;
const STAFF_ROLES = Object.freeze(['manager', 'cashier', 'kitchen', 'packing']);

function normalizeStaffFullName(fullname) {
  try {
    return normalizeAndValidateFullName(fullname, { allowSingleWord: true });
  } catch {
    throw new AuthError('Họ và tên không hợp lệ', 400);
  }
}

/**
 * Determine if an email delivery transport is available
 */
function resolveTransport() {
  if (process.env.RESEND_API_KEY) {
    return createResendTransport(process.env.RESEND_API_KEY);
  }
  return null;
}

/**
 * Create staff service with explicit dependency injection
 */
export function createStaffService({
  emailService = createEmailService({ transport: resolveTransport() }),
  challengeRepo = authEmailChallengeRepository,
  rateLimitRepo,
  database = postgresDb,
  usersRepo = usersRepository,
  auditLogger = logAudit,
} = {}) {
  const actualRateLimitRepo = rateLimitRepo !== undefined
    ? rateLimitRepo
    : (database && database !== postgresDb ? null : authRateLimitRepository);

  /**
   * Build a reusable challenge service
   */
  const challengeService = {
    /**
     * Create and send an OTP challenge for password reset or email verification
     */
    async createAndSendOtp({ userId, email, purpose, ttlMinutes = 10, maxAttempts = 5, actorId }) {
      const cleanEmail = normalizeEmail(email);
      const code = generateSecureOtp();
      const secretHash = computeSecretHash(code);

      // Revoke prior active challenges
      await challengeRepo.revokeActiveChallenges({ userId, email: cleanEmail, purpose });

      // Create new challenge (not sent yet)
      const challenge = await challengeRepo.createChallenge({
        userId,
        email: cleanEmail,
        purpose,
        secretHash,
        maxAttempts,
        ttlMinutes,
      });

      // Send email
      try {
        if (purpose === 'PASSWORD_RESET') {
          await emailService.sendPasswordResetOtp(cleanEmail, code);
        } else if (purpose === 'EMAIL_VERIFICATION') {
          await emailService.sendEmailVerificationOtp(cleanEmail, code);
        }
        // Mark as sent
        await challengeRepo.markSent(challenge.id);
      } catch (err) {
        // Send failed — revoke the challenge so it can't be used
        await challengeRepo.revoke(challenge.id);
        throw err;
      }

      return {
        success: true,
        message: 'Mã xác thực đã được gửi tới email của bạn',
        dev_code: process.env.NODE_ENV === 'production' ? undefined : code,
      };
    },

    /**
     * Verify an OTP challenge
     * Returns { valid: boolean, challenge?: object, error?: string }
     */
    async verifyOtp({ userId, email, purpose, code }) {
      const cleanEmail = normalizeEmail(email);
      const inputCode = String(code || '').trim();

      if (!inputCode || !cleanEmail) {
        return { valid: false, error: 'Vui lòng cung cấp email và mã OTP' };
      }

      return database.transaction(async (tx) => {
        const challenge = await challengeRepo.findLatestActive(userId, cleanEmail, purpose, tx);
        if (!challenge) {
          return { valid: false, error: 'Mã xác thực không tồn tại hoặc đã hết hạn' };
        }

        // Check expiry
        if (new Date(challenge.expires_at).getTime() <= Date.now()) {
          await challengeRepo.revoke(challenge.id, tx);
          return { valid: false, error: 'Mã xác thực đã hết hạn' };
        }

        // Check attempts
        if (challenge.attempts >= challenge.max_attempts) {
          await challengeRepo.revoke(challenge.id, tx);
          return { valid: false, error: 'Đã vượt quá số lần thử cho phép' };
        }

        // Verify HMAC
        const inputHash = computeSecretHash(inputCode);
        if (!constantTimeEqual(inputHash, challenge.secret_hash)) {
          await challengeRepo.incrementAttempts(challenge.id, tx);
          const remaining = challenge.max_attempts - challenge.attempts - 1;
          return { valid: false, error: `Mã xác thực không chính xác (còn ${remaining} lần thử)` };
        }

        // Consume
        await challengeRepo.consume(challenge.id, tx);
        return { valid: true, challenge };
      });
    },

    /**
     * Create and send a staff invitation (token-based, 24h TTL, single use)
     */
    async createAndSendInvitation({ userId, email, metadata, actorId }) {
      const cleanEmail = normalizeEmail(email);
      const token = generateInviteToken();
      const secretHash = computeSecretHash(token);

      // Revoke prior active invitations
      await challengeRepo.revokeActiveChallenges({ userId, email: cleanEmail, purpose: 'STAFF_INVITE' });

      // Create challenge (not sent yet)
      const challenge = await challengeRepo.createChallenge({
        userId,
        email: cleanEmail,
        purpose: 'STAFF_INVITE',
        secretHash,
        maxAttempts: 1, // Single use
        ttlMinutes: 24 * 60, // 24 hours
        metadata,
      });

      // Send email
      try {
        await emailService.sendStaffInvitation(cleanEmail, token, metadata?.fullname || null);
        await challengeRepo.markSent(challenge.id);
      } catch (err) {
        await challengeRepo.revoke(challenge.id);
        throw err;
      }

      return { success: true, token: process.env.NODE_ENV === 'production' ? undefined : token };
    },

    /**
     * Verify and accept a staff invitation
     */
    async acceptInvitation({ token, newPassword }) {
      const inputToken = String(token || '').trim();
      if (!inputToken || !newPassword) {
        throw new AuthError('Vui lòng cung cấp token và mật khẩu mới', 400);
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
        throw new AuthError('Mật khẩu phải có độ dài từ 8 đến 128 ký tự', 400);
      }

      const inputHash = computeSecretHash(inputToken);

      return database.transaction(async (tx) => {
        // Find the invitation by hash (we need to search all active STAFF_INVITE challenges)
        const [rows] = await tx.query(
          `SELECT id, user_id, email, secret_hash, expires_at, attempts, max_attempts,
                  consumed_at, revoked_at, sent_at, metadata
           FROM auth_email_challenges
           WHERE purpose = 'STAFF_INVITE'
             AND consumed_at IS NULL
             AND revoked_at IS NULL
             AND sent_at IS NOT NULL
             AND expires_at > CURRENT_TIMESTAMP
           ORDER BY created_at DESC`,
        );

        // Find matching challenge (constant-time comparison of each)
        let matched = null;
        for (const row of rows) {
          if (constantTimeEqual(inputHash, row.secret_hash)) {
            matched = row;
            break;
          }
        }

        if (!matched) {
          return { valid: false, error: 'Lời mời không hợp lệ hoặc đã hết hạn' };
        }

        // Lock the challenge row
        const [lockedChallenge] = await tx.query(
          `SELECT id, user_id, email, consumed_at, revoked_at, attempts, max_attempts
           FROM auth_email_challenges
           WHERE id = $1 FOR UPDATE`,
          [matched.id],
        );

        if (!lockedChallenge || lockedChallenge.consumed_at || lockedChallenge.revoked_at) {
          return { valid: false, error: 'Lời mời này đã được sử dụng hoặc đã thu hồi' };
        }

        if (lockedChallenge.attempts >= lockedChallenge.max_attempts) {
          return { valid: false, error: 'Lời mời không còn hiệu lực' };
        }

        // Load user
        const [userRows] = await tx.query(
          `SELECT id, fullname, is_admin, is_active, password_hash
           FROM users WHERE id = $1 FOR UPDATE`,
          [lockedChallenge.user_id],
        );
        const user = userRows[0];
        if (!user || !user.is_admin) {
          return { valid: false, error: 'Tài khoản không tồn tại' };
        }

        if (user.is_active && user.password_hash && user.password_hash !== '') {
          // Already activated
          return { valid: false, error: 'Tài khoản đã được kích hoạt trước đó' };
        }

        // Hash password and activate
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        await tx.query(
          `UPDATE users
           SET password_hash = $2, is_active = TRUE, token_version = token_version + 1,
               email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND is_admin = TRUE`,
          [user.id, passwordHash],
        );

        // Consume and revoke all other STAFF_INVITE challenges for this user
        await tx.query(
          `UPDATE auth_email_challenges
           SET consumed_at = CASE WHEN id = $1 THEN CURRENT_TIMESTAMP ELSE consumed_at END,
               revoked_at = CASE WHEN id != $1 AND consumed_at IS NULL THEN CURRENT_TIMESTAMP ELSE revoked_at END
           WHERE user_id = $2 AND purpose = 'STAFF_INVITE'`,
          [lockedChallenge.id, user.id],
        );

        return { valid: true, userId: user.id };
      });
    },
  };

  return {
    challengeService,
    emailService,

    /**
     * List staff accounts based on user role
     */
    async listStaff(actorRole, actorBranchId) {
      if (actorRole === 'super') {
        return usersRepo.listStaff(null);
      }
      return usersRepo.listStaff(actorBranchId);
    },

    /**
     * Create a new staff account
     */
    async createStaff({ actorId, actorRole, actorBranchId, fullname, email, role, branchId }) {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new AuthError('Email không hợp lệ', 400);
      }

      const cleanFullname = normalizeStaffFullName(fullname);

      // Validate role
      if (!STAFF_ROLES.includes(role)) {
        throw new AuthError('Vai trò không hợp lệ', 400);
      }

      // Authorization: Manager can only create cashier/kitchen/packing in own branch
      if (actorRole === 'manager') {
        if (role === 'manager' || role === 'super') {
          throw new AuthError('Bạn không có quyền tạo tài khoản quản lý hoặc super admin', 403);
        }
        if (!actorBranchId) {
          throw new AuthError('Tài khoản của bạn chưa được gán chi nhánh', 403);
        }
        // Force own branch
        branchId = actorBranchId;
      }

      // Super can create any role
      if (actorRole === 'super' && !branchId) {
        throw new AuthError('Super admin phải chọn chi nhánh khi tạo tài khoản', 400);
      }

      const user = await usersRepo.createStaff({ fullname: cleanFullname, email: cleanEmail, adminRole: role, branchId });

      // Send invitation
      await challengeService.createAndSendInvitation({
        userId: user.id,
        email: cleanEmail,
        metadata: { fullname: cleanFullname, role, branch_id: branchId },
        actorId,
      });

      // Audit
      await auditLogger(actorId, 'STAFF_ACCOUNT_CREATED',
        JSON.stringify({ target_id: user.id, role, branch_id: branchId }));

      return user;
    },

    async updateStaffBySuper({ actorId, actorRole, targetUserId, fullname, email, role, branchId }) {
      if (actorRole !== 'super') throw new AuthError('Chỉ Super Admin được chỉnh sửa tài khoản nhân sự', 403);
      const target = await usersRepo.findAdminById(targetUserId);
      if (!target) throw new AuthError('Không tìm thấy tài khoản', 404);

      const cleanFullname = normalizeStaffFullName(fullname);
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || !cleanEmail.includes('@')) throw new AuthError('Email không hợp lệ', 400);
      const normalizedBranchId = Number(branchId);
      const emailChanged = cleanEmail !== normalizeEmail(target.email);

      if (target.admin_role === 'super') {
        if (role !== 'super' || branchId !== null) {
          throw new AuthError('Không được thay đổi vai trò hoặc chi nhánh của Super Admin', 403);
        }
      } else {
        if (!STAFF_ROLES.includes(role)) throw new AuthError('Vai trò không hợp lệ', 400);
        if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
          throw new AuthError('Vui lòng chọn chi nhánh hợp lệ', 400);
        }
      }

      const sameEmailOwner = await usersRepo.findUserByEmail(cleanEmail);
      if (sameEmailOwner && Number(sameEmailOwner.id) !== Number(targetUserId)) {
        throw new AuthError('Email đã được sử dụng', 409);
      }

      const updated = await database.transaction(async (tx) => {
        if (target.admin_role !== 'super') {
          const [storeRows] = await tx.query(
            'SELECT id FROM stores WHERE id = $1 AND is_active = TRUE FOR KEY SHARE',
            [normalizedBranchId],
          );
          if (!storeRows[0]) throw new AuthError('Chi nhánh không tồn tại hoặc đã ngừng hoạt động', 400);
        }
        const result = await usersRepo.updateStaffAccount(targetUserId, {
          fullname: cleanFullname,
          email: cleanEmail,
          adminRole: target.admin_role === 'super' ? 'super' : role,
          branchId: target.admin_role === 'super' ? null : normalizedBranchId,
        }, { tx });
        if (!result) throw new AuthError('Không thể cập nhật tài khoản', 409);
        if (emailChanged) {
          await tx.query(
            `UPDATE auth_email_challenges
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
            [targetUserId],
          );
        }
        return result;
      });

      if (emailChanged) await auditLogger(actorId, 'STAFF_EMAIL_CHANGED', JSON.stringify({ target_id: Number(targetUserId) }));
      if (updated.admin_role !== target.admin_role) await auditLogger(actorId, 'STAFF_ROLE_CHANGED', JSON.stringify({ target_id: Number(targetUserId) }));
      if (Number(updated.admin_branch_id) !== Number(target.admin_branch_id)) {
        await auditLogger(actorId, 'STAFF_BRANCH_CHANGED', JSON.stringify({ target_id: Number(targetUserId) }));
      }

      if (emailChanged) {
        try {
          if (updated.is_active) {
            await challengeService.createAndSendOtp({ userId: updated.id, email: cleanEmail, purpose: 'PASSWORD_RESET' });
          } else {
            await challengeService.createAndSendInvitation({
              userId: updated.id,
              email: cleanEmail,
              metadata: { fullname: updated.fullname, role: updated.admin_role, branch_id: updated.admin_branch_id },
              actorId,
            });
          }
        } catch {
          throw new AuthError('Tài khoản đã được cập nhật nhưng chưa gửi được email thiết lập lại. Hãy gửi lại sau.', 503);
        }
      }

      return { ...updated, emailChanged };
    },

    async sendSuperPasswordReset({ actorId, actorRole, targetUserId }) {
      if (actorRole !== 'super') throw new AuthError('Chỉ Super Admin được đặt lại mật khẩu nhân sự', 403);
      const target = await usersRepo.findAdminById(targetUserId);
      if (!target) throw new AuthError('Không tìm thấy tài khoản', 404);
      if (!target.is_active) throw new AuthError('Tài khoản đang chờ lời mời; hãy gửi lại lời mời thay vì đặt lại mật khẩu', 409);
      if (!target.email) throw new AuthError('Tài khoản chưa có email', 400);

      await usersRepo.incrementTokenVersion(targetUserId);
      try {
        await challengeService.createAndSendOtp({ userId: target.id, email: target.email, purpose: 'PASSWORD_RESET' });
      } catch {
        throw new AuthError('Không thể gửi email đặt lại mật khẩu. Hãy thử lại sau.', 503);
      }
      await auditLogger(actorId, 'STAFF_PASSWORD_RESET_SENT', JSON.stringify({ target_id: Number(targetUserId) }));
      return { success: true };
    },

    /**
     * Resend invitation to a staff account
     */
    async resendInvitation({ actorId, actorRole, actorBranchId, targetUserId }) {
      const target = await usersRepo.findAdminById(targetUserId);
      if (!target) {
        throw new AuthError('Không tìm thấy tài khoản', 404);
      }

      // Authorization
      if (actorRole === 'manager') {
        if (target.admin_branch_id !== actorBranchId) {
          throw new AuthError('Bạn không có quyền thao tác với tài khoản ở chi nhánh khác', 403);
        }
      }

      if (!target.email) {
        throw new AuthError('Tài khoản chưa có email', 400);
      }

      // Send invitation
      await challengeService.createAndSendInvitation({
        userId: target.id,
        email: target.email,
        metadata: { fullname: target.fullname, role: target.admin_role, branch_id: target.admin_branch_id },
        actorId,
      });

      // Audit
      await auditLogger(actorId, 'STAFF_INVITATION_RESENT',
        JSON.stringify({ target_id: target.id }));

      return { success: true, message: 'Lời mời đã được gửi lại' };
    },

    /**
     * Enable or disable a staff account
     */
    async setStaffStatus({ actorId, actorRole, actorBranchId, targetUserId, isActive }) {
      const target = await usersRepo.findAdminById(targetUserId);
      if (!target) {
        throw new AuthError('Không tìm thấy tài khoản', 404);
      }

      if (target.admin_role === 'super') {
        throw new AuthError('Không thể thay đổi trạng thái của Super Admin', 403);
      }

      // Authorization
      if (actorRole === 'manager') {
        if (target.id === actorId) {
          throw new AuthError('Bạn không thể tự vô hiệu hóa tài khoản của mình', 403);
        }
        if (target.admin_branch_id !== actorBranchId) {
          throw new AuthError('Bạn không có quyền thao tác với tài khoản ở chi nhánh khác', 403);
        }
        if (target.admin_role === 'manager' || target.admin_role === 'super') {
          throw new AuthError('Bạn không có quyền vô hiệu hóa quản lý hoặc super admin', 403);
        }
      }

      // Cannot enable if account has no password (pending invitation)
      if (isActive) {
        const [userRows] = await database.query(
          `SELECT password_hash FROM users WHERE id = $1`,
          [targetUserId],
        );
        const user = userRows[0];
        if (!user || !user.password_hash || user.password_hash === '') {
          throw new AuthError('Tài khoản chưa thiết lập mật khẩu. Vui lòng gửi lời mời trước.', 400);
        }
      }

      const updated = await usersRepo.updateStaffStatus(targetUserId, isActive);

      // Audit
      const auditAction = isActive ? 'STAFF_ACCOUNT_ENABLED' : 'STAFF_ACCOUNT_DISABLED';
      await auditLogger(actorId, auditAction,
        JSON.stringify({ target_id: targetUserId }));

      return updated;
    },

    /**
     * Step 1: Verify registered phone and issue opaque recovery proof token
     */
    async forgotPasswordVerifyPhone(phone, { clientIp } = {}) {
      let cleanPhone;
      try {
        cleanPhone = normalizeAndValidatePhone(phone);
      } catch (err) {
        throw new AuthError(err.message || 'Số điện thoại không hợp lệ', 400, 'PHONE_INVALID');
      }

      // Durable rate limiting per phone (max 5 requests per 15 mins, 60s cooldown between requests)
      if (actualRateLimitRepo) {
        await actualRateLimitRepo.checkAndIncrement({
          key: `phone_verify:${cleanPhone}`,
          maxAttempts: 5,
          windowMs: 15 * 60 * 1000,
          cooldownMs: 60 * 1000,
        });

        if (clientIp && typeof clientIp === 'string') {
          await actualRateLimitRepo.checkAndIncrement({
            key: `phone_verify_ip:${clientIp.trim()}`,
            maxAttempts: 15,
            windowMs: 15 * 60 * 1000,
            cooldownMs: 2000,
          });
        }
      }

      const user = await usersRepo.findActiveUserByPhone(cleanPhone);
      // Account must exist, be active, have a usable email, and have password set up (not a pending invitation)
      if (!user || !user.is_active || !user.email || typeof user.email !== 'string' || !user.email.includes('@') || !user.password_hash) {
        throw new AuthError('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại số điện thoại.', 400, 'PHONE_RECOVERY_NOT_VERIFIED');
      }

      const recoveryToken = generateRecoveryToken();
      const secretHash = computeSecretHash(recoveryToken);

      await challengeRepo.createPhoneProofChallenge({
        userId: user.id,
        email: user.email,
        secretHash,
        ttlMinutes: 5,
        maxAttempts: 5,
      });

      return {
        verified: true,
        recovery_token: recoveryToken,
        expires_in_seconds: 300,
      };
    },

    /**
     * Step 2: Verify email against phone proof and send OTP
     */
    async forgotPasswordSendOtp({ email, recovery_token } = {}) {
      if (!recovery_token || typeof recovery_token !== 'string' || !recovery_token.trim()) {
        throw new AuthError('Vui lòng xác minh số điện thoại trước.', 400, 'PHONE_VERIFICATION_REQUIRED');
      }

      const cleanRecoveryToken = recovery_token.trim();
      let proofHash;
      try {
        proofHash = computeSecretHash(cleanRecoveryToken);
      } catch {
        throw new AuthError('Vui lòng xác minh số điện thoại trước.', 400, 'PHONE_VERIFICATION_REQUIRED');
      }

      const cleanEmailInput = normalizeEmail(email);

      const { challenge, cleanEmail, code } = await database.transaction(async (tx) => {
        const proof = await challengeRepo.findPhoneProofByHash(proofHash, tx);
        if (!proof || proof.consumed_at || proof.revoked_at || new Date(proof.expires_at).getTime() <= Date.now()) {
          throw new AuthError('Vui lòng xác minh số điện thoại trước.', 400, 'PHONE_VERIFICATION_REQUIRED');
        }

        if (proof.attempts >= proof.max_attempts) {
          await challengeRepo.revoke(proof.id, tx);
          throw new AuthError('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại.', 400, 'RECOVERY_IDENTITY_INVALID');
        }

        if (!cleanEmailInput || !cleanEmailInput.includes('@') || cleanEmailInput !== normalizeEmail(proof.email)) {
          const updatedAttempts = await challengeRepo.incrementAttempts(proof.id, tx);
          if (updatedAttempts >= proof.max_attempts) {
            await challengeRepo.revoke(proof.id, tx);
          }
          throw new AuthError('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại.', 400, 'RECOVERY_IDENTITY_INVALID');
        }

        // Check 60-second cooldown on existing active PASSWORD_RESET challenge for this user
        const latestOtp = await challengeRepo.findLatestActive(proof.user_id, cleanEmailInput, 'PASSWORD_RESET', tx);
        if (latestOtp && latestOtp.sent_at) {
          const elapsed = Date.now() - new Date(latestOtp.sent_at).getTime();
          if (elapsed < 60_000) {
            const waitSec = Math.ceil((60_000 - elapsed) / 1000);
            const err = new AuthError(`Vui lòng chờ ${waitSec} giây trước khi yêu cầu mã mới`, 429, 'OTP_RESEND_COOLDOWN');
            err.cooldown_seconds = waitSec;
            throw err;
          }
        }

        // Revoke prior active PASSWORD_RESET challenges before creating replacement
        await challengeRepo.revokeActiveChallenges({ userId: proof.user_id, email: cleanEmailInput, purpose: 'PASSWORD_RESET' }, tx);

        const code = generateSecureOtp();
        const secretHash = computeSecretHash(code);

        const challenge = await challengeRepo.createChallenge({
          userId: proof.user_id,
          email: cleanEmailInput,
          purpose: 'PASSWORD_RESET',
          secretHash,
          maxAttempts: 5,
          ttlMinutes: 10,
        }, tx);

        return { challenge, cleanEmail: cleanEmailInput, code };
      });

      // Send mail outside database transaction
      try {
        await emailService.sendPasswordResetOtp(cleanEmail, code);
        await challengeRepo.markSent(challenge.id);
      } catch (err) {
        await challengeRepo.revoke(challenge.id);
        throw new AuthError('Không thể gửi mã xác thực, vui lòng thử lại sau', 503, 'EMAIL_DELIVERY_UNAVAILABLE');
      }

      return {
        success: true,
        message: 'Mã xác thực đã được gửi tới email của bạn',
        cooldown_seconds: 60,
      };
    },

    /**
     * Step 3: Reset password using OTP and recovery proof
     */
    async forgotPasswordReset({ email, code, newPassword, recovery_token } = {}) {
      if (!recovery_token || typeof recovery_token !== 'string' || !recovery_token.trim()) {
        throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
      }

      const cleanEmail = normalizeEmail(email);
      const inputCode = String(code || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@') || !inputCode || !newPassword) {
        throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
        throw new AuthError('Mật khẩu mới phải có độ dài từ 8 đến 128 ký tự', 400, 'PASSWORD_INVALID');
      }

      let proofHash;
      try {
        proofHash = computeSecretHash(recovery_token.trim());
      } catch {
        throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
      }

      return database.transaction(async (tx) => {
        // 1. Lock and validate phone proof
        const proof = await challengeRepo.findPhoneProofByHash(proofHash, tx);
        if (!proof || proof.consumed_at || proof.revoked_at || new Date(proof.expires_at).getTime() <= Date.now()) {
          throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
        }

        if (proof.attempts >= proof.max_attempts) {
          await challengeRepo.revoke(proof.id, tx);
          throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
        }

        if (cleanEmail !== normalizeEmail(proof.email)) {
          const updatedAttempts = await challengeRepo.incrementAttempts(proof.id, tx);
          if (updatedAttempts >= proof.max_attempts) {
            await challengeRepo.revoke(proof.id, tx);
          }
          throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
        }

        // 2. Lock and validate OTP challenge
        const otpChallenge = await challengeRepo.findLatestActive(proof.user_id, cleanEmail, 'PASSWORD_RESET', tx);
        if (!otpChallenge || otpChallenge.attempts >= otpChallenge.max_attempts || new Date(otpChallenge.expires_at).getTime() <= Date.now()) {
          throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
        }

        const inputHash = computeSecretHash(inputCode);
        if (!constantTimeEqual(inputHash, otpChallenge.secret_hash)) {
          await challengeRepo.incrementAttempts(otpChallenge.id, tx);
          throw new AuthError('Mã xác thực không hợp lệ hoặc đã hết hạn', 400, 'AUTH_RESET_INVALID');
        }

        // 3. Update user password, increment token_version, set email_verified_at
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        const [updatedUserRows] = await tx.query(
          `UPDATE users
           SET password_hash = $2,
               token_version = token_version + 1,
               email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND is_active = TRUE
           RETURNING id`,
          [proof.user_id, passwordHash],
        );

        if (!updatedUserRows || updatedUserRows.length === 0) {
          throw new AuthError('Tài khoản không hợp lệ hoặc đã bị khóa', 400, 'AUTH_RESET_INVALID');
        }

        // 4. Consume OTP challenge
        await tx.query(
          `UPDATE auth_email_challenges
           SET consumed_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND consumed_at IS NULL`,
          [otpChallenge.id],
        );

        // 5. Consume and revoke the phone proof
        await tx.query(
          `UPDATE auth_email_challenges
           SET consumed_at = CURRENT_TIMESTAMP,
               revoked_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND consumed_at IS NULL`,
          [proof.id],
        );

        // 6. Revoke all remaining PASSWORD_RESET challenges for this user
        await tx.query(
          `UPDATE auth_email_challenges
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1
             AND purpose IN ('PASSWORD_RESET', 'PASSWORD_RESET_PHONE_PROOF')
             AND consumed_at IS NULL
             AND revoked_at IS NULL`,
          [proof.user_id],
        );

        // 7. Audit log AUTH_PASSWORD_RESET_COMPLETED with empty metadata {}
        await auditLogger(proof.user_id, 'AUTH_PASSWORD_RESET_COMPLETED', '{}');

        return {
          valid: true,
          success: true,
          message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.',
        };
      });
    },

    /**
     * Send email verification OTP for current user
     */
    async sendEmailVerificationOtp({ userId, email }) {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new AuthError('Email không hợp lệ', 400);
      }

      // Check email not taken by another user
      const existing = await usersRepo.findActiveUserByEmail(cleanEmail);
      if (existing && existing.id !== userId) {
        throw new AuthError('Địa chỉ email này đã được sử dụng bởi một tài khoản khác', 409);
      }

      try {
        const result = await challengeService.createAndSendOtp({
          userId,
          email: cleanEmail,
          purpose: 'EMAIL_VERIFICATION',
        });
        return result;
      } catch (err) {
        console.error('Failed to send email verification OTP:', err.message);
        throw new AuthError('Không thể gửi mã xác thực, vui lòng thử lại sau', 503);
      }
    },

    /**
     * Verify email for current user
     */
    async verifyEmail({ userId, email, code }) {
      const cleanEmail = normalizeEmail(email);

      const verifyResult = await challengeService.verifyOtp({
        userId,
        email: cleanEmail,
        purpose: 'EMAIL_VERIFICATION',
        code,
      });

      if (!verifyResult.valid) {
        return verifyResult;
      }

      // Update email and set email_verified_at
      await database.transaction(async (tx) => {
        await tx.query(
          `UPDATE users
           SET email = $2, email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [userId, cleanEmail],
        );
      });

      // Audit
      await auditLogger(userId, 'AUTH_EMAIL_VERIFIED', '{}');

      return { valid: true, message: 'Xác thực email thành công' };
    },
  };
}

export const staffService = createStaffService();
export default staffService;
