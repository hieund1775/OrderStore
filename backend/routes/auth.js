import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken, authenticate } from '../middleware/auth.js';
import usersRepository from '../repositories/postgres/users.js';

const router = Router();

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
    const user = await usersRepository.findActiveAdminByPhone(phone);
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Sai số điện thoại hoặc mật khẩu' });
    }
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
  });
});

export default router;
