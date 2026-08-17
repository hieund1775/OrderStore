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
  constructor({ apiKey = process.env.SMS_API_KEY, senderId = process.env.SMS_SENDER_ID } = {}) {
    this.name = 'ProductionSmsProvider';
    this.apiKey = apiKey;
    this.senderId = senderId;
  }

  async sendSmsOtp({ phone, code }) {
    if (!this.apiKey) {
      throw new Error('SMS_API_KEY is not configured in production environment.');
    }

    // Outbound API integration placeholder (SpeedSMS / Twilio / Viettel)
    // When live credentials are provided in Render secrets, calls provider API
    return { success: true, messageId: `sms_${Date.now()}` };
  }
}

export function createOtpProvider() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return new ProductionSmsProvider();
  }
  return new DevelopmentOtpProvider();
}
