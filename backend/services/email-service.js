/**
 * Email Service with injected transport
 *
 * Production: Resend via native fetch
 * Dev/Test: inject a fake transport
 *
 * Mail is sent only after challenge creation. sent_at is set only after
 * successful send. Failure revokes the challenge. Production never logs OTPs.
 */

export function createEmailService({
  transport = null,
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  return {
    /**
     * Send an email using the configured transport.
     *
     * @param {Object} opts
     * @param {string} opts.to - Recipient email
     * @param {string} opts.subject - Email subject
     * @param {string} opts.text - Plain text body
     * @param {string} [opts.html] - HTML body (optional)
     * @returns {Promise<{success: boolean, messageId?: string}>}
     */
    async sendEmail({ to, subject, text, html }) {
      if (!to || typeof to !== 'string' || !to.includes('@')) {
        const error = new Error('Địa chỉ email không hợp lệ');
        error.status = 400;
        throw error;
      }

      if (isProduction && (!transport || typeof transport.sendMail !== 'function')) {
        const error = new Error('Dịch vụ gửi email chưa được cấu hình');
        error.status = 503;
        throw error;
      }

      if (transport && typeof transport.sendMail === 'function') {
        const result = await transport.sendMail({ to, subject, text, html });
        return { success: true, messageId: result?.messageId || null };
      }

      // Dev fallback: log to console (never in production)
      if (!isProduction) {
        console.log(`📧 [EmailService] To: ${to} | Subject: ${subject}`);
        return { success: true, messageId: `dev-${Date.now()}` };
      }

      // Production with no transport: fail closed
      const error = new Error('Dịch vụ gửi email chưa được cấu hình');
      error.status = 503;
      throw error;
    },

    /**
     * Send a password reset OTP email
     */
    async sendPasswordResetOtp(email, otpCode) {
      return this.sendEmail({
        to: email,
        subject: 'Mã xác thực đặt lại mật khẩu TeaPlus',
        text: `Mã OTP của bạn là: ${otpCode}. Mã có hiệu lực trong 10 phút.`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Khôi phục mật khẩu TeaPlus</h2>
          <p>Mã xác thực (OTP) đặt lại mật khẩu của bạn là:</p>
          <h1 style="color: #059669; letter-spacing: 4px;">${otpCode}</h1>
          <p>Mã này có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>`,
      });
    },

    /**
     * Send an email verification OTP email
     */
    async sendEmailVerificationOtp(email, otpCode) {
      return this.sendEmail({
        to: email,
        subject: 'Mã xác thực email tài khoản TeaPlus',
        text: `Mã OTP của bạn là: ${otpCode}. Mã có hiệu lực trong 10 phút.`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Xác thực địa chỉ Email TeaPlus</h2>
          <p>Mã xác thực (OTP) liên kết email của bạn là:</p>
          <h1 style="color: #059669; letter-spacing: 4px;">${otpCode}</h1>
          <p>Mã này có hiệu lực trong 10 phút.</p>
        </div>`,
      });
    },

    /**
     * Send a staff invitation email with accept link
     */
    async sendStaffInvitation(email, acceptToken, inviteeName) {
      const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:8080';
      const acceptUrl = `${appUrl}/chap-nhan-loi-moi?token=${acceptToken}`;

      return this.sendEmail({
        to: email,
        subject: 'Lời mời tham gia TeaPlus Staff',
        text: `Xin chào ${inviteeName || 'bạn'},\n\nBạn đã được mời tham gia hệ thống TeaPlus với tư cách nhân viên. Vui lòng truy cập đường dẫn sau để thiết lập mật khẩu và kích hoạt tài khoản:\n\n${acceptUrl}\n\nĐường dẫn có hiệu lực trong 24 giờ.\n\nTrân trọng,\nĐội ngũ TeaPlus`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Lời mời tham gia TeaPlus</h2>
          <p>Xin chào ${inviteeName || 'bạn'},</p>
          <p>Bạn đã được mời tham gia hệ thống <strong>TeaPlus</strong> với tư cách nhân viên.</p>
          <p>Vui lòng nhấn nút bên dưới để thiết lập mật khẩu và kích hoạt tài khoản:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}"
               style="background-color: #059669; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 8px; font-size: 16px;
                      font-weight: bold; display: inline-block;">
              Chấp nhận lời mời
            </a>
          </div>
          <p>Đường dẫn có hiệu lực trong <strong>24 giờ</strong>.</p>
          <hr style="margin-top: 30px;" />
          <p style="color: #666; font-size: 12px;">Nếu bạn không mong đợi email này, vui lòng bỏ qua nó.</p>
        </div>`,
      });
    },
  };
}

/**
 * Create a Resend transport using native fetch
 */
export function createResendTransport({ apiKey, fromEmail } = {}) {
  const key = apiKey || process.env.RESEND_API_KEY;
  const from = fromEmail || process.env.EMAIL_FROM || 'TeaPlus <onboarding@resend.dev>';

  if (!key) {
    // Don't throw at construction time — allow injection during tests
    // and fail closed at send time.
  }

  return {
    async sendMail({ to, subject, text, html }) {
      if (!key) {
        throw new Error('Resend API key is not configured. Set RESEND_API_KEY environment variable.');
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend API rejected request (${response.status}): ${body}`);
      }

      const data = await response.json();
      return { messageId: data?.id || null };
    },
  };
}

/**
 * Create a fake transport for testing
 */
export function createFakeTransport() {
  const sentEmails = [];
  return {
    sentEmails,
    async sendMail({ to, subject, text, html }) {
      sentEmails.push({ to, subject, text, html });
      return { messageId: `fake-${Date.now()}-${sentEmails.length}` };
    },
  };
}

export const emailService = createEmailService();
export default emailService;