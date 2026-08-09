import { Router } from 'express';
import db from '../config/db.js';
import { signCustomerToken } from '../middleware/auth.js';

const router = Router();

// In-memory OTP Store: Map<phone, { code, expiresAt, attempts }>
const otpStore = new Map();

/**
 * Clean phone number helper (removes spaces, dashes, etc.)
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * POST /api/auth/send-otp
 * Payload: { phone: string, fullname: string }
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, fullname } = req.body || {};
    const cleanPhone = cleanPhoneNumber(phone);

    if (!fullname || String(fullname).trim().length < 2) {
      return res.status(400).json({ error: 'Vui lòng nhập họ và tên hợp lệ (ít nhất 2 ký tự)' });
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ (ít nhất 10 chữ số)' });
    }

    const code = '123456'; // Default demo OTP code
    otpStore.set(cleanPhone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
    });

    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      message: 'Đã gửi mã OTP thành công',
      demo_otp: isDev ? code : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/verify-otp
 * Payload: { phone: string, code: string, fullname: string }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code, fullname } = req.body || {};
    const cleanPhone = cleanPhoneNumber(phone);
    const inputCode = String(code || '').trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    if (!inputCode) {
      return res.status(400).json({ error: 'Vui lòng nhập mã OTP' });
    }

    const record = otpStore.get(cleanPhone);
    const isDev = process.env.NODE_ENV !== 'production';

    if (!record && !isDev) {
      return res.status(400).json({ error: 'Mã OTP chưa được gửi hoặc đã hết hạn' });
    }

    if (record) {
      if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanPhone);
        return res.status(400).json({ error: 'Mã OTP đã hết hạn (quá 5 phút)' });
      }

      if (record.attempts >= 5) {
        otpStore.delete(cleanPhone);
        return res.status(400).json({ error: 'Đã thử sai quá 5 lần. Vui lòng xin mã OTP mới' });
      }

      if (record.code !== inputCode && !(isDev && inputCode === '123456')) {
        record.attempts += 1;
        return res.status(400).json({ error: 'Mã OTP không chính xác' });
      }
    } else if (isDev && inputCode !== '123456') {
      return res.status(400).json({ error: 'Mã OTP không chính xác' });
    }

    // Clear OTP after successful verification (Anti-replay)
    otpStore.delete(cleanPhone);

    // Search user in SQL Server
    const [existingUsers] = await db.query(
      'SELECT TOP 1 * FROM users WHERE phone = ? AND is_admin = 0',
      [cleanPhone]
    );

    let user = existingUsers && existingUsers[0];

    if (!user) {
      const displayName = (fullname && fullname.trim()) ? fullname.trim() : `Khách hàng ${cleanPhone.slice(-4)}`;
      await db.query(
        'INSERT INTO users (phone, fullname, is_admin) VALUES (?, ?, 0)',
        [cleanPhone, displayName]
      );
      
      const [newUsers] = await db.query(
        'SELECT TOP 1 * FROM users WHERE phone = ? AND is_admin = 0',
        [cleanPhone]
      );
      user = newUsers && newUsers[0];
    }

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
    res.status(500).json({ error: err.message });
  }
});

export default router;
