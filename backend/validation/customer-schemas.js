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

export function normalizeAndValidatePhone(rawPhone, { required = true } = {}) {
  if (rawPhone === undefined || rawPhone === null || rawPhone === '') {
    if (required) throw new CustomerValidationError('Số điện thoại không được để trống', 'CUSTOMER_INVALID_PHONE');
    return null;
  }
  let str = String(rawPhone).trim().replace(/[\s\(\)\.-]/g, '');
  // Chuẩn hóa đầu số Việt Nam
  if (str.startsWith('+84') && str.length === 12) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('84') && str.length === 11) {
    str = '0' + str.slice(2);
  }

  const isVnPhone = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(str);
  const isInternationalPhone = /^\+[1-9][0-9]{7,14}$/.test(str);

  if (!isVnPhone && !isInternationalPhone) {
    throw new CustomerValidationError('Số điện thoại không hợp lệ (yêu cầu 10 chữ số Việt Nam hoặc chuẩn quốc tế có mã vùng +)', 'CUSTOMER_INVALID_PHONE');
  }

  return str;
}

export function normalizeAndValidateFullName(rawName, { required = true } = {}) {
  if (rawName === undefined || rawName === null || rawName === '') {
    if (required) throw new CustomerValidationError('Họ và tên không được để trống', 'CUSTOMER_INVALID_NAME');
    return null;
  }
  const clean = String(rawName).trim().replace(/\s+/g, ' ');
  const vnNameRegex = /^([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*)(\s([A-Z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9][a-z\u00C0-\u00FF\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]*))+$/;

  if (clean.length < 2 || clean.length > 120 || !vnNameRegex.test(clean)) {
    throw new CustomerValidationError('Họ và tên không hợp lệ (tối thiểu 2 từ, viết hoa chữ cái đầu và không chứa ký tự đặc biệt/số)', 'CUSTOMER_INVALID_NAME');
  }
  return clean;
}

export function validateCustomerRegisterInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CustomerValidationError('Dữ liệu đăng ký không hợp lệ');
  }
  const phone = normalizeAndValidatePhone(body.phone);
  const fullname = normalizeAndValidateFullName(body.fullname);
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new CustomerValidationError('Mật khẩu phải dài từ 8 đến 128 ký tự', 'CUSTOMER_INVALID_PASSWORD');
  }
  return { phone, fullname, password };
}

export function validateCustomerId(value) {
  return positiveInteger(value, 'ID khách hàng');
}

export function validateWishlistProductId(value) {
  return positiveInteger(value, 'ID sản phẩm');
}

export function validateCustomerNotificationInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new CustomerValidationError('Dữ liệu thông báo không hợp lệ');
  }
  const { user_id, type, title, body: contentBody, link } = body;
  const normalizedTitle = title ? String(title).trim() : '';
  const normalizedBody = contentBody ? String(contentBody).trim() : null;
  const normalizedLink = link ? String(link).trim() : null;
  if (!normalizedTitle) {
    throw new CustomerValidationError('Tiêu đề thông báo không được để trống');
  }
  if (normalizedTitle.length > 300) throw new CustomerValidationError('Tiêu đề thông báo không được vượt quá 300 ký tự');
  if (normalizedBody && normalizedBody.length > 5000) throw new CustomerValidationError('Nội dung thông báo không được vượt quá 5000 ký tự');
  if (normalizedLink && normalizedLink.length > 500) throw new CustomerValidationError('Đường dẫn thông báo không được vượt quá 500 ký tự');
  return {
    user_id: positiveInteger(user_id, 'user_id'),
    type: type ? String(type).trim() : 'system',
    title: normalizedTitle,
    body: normalizedBody,
    link: normalizedLink,
  };
}
