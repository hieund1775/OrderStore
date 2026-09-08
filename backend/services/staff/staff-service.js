import bcrypt from 'bcryptjs';
import { createEmailService, createResendTransport } from '../email-service.js';
import { authEmailChallengeRepository, generateSecureOtp, generateInviteToken, computeSecretHash, constantTimeEqual, normalizeEmail } from '../../repositories/postgres/auth-email-challenge.js';
import { usersRepository } from '../../repositories/postgres/users.js';
import { logAudit } from '../audit.js';
import postgresDb from '../../config/db-postgres.js';

/**
 * Authorization errors
 */
export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const BCRYPT_COST = 12;

/**
 * Resolve email transport based on environment
 */
function resolveTransport() {
  if (process.env.RESEND_API_KEY || (process.env.NODE_ENV === 'production' && process.env.EMAIL_PROVIDER === 'resend')) {
    return createResendTransport();
  }
  return null;
}

/**
 * Create staff service with explicit dependency injection
 */
export function createStaffService({
  emailService = createEmailService({ transport: resolveTransport() }),
  challengeRepo = authEmailChallengeRepository,
  database = postgresDb,
  usersRepo = usersRepository,
} = {}) {
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
          await challengeRepo.revoke(challenge.id);
          return { valid: false, error: 'Mã xác thực đã hết hạn' };
        }

        // Check attempts
        if (challenge.attempts >= challenge.max_attempts) {
          await challengeRepo.revoke(challenge.id);
          return { valid: false, error: 'Đã vượt quá số lần thử cho phép' };
        }

        // Verify HMAC
        const inputHash = computeSecretHash(inputCode);
        if (!constantTimeEqual(inputHash, challenge.secret_hash)) {
          await challengeRepo.incrementAttempts(challenge.id);
          const remaining = challenge.max_attempts - challenge.attempts - 1;
          return { valid: false, error: `Mã xác thực không chính xác (còn ${remaining} lần thử)` };
        }

        // Consume
        await challengeRepo.consume(challenge.id);
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

      if (!fullname || typeof fullname !== 'string' || !fullname.trim()) {
        throw new AuthError('Vui lòng nhập họ tên', 400);
      }

      // Validate role
      const VALID_ROLES = ['manager', 'cashier', 'kitchen', 'packing'];
      if (!VALID_ROLES.includes(role)) {
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

      const user = await usersRepo.createStaff({ fullname: fullname.trim(), email: cleanEmail, adminRole: role, branchId });

      // Send invitation
      await challengeService.createAndSendInvitation({
        userId: user.id,
        email: cleanEmail,
        metadata: { fullname: fullname.trim(), role, branch_id: branchId },
        actorId,
      });

      // Audit
      await logAudit(actorId, 'STAFF_ACCOUNT_CREATED',
        JSON.stringify({ target_id: user.id, email: cleanEmail, role, branch_id: branchId }));

      return user;
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
      await logAudit(actorId, 'STAFF_INVITATION_RESENT',
        JSON.stringify({ target_id: target.id, email: target.email }));

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
      await logAudit(actorId, auditAction,
        JSON.stringify({ target_id: targetUserId, email: target.email }));

      return updated;
    },

    /**
     * Forgot password: send OTP
     */
    async forgotPasswordSendOtp(email) {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new AuthError('Email không hợp lệ', 400);
      }

      let user = await usersRepo.findActiveUserByEmail(cleanEmail);
      if (!user) {
        user = await usersRepo.findStaffByEmail(cleanEmail);
      }

      try {
        const result = await challengeService.createAndSendOtp({
          userId: user ? user.id : null,
          email: cleanEmail,
          purpose: 'PASSWORD_RESET',
        });
        return { ...result, email: cleanEmail };
      } catch (err) {
        console.error('Failed to send password reset OTP:', err.message);
        return { success: true, message: 'Mã xác thực đã được gửi tới email của bạn (vui lòng kiểm tra hòm thư chính và thư rác)', email: cleanEmail };
      }
    },

    /**
     * Forgot password: reset with OTP
     */
    async forgotPasswordReset({ email, code, newPassword }) {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || !code || !newPassword) {
        throw new AuthError('Vui lòng nhập đầy đủ thông tin', 400);
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
        throw new AuthError('Mật khẩu mới phải có độ dài từ 8 đến 128 ký tự', 400);
      }

      let user = await usersRepo.findActiveUserByEmail(cleanEmail);
      if (!user) {
        user = await usersRepo.findStaffByEmail(cleanEmail);
      }

      // Verify OTP
      const verifyResult = await challengeService.verifyOtp({
        userId: user ? user.id : null,
        email: cleanEmail,
        purpose: 'PASSWORD_RESET',
        code,
      });

      if (!verifyResult.valid) {
        return verifyResult;
      }

      // Update password and increment token version
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      if (user) {
        await database.transaction(async (tx) => {
          await tx.query(
            `UPDATE users
             SET password_hash = $2, token_version = token_version + 1,
                 email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [user.id, passwordHash],
          );

          // Revoke all other PASSWORD_RESET challenges for this user
          await tx.query(
            `UPDATE auth_email_challenges
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND revoked_at IS NULL`,
            [user.id],
          );
        });

        // Audit
        await logAudit(user.id, 'AUTH_PASSWORD_RESET_COMPLETED',
          JSON.stringify({ email: cleanEmail }));
      } else {
        await database.query(
          `UPDATE auth_email_challenges
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE email = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND revoked_at IS NULL`,
          [cleanEmail],
        );
      }

      return { valid: true, message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.' };
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
      await logAudit(userId, 'AUTH_EMAIL_VERIFIED',
        JSON.stringify({ email: cleanEmail }));

      return { valid: true, message: 'Xác thực email thành công' };
    },
  };
}

export const staffService = createStaffService();
export default staffService;