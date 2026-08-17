/**
 * OTP Provider Abstraction
 * Handles outbound SMS delivery with strict separation between development and production.
 */

export class DevelopmentOtpProvider {
  constructor() {
    this.name = 'DevelopmentOtpProvider';
  }

  async sendSmsOtp({ phone, code }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DevelopmentOtpProvider cannot be used in production mode.');
    }
    console.log(`📱 [DEV_SMS_MOCK] Sent OTP ${code} to ${phone}`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }
}

export class ProductionSmsProvider {
  constructor({
    apiUrl = process.env.SMS_API_URL,
    apiKey = process.env.SMS_API_KEY,
    senderId = process.env.SMS_SENDER_ID,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.name = 'ProductionSmsProvider';
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.senderId = senderId;
    this.fetchImpl = fetchImpl;
  }

  async sendSmsOtp({ phone, code }) {
    if (!this.apiUrl || !this.apiKey || typeof this.fetchImpl !== 'function') {
      throw new Error('Production SMS provider is not fully configured.');
    }

    const response = await this.fetchImpl(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        senderId: this.senderId || undefined,
        message: `Ma OTP TeaPlus cua ban la ${code}. Ma co hieu luc trong 5 phut.`,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`SMS provider rejected request with status ${response.status}.`);
    }

    const payload = await response.json().catch(() => ({}));
    return { success: true, messageId: payload.messageId || payload.id || null };
  }
}

export function createOtpProvider() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (process.env.PHONE_OTP_ENABLED !== 'true') {
      throw new Error('Phone OTP is disabled in production.');
    }
    return new ProductionSmsProvider();
  }
  return new DevelopmentOtpProvider();
}
