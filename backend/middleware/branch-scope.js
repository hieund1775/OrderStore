/**
 * Branch Scope Policy & Helpers (Multi-branch / Multi-tenant isolation)
 */

export class ScopeError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'ScopeError';
    this.status = status;
  }
}

/**
 * Phân giải store_id hợp lệ dựa trên role và branch_id của user token.
 * 
 * Quy tắc:
 * - 'super': Cho phép xem toàn hệ thống (null) hoặc xem chi nhánh cụ thể (requestedStoreId).
 * - Role khác ('manager', 'cashier', 'kitchen'):
 *   + Bắt buộc phải có token chứa branch_id hợp lệ.
 *   + Nếu request không gửi store_id -> Tự ép về branch_id của user.
 *   + Nếu request gửi store_id khác branch_id của user -> Chặn 403 Forbidden.
 * 
 * @param {object} user - Payload giải mã từ JWT (req.user)
 * @param {number|string|null|undefined} requestedStoreId - store_id từ query/body/params
 * @returns {number|null} store_id hợp lệ để query DB
 */
export function resolveStoreScope(user, requestedStoreId = null) {
  if (!user) {
    throw new ScopeError('Chưa xác thực danh tính người dùng', 401);
  }

  const role = user.role || 'cashier';

  if (role === 'super') {
    if (requestedStoreId !== null && requestedStoreId !== undefined && requestedStoreId !== '') {
      const parsed = Number(requestedStoreId);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new ScopeError('Mã chi nhánh (store_id) không hợp lệ', 400);
      }
      return parsed;
    }
    return null; // super xem toàn bộ nếu không chọn chi nhánh
  }

  // Đối với non-super: bắt buộc phải có branch_id
  const userBranchId = user.branch_id !== null && user.branch_id !== undefined ? Number(user.branch_id) : null;
  if (!userBranchId || Number.isNaN(userBranchId) || userBranchId <= 0) {
    throw new ScopeError('Tài khoản chưa được gán chi nhánh hoạt động hợp lệ', 403);
  }

  if (requestedStoreId !== null && requestedStoreId !== undefined && requestedStoreId !== '') {
    const parsedRequested = Number(requestedStoreId);
    if (Number.isNaN(parsedRequested) || parsedRequested !== userBranchId) {
      throw new ScopeError('Bạn không có quyền truy cập dữ liệu của chi nhánh khác', 403);
    }
  }

  return userBranchId;
}

/**
 * Express middleware tự động kiểm tra và gắn `req.scopedStoreId`
 */
export function requireBranchScope(extractor = (req) => req.query.store_id ?? req.body?.store_id ?? req.params.store_id) {
  return (req, res, next) => {
    try {
      const requestedStoreId = extractor(req);
      req.scopedStoreId = resolveStoreScope(req.user, requestedStoreId);
      next();
    } catch (err) {
      const status = err.status || 403;
      return res.status(status).json({ error: err.message });
    }
  };
}
