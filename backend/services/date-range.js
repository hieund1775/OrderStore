/**
 * Production Date Range Service for Sargable SQL Queries
 *
 * Converts date strings (YYYY-MM-DD) into half-open intervals [startInclusive, endExclusive)
 * to allow SQL Server to utilize B-Tree indexes via Seek operations instead of full table scans.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class DateValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'DateValidationError';
    this.status = status;
  }
}

/**
 * Validates a YYYY-MM-DD string and ensures valid calendar date.
 */
export function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!DATE_REGEX.test(dateStr.trim())) return false;

  const [yearStr, monthStr, dayStr] = dateStr.trim().split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  // Days in month validation including leap year
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Parses a single date (YYYY-MM-DD) into [startInclusive, endExclusive)
 * Example: '2026-08-17' -> { start: '2026-08-17 00:00:00.000', end: '2026-08-18 00:00:00.000' }
 */
export function parseSingleDateBoundary(dateStr) {
  if (!isValidDateString(dateStr)) {
    throw new DateValidationError(`Ngày không hợp lệ: "${dateStr}". Định dạng đúng là YYYY-MM-DD.`, 400);
  }

  const [year, month, day] = dateStr.trim().split('-').map((v) => parseInt(v, 10));
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  return {
    start: startDate.toISOString().replace('T', ' ').replace('Z', ''),
    end: endDate.toISOString().replace('T', ' ').replace('Z', ''),
    startDate,
    endDate,
  };
}

/**
 * Parses date range [fromStr, toStr] into [startInclusive, endExclusive)
 * Example: from '2026-08-01' to '2026-08-15' -> start: 2026-08-01 00:00, end: 2026-08-16 00:00
 */
export function parseDateRangeBoundaries(fromStr, toStr) {
  if (!isValidDateString(fromStr)) {
    throw new DateValidationError(`Ngày bắt đầu (from) không hợp lệ: "${fromStr}".`, 400);
  }
  if (!isValidDateString(toStr)) {
    throw new DateValidationError(`Ngày kết thúc (to) không hợp lệ: "${toStr}".`, 400);
  }

  const [fromY, fromM, fromD] = fromStr.trim().split('-').map((v) => parseInt(v, 10));
  const [toY, toM, toD] = toStr.trim().split('-').map((v) => parseInt(v, 10));

  const startDate = new Date(Date.UTC(fromY, fromM - 1, fromD, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(toY, toM - 1, toD + 1, 0, 0, 0, 0));

  if (startDate.getTime() >= endDate.getTime()) {
    throw new DateValidationError(`Khoảng ngày không hợp lệ: Ngày bắt đầu (${fromStr}) phải nhỏ hơn hoặc bằng ngày kết thúc (${toStr}).`, 400);
  }

  // Cap maximum range to 365 days to prevent resource exhaustion
  const diffDays = (endDate.getTime() - startDate.getTime()) / 86400000;
  if (diffDays > 366) {
    throw new DateValidationError('Khoảng thời gian tra cứu không được vượt quá 365 ngày.', 400);
  }

  return {
    start: startDate.toISOString().replace('T', ' ').replace('Z', ''),
    end: endDate.toISOString().replace('T', ' ').replace('Z', ''),
    startDate,
    endDate,
  };
}

/**
 * Gets start and end boundaries for today in local Vietnam time (UTC+7)
 */
export function getTodayBoundaries() {
  const now = new Date();
  const vnOffset = 7 * 60; // minutes
  const vnTime = new Date(now.getTime() + (now.getTimezoneOffset() + vnOffset) * 60000);

  const y = vnTime.getFullYear();
  const m = String(vnTime.getMonth() + 1).padStart(2, '0');
  const d = String(vnTime.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  return parseSingleDateBoundary(todayStr);
}
