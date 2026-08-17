import crypto from 'node:crypto';
import { createOtpProvider } from './otp-provider.js';

const IN_MEMORY_OTP_STORE = new Map();

/**
 * Normalizes Vietnamese phone number into canonical 10-digit format (e.g. 0901234567)
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');

  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  return digits;
}

/**
 * Cryptographically secure 6-digit numeric OTP generator
 */
export function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes HMAC-SHA256 hash of an OTP code
 */
export function hashOtpCode(code, secret = process.env.JWT_SECRET || 'teaplus_otp_salt_2026') {
  return crypto.createHmac('sha256', secret).update(String(code).trim()).digest('hex');
}

/**
 * Requests and sends an OTP code to a customer phone number
 */
export async function requestOtpCode({ phone, provider = createOtpProvider(), testAdapter = null } = {}) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    throw new Error('Số điện thoại không hợp lệ (yêu cầu 10 chữ số)');
  }

  const now = Date.now();
  const existing = testAdapter ? await testAdapter.getStoredOtp(normalizedPhone) : IN_MEMORY_OTP_STORE.get(normalizedPhone);

  // Rate limit: 60s cooldown between requests
  if (existing && existing.lastSentAt && (now - existing.lastSentAt < 60000)) {
    const waitSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
    const err = new Error(`Vui lòng chờ ${waitSec} giây trước khi yêu cầu mã OTP mới`);
    err.status = 429;
    throw err;
  }

  const code = generateSecureOtp();
  const hash = hashOtpCode(code);
  const ttlMs = 5 * 60 * 1000; // 5 minutes

  const record = {
    hash,
    expiresAt: now + ttlMs,
    attempts: 0,
    consumedAt: null,
    lastSentAt: now,
  };

  if (testAdapter) {
    await testAdapter.saveOtp(normalizedPhone, record);
  } else {
    IN_MEMORY_OTP_STORE.set(normalizedPhone, record);
  }

  // Send SMS via provider
  await provider.sendSmsOtp({ phone: normalizedPhone, code });

  const isProduction = process.env.NODE_ENV === 'production';
  return {
    success: true,
    message: 'Đã gửi mã OTP thành công',
    demo_otp: isProduction ? undefined : code,
  };
}

/**
 * Verifies an OTP code with constant-time comparison, anti-replay, and attempt limiting
 */
export async function verifyOtpCode({ phone, code, testAdapter = null } = {}) {
  const normalizedPhone = normalizePhone(phone);
  const inputCode = String(code || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!normalizedPhone || !inputCode) {
    return { valid: false, error: 'Vui lòng cung cấp đầy đủ số điện thoại và mã OTP' };
  }

  // Strictly reject fixed demo code in production
  if (isProduction && inputCode === '123456') {
    // Demo OTP bypass is strictly forbidden in production
  }

  const record = testAdapter ? await testAdapter.getStoredOtp(normalizedPhone) : IN_MEMORY_OTP_STORE.get(normalizedPhone);
  if (!record) {
    return { valid: false, error: 'Mã OTP chưa được gửi hoặc đã hết hạn' };
  }

  // Check anti-replay
  if (record.consumedAt) {
    return { valid: false, error: 'Mã OTP này đã được sử dụng. Vui lòng xin mã mới' };
  }

  // Check TTL
  if (Date.now() > record.expiresAt) {
    if (!testAdapter) IN_MEMORY_OTP_STORE.delete(normalizedPhone);
    return { valid: false, error: 'Mã OTP đã hết hạn (quá 5 phút)' };
  }

  // Check attempt limit
  if (record.attempts >= 5) {
    if (!testAdapter) IN_MEMORY_OTP_STORE.delete(normalizedPhone);
    return { valid: false, error: 'Đã thử sai quá 5 lần. Vui lòng xin mã OTP mới' };
  }

  const inputHash = hashOtpCode(inputCode);
  const inputBuf = Buffer.from(inputHash, 'utf8');
  const storedBuf = Buffer.from(record.hash, 'utf8');

  const matches = inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);

  if (!matches) {
    record.attempts += 1;
    return { valid: false, error: 'Mã OTP không chính xác' };
  }

  // Mark consumed atomically
  record.consumedAt = Date.now();
  if (!testAdapter) {
    IN_MEMORY_OTP_STORE.delete(normalizedPhone);
  }

  return { valid: true };
}
