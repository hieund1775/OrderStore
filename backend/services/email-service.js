import { generateSecureOtp } from './otp-service.js';

export function createEmailService({
  transport = null,
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  // In-memory store for pending email OTPs: key -> { code, expiresAt, attempts, purpose }
  const pendingOtps = new Map();

  function buildOtpKey(email, purpose) {
    return `${purpose}__${email.trim().toLowerCase()}`;
  }

  return {
    async sendPasswordResetOtp(email) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        const error = new Error('Địa chỉ email không hợp lệ');
        error.status = 400;
        throw error;
      }

      const cleanEmail = email.trim().toLowerCase();
      const code = generateSecureOtp();
      const ttlMs = 10 * 60 * 1000; // 10 minutes
      const expiresAt = Date.now() + ttlMs;

      const key = buildOtpKey(cleanEmail, 'reset-password');
      pendingOtps.set(key, {
        code,
        expiresAt,
        attempts: 0,
        purpose: 'reset-password',
      });

      // Send email via transport or console fallback
      if (transport && typeof transport.sendMail === 'function') {
        await transport.sendMail({
          to: cleanEmail,
          subject: 'Mã xác thực đặt lại mật khẩu TeaPlus',
          text: `Mã OTP của bạn là: ${code}. Mã có hiệu lực trong 10 phút.`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Khôi phục mật khẩu TeaPlus</h2>
            <p>Mã xác thực (OTP) đặt lại mật khẩu của bạn là:</p>
            <h1 style="color: #059669; letter-spacing: 4px;">${code}</h1>
            <p>Mã này có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
          </div>`,
        });
      } else {
        console.log(`📧 [EmailService] Password Reset OTP for ${cleanEmail}: ${code}`);
      }

      return {
        success: true,
        message: 'Mã xác thực đã được gửi tới email của bạn',
        demo_otp: isProduction ? undefined : code,
      };
    },

    async verifyPasswordResetOtp(email, code) {
      if (!email || !code) {
        return { valid: false, error: 'Email và mã OTP không được để trống' };
      }

      const cleanEmail = email.trim().toLowerCase();
      const inputCode = String(code).trim();
      const key = buildOtpKey(cleanEmail, 'reset-password');
      const record = pendingOtps.get(key);

      if (!record) {
        return { valid: false, error: 'Mã OTP không tồn tại hoặc đã hết hạn' };
      }

      if (Date.now() > record.expiresAt) {
        pendingOtps.delete(key);
        return { valid: false, error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới' };
      }

      if (record.attempts >= 5) {
        pendingOtps.delete(key);
        return { valid: false, error: 'Bạn đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới' };
      }

      if (record.code !== inputCode) {
        record.attempts += 1;
        return { valid: false, error: `Mã OTP không chính xác (còn ${5 - record.attempts} lần thử)` };
      }

      // Valid: consume OTP
      pendingOtps.delete(key);
      return { valid: true };
    },

    async sendEmailUpdateOtp(email) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        const error = new Error('Địa chỉ email không hợp lệ');
        error.status = 400;
        throw error;
      }

      const cleanEmail = email.trim().toLowerCase();
      const code = generateSecureOtp();
      const ttlMs = 10 * 60 * 1000;
      const expiresAt = Date.now() + ttlMs;

      const key = buildOtpKey(cleanEmail, 'update-email');
      pendingOtps.set(key, {
        code,
        expiresAt,
        attempts: 0,
        purpose: 'update-email',
      });

      if (transport && typeof transport.sendMail === 'function') {
        await transport.sendMail({
          to: cleanEmail,
          subject: 'Mã xác thực email tài khoản TeaPlus',
          text: `Mã OTP của bạn là: ${code}. Mã có hiệu lực trong 10 phút.`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Xác thực địa chỉ Email TeaPlus</h2>
            <p>Mã xác thực (OTP) liên kết email của bạn là:</p>
            <h1 style="color: #059669; letter-spacing: 4px;">${code}</h1>
            <p>Mã này có hiệu lực trong 10 phút.</p>
          </div>`,
        });
      } else {
        console.log(`📧 [EmailService] Email Update OTP for ${cleanEmail}: ${code}`);
      }

      return {
        success: true,
        message: 'Mã xác thực đã được gửi tới email của bạn',
        demo_otp: isProduction ? undefined : code,
      };
    },

    async verifyEmailUpdateOtp(email, code) {
      if (!email || !code) {
        return { valid: false, error: 'Email và mã OTP không được để trống' };
      }

      const cleanEmail = email.trim().toLowerCase();
      const inputCode = String(code).trim();
      const key = buildOtpKey(cleanEmail, 'update-email');
      const record = pendingOtps.get(key);

      if (!record) {
        return { valid: false, error: 'Mã OTP không tồn tại hoặc đã hết hạn' };
      }

      if (Date.now() > record.expiresAt) {
        pendingOtps.delete(key);
        return { valid: false, error: 'Mã OTP đã hết hạn' };
      }

      if (record.attempts >= 5) {
        pendingOtps.delete(key);
        return { valid: false, error: 'Đã vượt quá số lần thử OTP' };
      }

      if (record.code !== inputCode) {
        record.attempts += 1;
        return { valid: false, error: `Mã OTP không đúng (còn ${5 - record.attempts} lần thử)` };
      }

      pendingOtps.delete(key);
      return { valid: true };
    },
  };
}

export const emailService = createEmailService();
export default emailService;
