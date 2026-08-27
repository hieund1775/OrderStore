import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { authenticate, signCustomerToken, signToken } from '../middleware/auth.js';
import { requestOtpCode, verifyOtpCode } from '../services/otp-service.js';
import emailService from '../services/email-service.js';
import usersRepository from '../repositories/postgres/users.js';
import { IdentityError } from '../repositories/postgres/errors.js';
import {
  CustomerValidationError,
  validateCustomerRegisterInput,
  normalizeAndValidatePhone,
  normalizeAndValidateFullName,
} from '../validation/customer-schemas.js';
import bcrypt from 'bcryptjs';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function customerPayload(user) {
  return {
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    email: user.email || null,
    tier: user.tier || 'Đồng',
    points: user.points || 0,
    is_admin: Boolean(user.is_admin),
    admin_role: user.admin_role || null,
    admin_branch_id: user.admin_branch_id ?? null,
  };
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

/** POST /api/auth/register — customer phone + password registration */
router.post('/register', async (req, res, next) => {
  try {
    const { phone, fullname, password } = validateCustomerRegisterInput(req.body);

    const user = await usersRepository.registerCustomer({ phone, fullname, password });
    const token = signCustomerToken(user);
    res.status(201).json({ token, user: customerPayload(user) });
  } catch (err) {
    if (err instanceof CustomerValidationError) return res.status(err.status || 400).json({ error: err.message });
    if (err instanceof IdentityError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/** POST /api/auth/login — customer & admin phone + password login */
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    let cleanPhone;
    try {
      cleanPhone = normalizeAndValidatePhone(phone);
    } catch {
      return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
    }
    if (!cleanPhone || !validatePassword(password)) {
      return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
    }
    const user = await usersRepository.findActiveUserByPhone(cleanPhone);
    const matches = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!matches) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
    const token = user.is_admin ? signToken(user) : signCustomerToken(user);
    res.json({ token, user: customerPayload(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/send-otp
 * Payload: { phone: string, fullname: string }
 */
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, fullname } = req.body || {};
    const cleanName = normalizeAndValidateFullName(fullname);
    const cleanPhone = normalizeAndValidatePhone(phone);

    const result = await requestOtpCode({ phone: cleanPhone });
    res.json(result);
  } catch (err) {
    if (err instanceof CustomerValidationError) return res.status(err.status || 400).json({ error: err.message });
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Payload: { phone: string, code: string, fullname: string }
 */
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, code, fullname } = req.body || {};
    const cleanPhone = normalizeAndValidatePhone(phone);
    const inputCode = String(code || '').trim();

    if (!inputCode) {
      return res.status(400).json({ error: 'Vui lòng nhập mã OTP' });
    }

    const verifyResult = await verifyOtpCode({ phone: cleanPhone, code: inputCode });
    if (!verifyResult.valid) {
      return res.status(400).json({ error: verifyResult.error || 'Mã OTP không chính xác' });
    }

    let displayName = `Khách hàng ${cleanPhone.slice(-4)}`;
    if (fullname && String(fullname).trim()) {
      displayName = normalizeAndValidateFullName(fullname);
    }

    const user = await usersRepository.findOrCreateCustomerByPhone({ phone: cleanPhone, fullname: displayName });

    if (!user) {
      return res.status(500).json({ error: 'Không thể khởi tạo tài khoản khách hàng' });
    }

    const token = signCustomerToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        fullname: user.fullname || displayName,
        phone: user.phone,
        tier: user.tier || 'Đồng',
        points: user.points || 0,
      },
    });
  } catch (err) {
    if (err instanceof CustomerValidationError) return res.status(err.status || 400).json({ error: err.message });
    if (err instanceof IdentityError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/google
 * Payload: { credential: string } — Google ID Token (JWT) từ GIS One-Tap
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Thiếu credential Google' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(400).json({ error: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn' });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).json({ error: 'Xác thực Google thất bại' });
    }

    const email = String(payload.email).toLowerCase();
    const fullname = payload.name || email.split('@')[0];

    const user = await usersRepository.findOrCreateGoogleCustomer({
      subject: String(payload.sub),
      email,
      fullname,
    });

    if (!user) {
      return res.status(500).json({ error: 'Không thể khởi tạo tài khoản Google' });
    }

    const token = signCustomerToken(user);

    res.json({
      token,
      user: customerPayload(user),
    });
  } catch (err) {
    if (err instanceof IdentityError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password/send-otp
 * Payload: { email: string }
 */
router.post('/forgot-password/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await usersRepository.findActiveUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản nào liên kết với email này' });
    }

    const result = await emailService.sendPasswordResetOtp(cleanEmail);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password/reset
 * Payload: { email: string, code: string, newPassword: string }
 */
router.post('/forgot-password/reset', async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin (email, mã OTP, mật khẩu mới)' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có độ dài từ 8 đến 128 ký tự' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await usersRepository.findActiveUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại' });
    }

    const verifyResult = await emailService.verifyPasswordResetOtp(cleanEmail, code);
    if (!verifyResult.valid) {
      return res.status(400).json({ error: verifyResult.error || 'Mã OTP không chính xác' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await usersRepository.updatePassword(user.id, passwordHash);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/profile/send-email-otp (Yêu cầu đăng nhập)
 * Payload: { email: string }
 */
router.post('/profile/send-email-otp', authenticate, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await usersRepository.findActiveUserByEmail(cleanEmail);
    const currentUserId = Number(req.user?.id || req.user?.sub);

    if (existing && existing.id !== currentUserId) {
      return res.status(409).json({ error: 'Địa chỉ email này đã được sử dụng bởi một tài khoản khác' });
    }

    const result = await emailService.sendEmailUpdateOtp(cleanEmail);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/profile/verify-email (Yêu cầu đăng nhập)
 * Payload: { email: string, code: string }
 */
router.post('/profile/verify-email', authenticate, async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mã OTP' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const verifyResult = await emailService.verifyEmailUpdateOtp(cleanEmail, code);
    if (!verifyResult.valid) {
      return res.status(400).json({ error: verifyResult.error || 'Mã OTP không chính xác' });
    }

    const currentUserId = Number(req.user?.id || req.user?.sub);
    const updated = await usersRepository.updateUserEmail(currentUserId, cleanEmail);

    res.json({
      success: true,
      message: 'Xác thực và cập nhật email tài khoản thành công',
      user: customerPayload(updated),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me (Yêu cầu đăng nhập)
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const currentUserId = Number(req.user?.id || req.user?.sub);
    const user = await usersRepository.findActiveUserById(currentUserId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản' });
    }
    res.json({ user: customerPayload(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
