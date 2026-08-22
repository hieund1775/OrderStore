import { normalizeAndValidatePhone, normalizeAndValidateFullName } from './customer-schemas.js';

export class EngagementValidationError extends Error {
  constructor(message, code = 'ENGAGEMENT_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'EngagementValidationError';
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function positiveInteger(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new EngagementValidationError(`${field} phải là số nguyên dương`, 'ENGAGEMENT_INVALID_IDENTIFIER');
    return null;
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new EngagementValidationError(`${field} phải là số nguyên dương`, 'ENGAGEMENT_INVALID_IDENTIFIER');
  }
  return numericValue;
}

export function validateReviewInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new EngagementValidationError('Dữ liệu đánh giá không hợp lệ');
  }
  const { rating, comment, order_item_id, image_urls } = body;
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    throw new EngagementValidationError('Điểm đánh giá phải là số nguyên từ 1 đến 5');
  }
  return {
    rating: numRating,
    comment: comment ? String(comment).trim() : null,
    order_item_id: order_item_id ? positiveInteger(order_item_id, 'order_item_id', { required: false }) : null,
    image_urls: Array.isArray(image_urls) ? image_urls : null,
  };
}

export function validateJobApplyInput(body = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new EngagementValidationError('Dữ liệu ứng tuyển không hợp lệ');
  }
  const { fullname, phone, email, store_id, cv_url } = body;
  const validName = normalizeAndValidateFullName(fullname, { required: true });
  const validPhone = normalizeAndValidatePhone(phone, { required: true });

  const emailStr = String(email || '').trim();
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    throw new EngagementValidationError('Email không đúng định dạng');
  }

  return {
    fullname: validName,
    phone: validPhone,
    email: emailStr,
    store_id: store_id ? positiveInteger(store_id, 'store_id', { required: false }) : null,
    cv_url: cv_url ? String(cv_url).trim() : null,
  };
}
