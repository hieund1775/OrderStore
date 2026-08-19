export class CustomerValidationError extends Error {
  constructor(message, code = 'CUSTOMER_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'CustomerValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CustomerValidationError(`${field} phải là số nguyên dương`, 'CUSTOMER_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new CustomerValidationError(`${field} phải là số nguyên dương`, 'CUSTOMER_INVALID_IDENTIFIER');
  }
  return numericValue;
}

export function validateCustomerId(value) {
  return positiveInteger(value, 'ID khách hàng');
}

export function validateCustomerNotificationInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CustomerValidationError('Dữ liệu thông báo không hợp lệ');
  }
  const { user_id, type, title, body: contentBody, link } = body;
  if (!title || !String(title).trim()) {
    throw new CustomerValidationError('Tiêu đề thông báo không được để trống');
  }
  return {
    user_id: user_id ? positiveInteger(user_id, 'user_id', { required: false }) : null,
    type: type ? String(type).trim() : 'general',
    title: String(title).trim(),
    body: contentBody ? String(contentBody).trim() : null,
    link: link ? String(link).trim() : null,
  };
}
