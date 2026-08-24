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

function dateOnly(value, field, { required = false, nullable = false } = {}) {
  if (value === undefined) {
    if (required) throw new PromotionValidationError(`${field} không được để trống`, 'PROMOTION_REQUIRED_FIELD');
    return undefined;
  }
  if (value === null || value === '') {
    if (nullable) return null;
    throw new PromotionValidationError(`${field} không hợp lệ`, 'PROMOTION_INVALID_DATES');
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PromotionValidationError(`${field} không hợp lệ`, 'PROMOTION_INVALID_DATES');
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new PromotionValidationError(`${field} không hợp lệ`, 'PROMOTION_INVALID_DATES');
  }
  return value;
}

export function validatePromotionId(value) {
  return positiveInteger(value, 'ID khuyến mãi');
}

export function validatePromotionInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new PromotionValidationError('Dữ liệu khuyến mãi không hợp lệ');
  }
  const { title, description, code, discount_type, discount_value, min_order, max_discount, start_date, end_date, is_active, store_id, rule, voucher_type, usage_limit, store_ids } = body;

  if (!isUpdate || title !== undefined) boundedText(title, 'Tiêu đề khuyến mãi', 150, { required: !isUpdate });
  if (!isUpdate || code !== undefined) boundedText(code, 'Mã khuyến mãi', 50, { required: !isUpdate });

  if (discount_type !== undefined && !['percent', 'fixed'].includes(discount_type)) {
    throw new PromotionValidationError('Loại giảm giá phải là percent hoặc fixed');
  }

  if (voucher_type !== undefined && !['single_use', 'shared'].includes(voucher_type)) {
    throw new PromotionValidationError('Loại voucher phải là single_use hoặc shared');
  }

  const finalStartDate = dateOnly(start_date, 'Ngày bắt đầu', { required: !isUpdate });
  const finalEndDate = dateOnly(end_date, 'Ngày kết thúc', { nullable: true });
  if (finalStartDate && finalEndDate && finalEndDate < finalStartDate) {
    throw new PromotionValidationError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu', 'PROMOTION_INVALID_DATES');
  }

  let finalUsageLimit = usage_limit !== undefined && usage_limit !== '' && usage_limit !== null
    ? positiveInteger(usage_limit, 'Giới hạn lượt dùng', { required: false })
    : (usage_limit === null || usage_limit === '' ? null : undefined);

  if (voucher_type === 'single_use') {
    finalUsageLimit = null;
  }

  return {
    title: title ? title.trim() : undefined,
    description: description ? description.trim() : undefined,
    code: code ? code.trim().toUpperCase() : undefined,
    discount_type: discount_type || undefined,
    discount_value: discount_value !== undefined && discount_value !== '' ? Number(discount_value) : undefined,
    min_order: min_order !== undefined && min_order !== '' ? Number(min_order) : undefined,
    max_discount: max_discount !== undefined && max_discount !== '' ? Number(max_discount) : undefined,
    voucher_type: voucher_type || undefined,
    usage_limit: finalUsageLimit,
    start_date: finalStartDate,
    end_date: finalEndDate,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    store_id: store_id != null ? Number(store_id) : undefined,
    store_ids: Array.isArray(store_ids) ? store_ids.map(Number) : undefined,
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
