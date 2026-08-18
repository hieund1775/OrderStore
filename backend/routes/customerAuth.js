import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { signCustomerToken } from '../middleware/auth.js';
import { requestOtpCode, verifyOtpCode, normalizePhone } from '../services/otp-service.js';
import usersRepository from '../repositories/postgres/users.js';
import { IdentityError } from '../repositories/postgres/errors.js';
import bcrypt from 'bcryptjs';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function customerPayload(user) {
  return {
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    tier: user.tier || 'Đồng',
    points: user.points || 0,
  };
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

/** POST /api/auth/register — customer phone + password registration */
router.post('/register', async (req, res, next) => {
  try {
    const { phone, fullname, password } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    const cleanName = String(fullname || '').trim();
    if (!cleanPhone || cleanPhone.length < 10) return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    if (cleanName.length < 2 || cleanName.length > 120) return res.status(400).json({ error: 'Họ và tên không hợp lệ' });
    if (!validatePassword(password)) return res.status(400).json({ error: 'Mật khẩu phải dài từ 8 đến 128 ký tự' });

    const user = await usersRepository.registerCustomer({ phone: cleanPhone, fullname: cleanName, password });
    const token = signCustomerToken(user);
    res.status(201).json({ token, user: customerPayload(user) });
  } catch (err) {
    if (err instanceof IdentityError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/** POST /api/auth/login — customer phone + password login */
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !validatePassword(password)) {
      return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
    }
    const user = await usersRepository.findActiveCustomerByPhone(cleanPhone);
    const matches = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!matches) return res.status(401).json({ error: 'Số điện thoại hoặc mật khẩu không đúng' });
    const token = signCustomerToken(user);
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
    const cleanPhone = normalizePhone(phone);

    if (!fullname || String(fullname).trim().length < 2) {
      return res.status(400).json({ error: 'Vui lòng nhập họ và tên hợp lệ (ít nhất 2 ký tự)' });
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ (ít nhất 10 chữ số)' });
    }

    const result = await requestOtpCode({ phone: cleanPhone });
    res.json(result);
  } catch (err) {
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
    const cleanPhone = normalizePhone(phone);
    const inputCode = String(code || '').trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    if (!inputCode) {
      return res.status(400).json({ error: 'Vui lòng nhập mã OTP' });
    }

    const verifyResult = await verifyOtpCode({ phone: cleanPhone, code: inputCode });
    if (!verifyResult.valid) {
      return res.status(400).json({ error: verifyResult.error || 'Mã OTP không chính xác' });
    }

    const displayName = (fullname && fullname.trim()) ? fullname.trim() : `Khách hàng ${cleanPhone.slice(-4)}`;
    const user = await usersRepository.findOrCreateCustomerByPhone({ phone: cleanPhone, fullname: displayName });

    if (!user) {
      return res.status(500).json({ error: 'Không thể khởi tạo tài khoản khách hàng' });
    }

    const token = signCustomerToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        fullname: user.fullname || fullname || `Khách hàng ${cleanPhone.slice(-4)}`,
        phone: user.phone,
        tier: user.tier || 'Đồng',
        points: user.points || 0,
      },
    });
  } catch (err) {
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
      user: {
        id: user.id,
        fullname: user.fullname || fullname,
        phone: user.phone,
        tier: user.tier || 'Đồng',
        points: user.points || 0,
      },
    });
  } catch (err) {
    if (err instanceof IdentityError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
