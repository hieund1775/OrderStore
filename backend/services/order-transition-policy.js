/**
 * Order State Transition Policy & Role-Based Access Engine
 * Centralized production policy module for order status state transitions.
 */

export const VALID_STATUSES = [
  'Chờ xác nhận',
  'Đã xác nhận',
  'Đang chuẩn bị',
  'Đang giao',
  'Hoàn thành',
  'Đã hủy',
];

export const VALID_TRANSITIONS = {
  'Chờ xác nhận': ['Đã xác nhận', 'Đang chuẩn bị', 'Đã hủy'],
  'Đã xác nhận': ['Đang chuẩn bị', 'Đang giao', 'Đã hủy'],
  'Đang chuẩn bị': ['Đang giao', 'Hoàn thành', 'Đã hủy'],
  'Đang giao': ['Hoàn thành', 'Đã hủy'],
  'Hoàn thành': [],
  'Đã hủy': [],
};

export const ROLE_ALLOWED_TARGET_STATUS = {
  super: ['Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy'],
  manager: ['Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy'],
  kitchen: ['Đang chuẩn bị', 'Đang giao', 'Hoàn thành'],
  cashier: ['Đã xác nhận', 'Đã hủy'],
  customer: ['Đã hủy'],
};

/**
 * Evaluates whether an order state transition is permitted for a given role and order state.
 *
 * @param {Object} params
 * @param {string} params.currentStatus Current status of the order
 * @param {string} params.targetStatus Target status to transition to
 * @param {string} params.role User role ('super', 'manager', 'kitchen', 'cashier', 'customer')
 * @param {boolean} [params.isPaid=false] Whether the order is paid
 * @returns {{ allowed: boolean, status?: number, error?: string, idempotent?: boolean }}
 */
export function evaluateOrderTransition({ currentStatus, targetStatus, role, isPaid = false }) {
  if (!VALID_STATUSES.includes(targetStatus)) {
    return { allowed: false, status: 400, error: `Trạng thái mục tiêu "${targetStatus}" không hợp lệ` };
  }

  // Idempotent case: no-op transition to same status
  if (currentStatus === targetStatus) {
    return { allowed: true, idempotent: true };
  }

  // Terminal state check
  if (currentStatus === 'Hoàn thành' || currentStatus === 'Đã hủy') {
    return {
      allowed: false,
      status: 400,
      error: `Đơn hàng đã ở trạng thái kết thúc "${currentStatus}", không thể chuyển sang "${targetStatus}"`,
    };
  }

  // Valid transition path check
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      status: 400,
      error: `Không thể chuyển trạng thái từ "${currentStatus}" sang "${targetStatus}"`,
    };
  }

  // Role permissions check
  const allowedByRole = ROLE_ALLOWED_TARGET_STATUS[role] || [];
  if (!allowedByRole.includes(targetStatus)) {
    return {
      allowed: false,
      status: 403,
      error: `Vai trò "${role}" không có quyền chuyển đơn hàng sang trạng thái "${targetStatus}"`,
    };
  }

  // Customer role specific rules
  if (role === 'customer') {
    if (isPaid) {
      return {
        allowed: false,
        status: 400,
        error: 'Đơn hàng đã thanh toán không thể tự hủy qua cổng khách hàng. Vui lòng liên hệ hotline quán',
      };
    }
    if (currentStatus !== 'Chờ xác nhận' && currentStatus !== 'Đang chuẩn bị') {
      return {
        allowed: false,
        status: 400,
        error: `Đơn hàng đang ở trạng thái "${currentStatus}", không thể hủy`,
      };
    }
  }

  // Kitchen role specific rules
  if (role === 'kitchen') {
    if (targetStatus === 'Đang chuẩn bị' && currentStatus !== 'Đã xác nhận' && currentStatus !== 'Chờ xác nhận') {
      return {
        allowed: false,
        status: 400,
        error: 'Bếp chỉ có thể nhận đơn từ trạng thái "Chờ xác nhận" hoặc "Đã xác nhận"',
      };
    }
    if (targetStatus === 'Hoàn thành' && currentStatus !== 'Đang chuẩn bị') {
      return {
        allowed: false,
        status: 400,
        error: 'Bếp chỉ có thể hoàn thành món từ trạng thái "Đang chuẩn bị"',
      };
    }
    if (targetStatus === 'Đang giao' && currentStatus !== 'Đang chuẩn bị') {
      return {
        allowed: false,
        status: 400,
        error: 'Bếp chỉ có thể chuyển giao đơn từ trạng thái "Đang chuẩn bị"',
      };
    }
  }

  // Cancellation specific rules
  if (targetStatus === 'Đã hủy') {
    if (isPaid && role === 'cashier') {
      return {
        allowed: false,
        status: 403,
        error: 'Đơn hàng đã thanh toán, chỉ Quản lý hoặc Super Admin mới có quyền hủy đơn',
      };
    }
  }

  return { allowed: true };
}
