import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidDateString,
  parseSingleDateBoundary,
  parseDateRangeBoundaries,
  getTodayBoundaries,
  DateValidationError,
} from '../services/date-range.js';

describe('Date Range & Sargable Query Service (Production Module)', () => {
  it('validates YYYY-MM-DD date strings strictly including leap year check', () => {
    assert.equal(isValidDateString('2026-08-17'), true);
    assert.equal(isValidDateString('2024-02-29'), true); // 2024 is leap year
    assert.equal(isValidDateString('2025-02-29'), false); // 2025 is NOT leap year
    assert.equal(isValidDateString('2026-04-31'), false); // April has 30 days
    assert.equal(isValidDateString('2026-13-01'), false); // Month 13 invalid
    assert.equal(isValidDateString('invalid-date'), false);
    assert.equal(isValidDateString(null), false);
    assert.equal(isValidDateString(''), false);
  });

  it('converts single date into Vietnam half-open UTC interval [startInclusive, endExclusive)', () => {
    const b = parseSingleDateBoundary('2026-08-17');
    // Vietnam 2026-08-17 00:00:00+07 = UTC 2026-08-16 17:00:00.000Z
    assert.equal(b.start, '2026-08-16T17:00:00.000Z');
    // Vietnam 2026-08-17 24:00:00+07 = UTC 2026-08-17 17:00:00.000Z
    assert.equal(b.end, '2026-08-17T17:00:00.000Z');
  });

  it('converts year-end boundary correctly into the next year in Vietnam timezone', () => {
    const b = parseSingleDateBoundary('2026-12-31');
    assert.equal(b.start, '2026-12-30T17:00:00.000Z');
    assert.equal(b.end, '2026-12-31T17:00:00.000Z');
  });

  it('converts date range into correct multi-day Vietnam boundary [start, endExclusive)', () => {
    const b = parseDateRangeBoundaries('2026-08-01', '2026-08-15');
    assert.equal(b.start, '2026-07-31T17:00:00.000Z');
    assert.equal(b.end, '2026-08-15T17:00:00.000Z');
  });

  it('rejects date range when from > to', () => {
    assert.throws(
      () => parseDateRangeBoundaries('2026-08-20', '2026-08-10'),
      (err) => err instanceof DateValidationError && err.status === 400
    );
  });

  it('rejects date range exceeding 365 days', () => {
    assert.throws(
      () => parseDateRangeBoundaries('2024-01-01', '2026-01-01'),
      (err) => err instanceof DateValidationError && err.status === 400
    );
  });

  it('generates valid today boundaries in Vietnam timezone', () => {
    const today = getTodayBoundaries();
    assert.ok(today.start);
    assert.ok(today.end);
    assert.ok(today.startDate < today.endDate);
  });
});
