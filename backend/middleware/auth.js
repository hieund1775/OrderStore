import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'teaplus-dev-secret-change-me';
const EXPIRES_IN = '8h';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.admin_role || 'super',
      branch_id: user.admin_branch_id ?? null,
    },
    SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Thiếu token xác thực' });
  try {
    req.user = jwt.verify(token, SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa xác thực' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    return next();
  };
}
