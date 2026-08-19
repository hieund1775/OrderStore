export class PromotionValidationError extends Error {
  constructor(message, code = 'PROMOTION_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'PromotionValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new PromotionValidationError(`${field} phải là số nguyên dương`, 'PROMOTION_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new PromotionValidationError(`${field} phải là số nguyên dương`, 'PROMOTION_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 255, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new PromotionValidationError(`${field} không được để trống`, 'PROMOTION_REQUIRED_FIELD');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new PromotionValidationError(`${field} không hợp lệ hoặc vượt quá ${maxLength} ký tự`, 'PROMOTION_INVALID_TEXT');
  }
  return value.trim();
}

export function validatePromotionId(value) {
  return positiveInteger(value, 'ID khuyến mãi');
}

export function validatePromotionInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new PromotionValidationError('Dữ liệu khuyến mãi không hợp lệ');
  }
  const { title, description, code, discount_type, discount_value, min_order, max_discount, start_date, end_date, is_active, store_id, rule } = body;

  if (!isUpdate || title !== undefined) boundedText(title, 'Tiêu đề khuyến mãi', 150, { required: !isUpdate });
  if (!isUpdate || code !== undefined) boundedText(code, 'Mã khuyến mãi', 50, { required: !isUpdate });

  if (discount_type !== undefined && !['percent', 'fixed'].includes(discount_type)) {
    throw new PromotionValidationError('Loại giảm giá phải là percent hoặc fixed');
  }

  return {
    title: title ? title.trim() : undefined,
    description: description ? description.trim() : undefined,
    code: code ? code.trim().toUpperCase() : undefined,
    discount_type: discount_type || undefined,
    discount_value: discount_value !== undefined ? Number(discount_value) : undefined,
    min_order: min_order !== undefined ? Number(min_order) : undefined,
    max_discount: max_discount !== undefined ? Number(max_discount) : undefined,
    start_date: start_date || undefined,
    end_date: end_date || undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    store_id: store_id != null ? Number(store_id) : undefined,
    rule: rule ? (typeof rule === 'object' ? JSON.stringify(rule) : String(rule).trim()) : undefined,
  };
}

export function validateVoucherApplyInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new PromotionValidationError('Dữ liệu áp dụng mã không hợp lệ');
  }
  const { code, subtotal, customer_phone, store_id } = body;
  if (!code || !String(code).trim()) {
    throw new PromotionValidationError('Thiếu mã voucher');
  }
  return {
    code: String(code).trim().toUpperCase(),
    subtotal: Number(subtotal) || 0,
    phone: customer_phone ? String(customer_phone).trim() : '',
    storeId: store_id ? Number(store_id) : undefined,
  };
}
