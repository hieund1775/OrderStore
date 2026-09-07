/**
 * Product Review validation schemas.
 */

/**
 * Validate review creation input.
 */
export function validateCreateReview(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Dữ liệu không hợp lệ'] };
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('Điểm đánh giá phải là số nguyên từ 1 đến 5');
  }

  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') {
      errors.push('Nhận xét phải là chuỗi ký tự');
    } else if (body.comment.length > 2000) {
      errors.push('Nhận xét không được vượt quá 2000 ký tự');
    }
  }

  if (body.intent_ids !== undefined) {
    if (!Array.isArray(body.intent_ids)) {
      errors.push('intent_ids phải là mảng');
    } else if (body.intent_ids.length > 2) {
      errors.push('Tối đa 2 file media cho mỗi đánh giá');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate review edit input.
 */
export function validateEditReview(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Dữ liệu không hợp lệ'] };
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('Điểm đánh giá phải là số nguyên từ 1 đến 5');
  }

  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') {
      errors.push('Nhận xét phải là chuỗi ký tự');
    } else if (body.comment.length > 2000) {
      errors.push('Nhận xét không được vượt quá 2000 ký tự');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate upload intent input.
 */
export function validateUploadIntent(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Dữ liệu không hợp lệ'] };
  }

  const validActions = ['create_original', 'edit_revision'];
  if (!validActions.includes(body.action)) {
    errors.push('Hành động không hợp lệ');
  }

  if (!['image', 'video'].includes(body.media_type)) {
    errors.push('Loại media không hợp lệ (chấp nhận image, video)');
  }

  if (!body.content_type || typeof body.content_type !== 'string') {
    errors.push('Content-Type không hợp lệ');
  }

  const byteSize = Number(body.byte_size);
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    errors.push('Kích thước file không hợp lệ');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate admin reply input.
 */
export function validateAdminReply(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Dữ liệu không hợp lệ'] };
  }

  if (!body.body || typeof body.body !== 'string' || !body.body.trim()) {
    errors.push('Nội dung phản hồi không được để trống');
  } else if (body.body.length > 2000) {
    errors.push('Nội dung phản hồi không được vượt quá 2000 ký tự');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate visibility change input.
 */
export function validateVisibilityChange(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Dữ liệu không hợp lệ'] };
  }

  if (!['visible', 'hidden'].includes(body.visibility)) {
    errors.push('Trạng thái hiển thị không hợp lệ (chấp nhận visible, hidden)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate public review list query params.
 */
export function validateReviewListQuery(query) {
  const errors = [];
  const validSorts = ['newest', 'rating_desc', 'rating_asc'];

  if (query.sort && !validSorts.includes(query.sort)) {
    errors.push(`Sắp xếp không hợp lệ. Cho phép: ${validSorts.join(', ')}`);
  }

  if (query.rating) {
    const r = Number(query.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      errors.push('Lọc theo điểm phải từ 1 đến 5');
    }
  }

  if (query.has_media && !['image', 'video'].includes(query.has_media)) {
    errors.push('has_media không hợp lệ');
  }

  if (query.limit) {
    const limit = Number(query.limit);
    if (limit < 1 || limit > 50) {
      errors.push('Giới hạn phải từ 1 đến 50');
    }
  }

  return { valid: errors.length === 0, errors };
}