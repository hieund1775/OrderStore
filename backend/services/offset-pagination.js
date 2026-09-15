/**
 * Production Offset-Based Pagination Service
 *
 * Implements server-side page/limit validation, upper-bound clamping,
 * and stable pagination metadata for display lists.
 */

export class PaginationValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PaginationValidationError';
    this.status = status;
  }
}

/**
 * Validates requested page number (positive integer >= 1).
 */
export function validatePage(requestedPage, defaultPage = 1) {
  if (requestedPage === undefined || requestedPage === null || requestedPage === '') {
    return defaultPage;
  }

  const pageNum = Number(requestedPage);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    throw new PaginationValidationError('Số trang (page) phải là số nguyên dương >= 1.', 400);
  }

  return pageNum;
}

/**
 * Validates and clamps requested limit (1 <= limit <= maxLimit).
 */
export function validateLimit(requestedLimit, defaultLimit = 5, maxLimit = 50) {
  if (requestedLimit === undefined || requestedLimit === null || requestedLimit === '') {
    return defaultLimit;
  }

  const limitNum = Number(requestedLimit);
  if (!Number.isInteger(limitNum) || limitNum < 1) {
    throw new PaginationValidationError('Giới hạn số lượng (limit) phải là số nguyên dương.', 400);
  }

  return Math.min(limitNum, maxLimit);
}

/**
 * Checks if query explicitly requests offset pagination.
 */
export function isPaginationRequested(query = {}) {
  return query.page !== undefined || query.limit !== undefined;
}

/**
 * Calculates pagination metadata.
 */
export function buildOffsetPagination({ totalItems, page, limit }) {
  const total = Math.max(0, Number(totalItems) || 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    totalItems: total,
    totalPages,
  };
}
