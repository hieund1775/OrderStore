/**
 * PayOS Webhook Error Classifier & CAS Execution Helper
 * Ensures correct HTTP status codes (200 for non-retryable business logic, 500 for retryable infra errors).
 */

export const PAYOS_CAS_UPDATE_SQL = `
  UPDATE orders
  SET payment_status = 'paid',
      paid_at = CURRENT_TIMESTAMP,
      transaction_id = $2,
      payment_provider = 'payos',
      updated_at = CURRENT_TIMESTAMP
  WHERE (payos_order_code = $1 OR payment_link_id = $3)
    AND payment_status = 'unpaid'
    AND payment_provider = 'payos'
    AND total = $4
`;

/**
 * Classifies an error into appropriate HTTP status code and response payload for PayOS Webhook.
 *
 * @param {Error|Object} err
 * @returns {{ statusCode: number, body: { ok: boolean, message?: string, error?: string } }}
 */
export function classifyWebhookError(err) {
  if (
    err?.type === 'INVALID_SIGNATURE' ||
    err?.name === 'SignatureError' ||
    err?.message?.includes('Chữ ký') ||
    err?.message?.includes('signature')
  ) {
    return {
      statusCode: 200,
      body: { ok: false, message: 'Chữ ký không hợp lệ' },
    };
  }

  if (err?.type === 'BUSINESS_REJECTION') {
    return {
      statusCode: 200,
      body: { ok: false, message: err.message || 'Giao dịch bị từ chối' },
    };
  }

  // Infrastructure / Database error -> HTTP 500 so PayOS will retry
  return {
    statusCode: 500,
    body: { ok: false, error: 'Lỗi hạ tầng máy chủ khi xử lý webhook' },
  };
}

/**
 * Classifies failure reasons when CAS UPDATE affects 0 rows.
 *
 * @param {Object} params
 * @param {Object|null} params.order Order record found in database
 * @param {number} params.webhookAmount Amount reported in webhook payload
 * @returns {{ ok: boolean, statusCode: number, message: string, reason: string }}
 */
export function classifyCASZeroAffected({ order, webhookAmount }) {
  if (!order) {
    return {
      ok: false,
      statusCode: 200,
      message: 'Không tìm thấy đơn hàng',
      reason: 'NOT_FOUND',
    };
  }

  if (order.payment_status === 'paid') {
    return {
      ok: true,
      statusCode: 200,
      message: 'Đơn hàng đã được xác nhận thanh toán từ trước',
      reason: 'ALREADY_PAID',
    };
  }

  if (order.payment_status === 'expired') {
    return {
      ok: false,
      statusCode: 200,
      message: 'Đơn hàng đã hết hạn thanh toán, không thể xác nhận',
      reason: 'EXPIRED',
    };
  }

  if (order.payment_provider !== 'payos') {
    return {
      ok: false,
      statusCode: 200,
      message: `Đơn hàng không sử dụng cổng PayOS (${order.payment_provider})`,
      reason: 'WRONG_PROVIDER',
    };
  }

  if (Number(order.total) !== Number(webhookAmount)) {
    return {
      ok: false,
      statusCode: 200,
      message: `Số tiền thanh toán (${webhookAmount}đ) lệch với tổng đơn (${order.total}đ)`,
      reason: 'AMOUNT_MISMATCH',
    };
  }

  return {
    ok: false,
    statusCode: 200,
    message: 'Không thể cập nhật trạng thái đơn hàng',
    reason: 'UNKNOWN_REJECTION',
  };
}
