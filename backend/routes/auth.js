import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken, authenticate } from '../middleware/auth.js';
import usersRepository from '../repositories/postgres/users.js';
import postgresDb from '../config/db-postgres.js';

const router = Router();

const DEMO_ACCOUNTS = {
  '0909000001': { role: 'super', name: 'Super Administrator', pass: 'admin123' },
  '0909000002': { role: 'manager', name: 'Quản lý Chi nhánh 1', pass: 'admin123' },
  '0909000003': { role: 'cashier', name: 'Thu ngân Chi nhánh 1', pass: 'admin123' },
  '0909000004': { role: 'kitchen', name: 'Đầu bếp Chi nhánh 1', pass: 'admin123' },
  '0909000006': { role: 'packing', name: 'Nhân viên Soạn hàng Chi nhánh 1', pass: 'admin123' },
};

async function autoProvisionDemoAdmin(phone, password) {
  const demo = DEMO_ACCOUNTS[phone];
  if (!demo || demo.pass !== password) return null;
  try {
    const hash = await bcrypt.hash(password, 10);
    await postgresDb.query(
      `INSERT INTO users (fullname, phone, email, password_hash, tier, points, is_admin, admin_role, admin_branch_id, is_active)
       VALUES ($1, $2, $3, $4, 'Kim Cương', 1000, TRUE, $5, NULL, TRUE)
       ON CONFLICT (phone) DO UPDATE SET 
         fullname = EXCLUDED.fullname,
         password_hash = EXCLUDED.password_hash,
         is_admin = TRUE,
         admin_role = EXCLUDED.admin_role,
         is_active = TRUE`,
      [demo.name, phone, `${demo.role}@teaplus.vn`, hash, demo.role],
    );
    console.log(`🌱 [Auto-Provision] Đã tự động kích hoạt tài khoản demo: ${phone} (${demo.role})`);
    return await usersRepository.findActiveAdminByPhone(phone);
  } catch (err) {
    console.warn(`⚠️ [Auto-Provision] Lỗi tự tạo tài khoản:`, err.message);
    return null;
  }
}

/**
 * @swagger
 * /admin/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập admin (trả JWT)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string, example: "0900000000" }
 *               password: { type: string, example: "admin123" }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Sai SĐT hoặc mật khẩu }
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập số điện thoại và mật khẩu' });
    }
    let user = await usersRepository.findActiveAdminByPhone(phone);
    if (!user && DEMO_ACCOUNTS[phone]) {
      user = await autoProvisionDemoAdmin(phone, password);
    }
    if (!user) {
      console.warn(`⚠️ [Admin Login] Không tìm thấy tài khoản admin đang hoạt động với SĐT: "${phone}"`);
      return res.status(401).json({ error: 'Sai số điện thoại hoặc mật khẩu' });
    }
    let isMatch = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch && DEMO_ACCOUNTS[phone] && DEMO_ACCOUNTS[phone].pass === password) {
      user = await autoProvisionDemoAdmin(phone, password);
      isMatch = true;
    }
    if (!isMatch) {
      console.warn(`⚠️ [Admin Login] Mật khẩu không khớp cho tài khoản SĐT: "${phone}"`);
      return res.status(401).json({ error: 'Sai số điện thoại hoặc mật khẩu' });
    }
    console.log(`✅ [Admin Login] Đăng nhập thành công: ${user.fullname} (Role: ${user.admin_role})`);
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        phone: user.phone,
        role: user.admin_role,
        branch_id: user.admin_branch_id,
      },
    });
  } catch (err) {
    console.error('Admin login failed:', err.message);
    res.status(500).json({ error: 'Không thể đăng nhập lúc này, vui lòng thử lại' });
  }
});

/**
 * @swagger
 * /admin/me:
 *   get:
 *     tags: [Auth]
 *     summary: Thông tin admin hiện tại (cần JWT)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/me', authenticate, async (req, res) => {
  const user = await usersRepository.findActiveUserById(req.user.sub);
  if (!user || !user.is_admin) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  res.json({
    id: user.id,
    fullname: user.fullname,
    phone: user.phone,
    email: user.email,
    admin_role: user.admin_role,
    admin_branch_id: user.admin_branch_id,
    email_verified_at: user.email_verified_at || null,
  });
});

export default router;
