import { normalizeAndValidatePhone, normalizeAndValidateFullName } from './customer-schemas.js';

export class RecruitmentValidationError extends Error {
  constructor(message, code = 'RECRUITMENT_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'RecruitmentValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new RecruitmentValidationError(`${field} phải là số nguyên dương`, 'RECRUITMENT_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new RecruitmentValidationError(`${field} phải là số nguyên dương`, 'RECRUITMENT_INVALID_IDENTIFIER');
  }
  return numericValue;
}

function boundedText(value, field, maxLength = 255, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new RecruitmentValidationError(`${field} không được để trống`, 'RECRUITMENT_REQUIRED_FIELD');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new RecruitmentValidationError(`${field} không hợp lệ hoặc vượt quá ${maxLength} ký tự`, 'RECRUITMENT_INVALID_TEXT');
  }
  return value.trim();
}

export function validateJobId(value) {
  return positiveInteger(value, 'ID công việc');
}

export function validateApplicationId(value) {
  return positiveInteger(value, 'ID hồ sơ ứng tuyển');
}

export function validateJobInput(body = {}, { isUpdate = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new RecruitmentValidationError('Dữ liệu công việc không hợp lệ');
  }
  const { title, type, salary, description, requirements, benefits, is_active, store_ids } = body;

  if (!isUpdate || title !== undefined) boundedText(title, 'Tiêu đề công việc', 200, { required: !isUpdate });
  if (!isUpdate || type !== undefined) boundedText(type, 'Hình thức làm việc', 100, { required: !isUpdate });
  if (!isUpdate || salary !== undefined) boundedText(salary, 'Mức lương', 150, { required: !isUpdate });
  if (!isUpdate || description !== undefined) boundedText(description, 'Mô tả công việc', 2000, { required: !isUpdate });
  if (!isUpdate || requirements !== undefined) boundedText(requirements, 'Yêu cầu công việc', 2000, { required: !isUpdate });

  return {
    title: title ? title.trim() : undefined,
    type: type ? type.trim() : undefined,
    salary: salary ? salary.trim() : undefined,
    description: description ? description.trim() : undefined,
    requirements: requirements ? requirements.trim() : undefined,
    benefits: benefits ? benefits.trim() : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    store_ids: Array.isArray(store_ids) ? store_ids.map(Number) : undefined,
  };
}

export function validateJobApplyInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new RecruitmentValidationError('Dữ liệu nộp hồ sơ không hợp lệ');
  }
  const { fullname, phone, email, store_id, cv_url } = body;

  const validName = normalizeAndValidateFullName(fullname, { required: true });
  const validPhone = normalizeAndValidatePhone(phone, { required: true });

  const emailStr = String(email || '').trim();
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    throw new RecruitmentValidationError('Email không đúng định dạng', 'RECRUITMENT_INVALID_EMAIL');
  }

  const normalizedStoreId = store_id != null && store_id !== '' ? Number(store_id) : null;
  if (normalizedStoreId != null && (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0)) {
    throw new RecruitmentValidationError('store_id phải là số nguyên dương', 'RECRUITMENT_INVALID_IDENTIFIER');
  }

  const normalizedCvUrl = cv_url ? String(cv_url).trim() : null;
  if (normalizedCvUrl && (normalizedCvUrl.length > 500 || !/^https?:\/\/\S+$/i.test(normalizedCvUrl))) {
    throw new RecruitmentValidationError('Link CV không hợp lệ', 'RECRUITMENT_INVALID_CV_URL');
  }

  return {
    fullname: validName,
    phone: validPhone,
    email: emailStr,
    store_id: normalizedStoreId,
    cv_url: normalizedCvUrl,
  };
}

export function validateApplicationStatusInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new RecruitmentValidationError('Dữ liệu trạng thái hồ sơ không hợp lệ');
  }
  const { status, note } = body;
  const validStatuses = ['Mới', 'Đang xem xét', 'Phỏng vấn', 'Trúng tuyển', 'Từ chối'];
  if (!status || !validStatuses.includes(status)) {
    throw new RecruitmentValidationError(`Trạng thái không hợp lệ (cho phép: ${validStatuses.join(', ')})`, 'RECRUITMENT_INVALID_STATUS');
  }
  return {
    status,
    note: note !== undefined ? String(note).trim() : undefined,
  };
}
