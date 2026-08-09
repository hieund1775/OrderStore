import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'teaplus-dev-secret-change-me';

// ⏰ CHÍNH SÁCH HẾT HẠN TOKEN (đổi ở đây cho dễ chỉnh):
// - Token hết hạn lúc 24:00 (nửa đêm) mỗi ngày theo giờ thật — khung làm việc 08:00–24:00.
// - Đăng nhập sau nửa đêm (VD 2h sáng) → vẫn sống tới 24:00 hôm đó
//   (tương đương "tự reset lúc 8h sáng": phiên kéo dài cả ngày làm việc).
// - Tối thiểu 1h (đăng nhập sát 24:00 vẫn dùng được, không chết ngay).
// Muốn đổi: sửa MIN_HOURS hoặc bỏ dòng Math.max nếu muốn chết đúng 24:00.
const MIN_HOURS = 1;

function getExpirySeconds() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const toMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);
  return Math.max(MIN_HOURS * 3600, toMidnight);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.admin_role || 'super',
      branch_id: user.admin_branch_id ?? null,
    },
    SECRET,
    { expiresIn: getExpirySeconds() },
  );
}

export function signCustomerToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      phone: user.phone,
      role: 'customer',
    },
    SECRET,
    { expiresIn: '30d' },
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
