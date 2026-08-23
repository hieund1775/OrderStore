import { OrderValidationError } from '../services/orders/order-errors.js';
import { VALID_ORDER_TYPES, VALID_PAYMENT_METHODS, VALID_SOURCES } from '../services/public-dto.js';
import { VALID_STATUSES } from '../services/order-transition-policy.js';
import { normalizeAndValidatePhone, normalizeAndValidateFullName } from './customer-schemas.js';

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new OrderValidationError(`${field} phải là số nguyên dương`, 'ORDER_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new OrderValidationError(`${field} phải là số nguyên dương`, 'ORDER_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 500) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new OrderValidationError(`${field} không hợp lệ`, 'ORDER_INVALID_TEXT');
  }
  return value.trim();
}

export function validateOrderId(value) {
  return positiveInteger(value, 'ID đơn hàng');
}

// Public cancellation accepts either the numeric database ID or the existing
// human-readable order code (for example TP-11). Keep both forms compatible.
export function validateOrderReference(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new OrderValidationError('Mã đơn hàng không hợp lệ', 'ORDER_INVALID_IDENTIFIER');
  }
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9-]{1,100}$/.test(normalized)) {
    throw new OrderValidationError('Mã đơn hàng không hợp lệ', 'ORDER_INVALID_IDENTIFIER');
  }
  return normalized;
}

export function validateStoreId(value, { required = true } = {}) {
  return positiveInteger(value, 'store_id', { required });
}

export function validateTableId(value, { required = false } = {}) {
  return positiveInteger(value, 'table_id', { required });
}

export function validateOrderFilters({ status, store_id, table_id, search } = {}) {
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw new OrderValidationError('Trạng thái không hợp lệ', 'ORDER_INVALID_STATUS');
  }
  if (search !== undefined && (typeof search !== 'string' || search.length > 200)) {
    throw new OrderValidationError('Từ khóa tìm kiếm không hợp lệ', 'ORDER_INVALID_FILTER');
  }
  return {
    status: status?.trim() || undefined,
    storeId: validateStoreId(store_id, { required: false }),
    tableId: validateTableId(table_id, { required: false }),
  };
}

export function validateOrderMutationInput({ status, note, reason } = {}) {
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw new OrderValidationError('Trạng thái không hợp lệ', 'ORDER_INVALID_STATUS');
  }
  return {
    status,
    note: boundedText(note, 'Ghi chú'),
    reason: boundedText(reason, 'Lý do hủy'),
  };
}

export function validateOrderStatus(status, allowedStatuses) {
  if (!allowedStatuses.includes(status)) {
    // This exact message is already a public contract.
    throw new OrderValidationError('Trạng thái không hợp lệ', 'ORDER_INVALID_STATUS');
  }
  return status;
}

export function validateCreateOrderInput(body = {}) {
  const source = body.source === undefined ? 'online' : body.source;
  const orderType = body.order_type === undefined ? 'Take-away' : body.order_type;
  const paymentMethod = body.payment_method === undefined ? 'VietQR' : body.payment_method;

  if (!VALID_SOURCES.includes(source) || !VALID_ORDER_TYPES.includes(orderType) || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new OrderValidationError('Thông tin đơn hàng không hợp lệ', 'ORDER_INVALID_ENUM');
  }

  const storeId = validateStoreId(body.store_id);
  const tableId = validateTableId(body.table_id);
  const customerName = boundedText(body.customer_name, 'Tên khách hàng', 200);
  const customerPhone = boundedText(body.customer_phone, 'SĐT', 50);
  const note = boundedText(body.note, 'Ghi chú');
  const deliveryAddress = boundedText(body.delivery_addr, 'Địa chỉ giao hàng', 500);

  const isPosOrder = orderType === 'POS' || source === 'pos';

  if (!isPosOrder && (!customerName || !customerPhone)) {
    throw new OrderValidationError('Thiếu thông tin đơn hàng bắt buộc (tên, SĐT, danh sách món)', 'ORDER_REQUIRED_FIELDS');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new OrderValidationError('Danh sách món không được để trống', 'ORDER_REQUIRED_FIELDS');
  }
  if (orderType === 'Delivery' && !deliveryAddress) {
    throw new OrderValidationError('Đơn hàng Giao tận nơi bắt buộc phải nhập địa chỉ giao hàng', 'ORDER_DELIVERY_ADDRESS_REQUIRED');
  }

  let validPhone;
  if (isPosOrder) {
    if (!customerPhone || customerPhone.trim() === '0000000000') {
      validPhone = '0000000000';
    } else {
      try {
        validPhone = normalizeAndValidatePhone(customerPhone, { required: false });
      } catch {
        validPhone = customerPhone.trim();
      }
    }
  } else {
    try {
      validPhone = normalizeAndValidatePhone(customerPhone);
    } catch (err) {
      throw new OrderValidationError(err.message, 'ORDER_INVALID_PHONE');
    }
  }

  let validName;
  if (isPosOrder) {
    validName = customerName?.trim() || 'Khách Tại Quầy';
  } else {
    try {
      validName = normalizeAndValidateFullName(customerName);
    } catch (err) {
      throw new OrderValidationError(err.message, 'ORDER_INVALID_NAME');
    }
  }

  return {
    storeId,
    tableId,
    source,
    orderType,
    paymentMethod,
    note,
    deliveryAddress,
    customerName: validName,
    customerPhone: validPhone,
  };
}
