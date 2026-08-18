/**
 * Public DTO Builder & Public Input Validation Policy
 * Ensures strict encapsulation and prevents sensitive PII / internal data leakage.
 */

export const VALID_SOURCES = ['online', 'pos'];
export const VALID_ORDER_TYPES = ['Delivery', 'Take-away', 'POS'];
export const VALID_PAYMENT_METHODS = ['COD', 'VietQR', 'MoMo', 'ZaloPay'];

/**
 * Validates order creation payload from public / POS client.
 *
 * @param {Object} body
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateOrderCreationInput(body = {}) {
  const { source, order_type, payment_method } = body;

  if (source !== undefined && !VALID_SOURCES.includes(source)) {
    return {
      valid: false,
      error: `Nguồn đơn (source) "${source}" không hợp lệ. Cho phép: ${VALID_SOURCES.join(', ')}`,
    };
  }

  if (order_type !== undefined && !VALID_ORDER_TYPES.includes(order_type)) {
    return {
      valid: false,
      error: `Loại đơn (order_type) "${order_type}" không hợp lệ. Cho phép: ${VALID_ORDER_TYPES.join(', ')}`,
    };
  }

  if (payment_method !== undefined && !VALID_PAYMENT_METHODS.includes(payment_method)) {
    return {
      valid: false,
      error: `Phương thức thanh toán (payment_method) "${payment_method}" không hợp lệ. Cho phép: ${VALID_PAYMENT_METHODS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Builds safe public order lookup DTO with customer-specific PII masking.
 *
 * @param {Object} order
 * @param {Object|null} [decodedToken=null]
 * @param {Array} [items=[]]
 * @param {Array} [history=[]]
 * @returns {Object} Safe public order DTO
 */
export function buildPublicLookupDto(order, decodedToken = null, items = [], history = []) {
  const isCustomerOwner =
    decodedToken?.role === 'customer' &&
    Boolean(order.user_id) &&
    Number(decodedToken.id || decodedToken.sub) === Number(order.user_id);

  const maskedPhone = isCustomerOwner
    ? order.customer_phone
    : (order.customer_phone ? String(order.customer_phone).replace(/(\d{3})\d+(\d{4})/, '$1***$2') : '');

  const maskedName = isCustomerOwner
    ? order.customer_name
    : (order.customer_name
        ? (order.customer_name.slice(0, 1) + '***' + (order.customer_name.length > 2 ? order.customer_name.slice(-1) : ''))
        : 'Khách hàng');

  const maskedAddr = isCustomerOwner
    ? order.delivery_addr
    : (order.delivery_addr ? '*** (Đã ẩn địa chỉ)' : null);

  return {
    order_code: order.order_code,
    order_type: order.order_type,
    store_name: order.store_name,
    location_name: order.location_name,
    customer_name: maskedName,
    customer_phone: maskedPhone,
    delivery_addr: maskedAddr,
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    total: order.total,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    payment_expires_at: order.payment_expires_at,
    created_at: order.created_at,
    current_status: order.current_status,
    items,
    status_history: history,
  };
}
