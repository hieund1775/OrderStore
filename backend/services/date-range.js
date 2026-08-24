/**
 * Production Date Range Service for Sargable SQL Queries
 *
 * Converts date strings (YYYY-MM-DD) into half-open intervals [startInclusive, endExclusive)
 * in UTC corresponding to Vietnam calendar boundaries (Asia/Ho_Chi_Minh / UTC+7).
 */

import {
  isValidDateString as validDateString,
  parseVietnamSingleDateBoundary,
  parseVietnamDateRange,
  formatVietnamBusinessDate,
} from './business-time.js';

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
  return validDateString(dateStr);
}

/**
 * Parses a single date (YYYY-MM-DD) into [startInclusive, endExclusive) in UTC.
 * Example: '2026-08-25' in Vietnam -> start: 2026-08-24T17:00:00.000Z, end: 2026-08-25T17:00:00.000Z
 */
export function parseSingleDateBoundary(dateStr) {
  try {
    const boundary = parseVietnamSingleDateBoundary(dateStr);
    return {
      start: boundary.start,
      end: boundary.end,
      startDate: boundary.startDate,
      endDate: boundary.endDate,
    };
  } catch (err) {
    throw new DateValidationError(err.message, err.status || 400);
  }
}

/**
 * Parses date range [fromStr, toStr] into [startInclusive, endExclusive) in UTC.
 */
export function parseDateRangeBoundaries(fromStr, toStr, maxRangeDays = 365) {
  try {
    const range = parseVietnamDateRange(fromStr, toStr, maxRangeDays);
    return {
      start: range.start,
      end: range.end,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  } catch (err) {
    throw new DateValidationError(err.message, err.status || 400);
  }
}

/**
 * Gets start and end boundaries for today in Vietnam timezone (Asia/Ho_Chi_Minh).
 */
export function getTodayBoundaries(instant = new Date()) {
  const todayStr = formatVietnamBusinessDate(instant);
  return parseSingleDateBoundary(todayStr);
}
