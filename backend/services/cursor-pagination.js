/**
 * Production Cursor-Based Pagination Service
 *
 * Implements deterministic keyset pagination using composite order (created_at DESC, id DESC).
 * Prevents phantom row duplicates and missed rows when new records are inserted during traversal.
 */

export class CursorValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CursorValidationError';
    this.status = status;
  }
}

/**
 * Encodes created_at (Date/ISO) and id into an opaque Base64 cursor string.
 */
export function encodeCursor({ createdAt, id }) {
  if (!createdAt || !id) return null;
  const isoStr = createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
  const payload = JSON.stringify({ v: 1, c: isoStr, id: Number(id) });
  return Buffer.from(payload, 'utf-8').toString('base64url');
}

/**
 * Decodes and validates an opaque Base64 cursor string.
 * Returns { createdAt: Date, id: number } or throws CursorValidationError.
 */
export function decodeCursor(cursorStr) {
  if (!cursorStr || typeof cursorStr !== 'string') return null;

  try {
    const raw = Buffer.from(cursorStr.trim(), 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || !parsed.c || !parsed.id) {
      throw new Error('Missing cursor fields');
    }

    const date = new Date(parsed.c);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid cursor timestamp');
    }

    const id = Number(parsed.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Invalid cursor record ID');
    }

    return {
      createdAt: date,
      createdAtIso: date.toISOString(),
      id,
    };
  } catch (err) {
    throw new CursorValidationError(`Mã con trỏ phân trang (cursor) không hợp lệ: "${cursorStr}"`, 400);
  }
}

/**
 * Validates requested limit (default 50, maximum 100).
 */
export function validatePaginationLimit(requestedLimit, defaultLimit = 50, maxLimit = 100) {
  if (requestedLimit === undefined || requestedLimit === null || requestedLimit === '') {
    return defaultLimit;
  }

  const limitNum = Number(requestedLimit);
  if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > maxLimit) {
    throw new CursorValidationError(
      `Giới hạn số lượng (limit) phải là số nguyên từ 1 đến ${maxLimit}.`,
      400
    );
  }

  return limitNum;
}

/**
 * Builds cursor pagination metadata and slices excess peek row.
 */
export function buildPageInfo({ rows = [], limit = 50, getCursorFields = (r) => ({ createdAt: r.created_at, id: r.id }) } = {}) {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor = null;
  if (hasMore && pageRows.length > 0) {
    const lastRow = pageRows[pageRows.length - 1];
    const fields = getCursorFields(lastRow);
    nextCursor = encodeCursor(fields);
  }

  return {
    rows: pageRows,
    page_info: {
      next_cursor: nextCursor,
      has_more: hasMore,
      limit,
    },
  };
}
