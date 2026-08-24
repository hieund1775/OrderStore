import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVietnamCalendarParts,
  formatVietnamBusinessDate,
  formatVietnamOrderDatePrefix,
  isValidDateString,
  parseVietnamSingleDateBoundary,
  parseVietnamDateRange,
} from '../services/business-time.js';

describe('Vietnam Business Time Service', () => {
  it('correctly maps UTC instants to Vietnam calendar parts (Asia/Ho_Chi_Minh / UTC+7)', () => {
    // 00:05 AM on 25/08/2026 in Vietnam is 17:05 UTC on 24/08/2026
    const utcMidnightEarly = new Date('2026-08-24T17:05:00.000Z');
    const partsEarly = getVietnamCalendarParts(utcMidnightEarly);
    assert.equal(partsEarly.year, 2026);
    assert.equal(partsEarly.month, 8);
    assert.equal(partsEarly.day, 25);
    assert.equal(partsEarly.hour, 0);
    assert.equal(partsEarly.minute, 5);
    assert.equal(formatVietnamBusinessDate(utcMidnightEarly), '2026-08-25');
    assert.equal(formatVietnamOrderDatePrefix(utcMidnightEarly), '260825');

    // 14:30 PM on 25/08/2026 in Vietnam is 07:30 UTC on 25/08/2026
    const utcAfternoon = new Date('2026-08-25T07:30:00.000Z');
    const partsAfternoon = getVietnamCalendarParts(utcAfternoon);
    assert.equal(partsAfternoon.year, 2026);
    assert.equal(partsAfternoon.month, 8);
    assert.equal(partsAfternoon.day, 25);
    assert.equal(partsAfternoon.hour, 14);
    assert.equal(partsAfternoon.minute, 30);
    assert.equal(formatVietnamBusinessDate(utcAfternoon), '2026-08-25');
    assert.equal(formatVietnamOrderDatePrefix(utcAfternoon), '260825');

    // 23:59:59 PM on 25/08/2026 in Vietnam is 16:59:59 UTC on 25/08/2026
    const utcNight = new Date('2026-08-25T16:59:59.000Z');
    const partsNight = getVietnamCalendarParts(utcNight);
    assert.equal(partsNight.year, 2026);
    assert.equal(partsNight.month, 8);
    assert.equal(partsNight.day, 25);
    assert.equal(partsNight.hour, 23);
    assert.equal(partsNight.minute, 59);
    assert.equal(formatVietnamBusinessDate(utcNight), '2026-08-25');
    assert.equal(formatVietnamOrderDatePrefix(utcNight), '260825');

    // 00:00:00 AM on 26/08/2026 in Vietnam is 17:00:00 UTC on 25/08/2026
    const utcNextDay = new Date('2026-08-25T17:00:00.000Z');
    assert.equal(formatVietnamBusinessDate(utcNextDay), '2026-08-26');
    assert.equal(formatVietnamOrderDatePrefix(utcNextDay), '260826');
  });

  it('handles year rollover and leap day in Vietnam timezone', () => {
    // 2028 is leap year: 29/02/2028 10:00 in Vietnam is 03:00 UTC on 29/02/2028
    const leapDay = new Date('2028-02-29T03:00:00.000Z');
    assert.equal(formatVietnamBusinessDate(leapDay), '2028-02-29');
    assert.equal(formatVietnamOrderDatePrefix(leapDay), '280229');

    // New Year Eve rollover: 31/12/2026 23:30 in Vietnam is 16:30 UTC on 31/12/2026
    const nye = new Date('2026-12-31T16:30:00.000Z');
    assert.equal(formatVietnamBusinessDate(nye), '2026-12-31');
    assert.equal(formatVietnamOrderDatePrefix(nye), '261231');

    // New Year 00:30 on 01/01/2027 in Vietnam is 17:30 UTC on 31/12/2026
    const newYear = new Date('2026-12-31T17:30:00.000Z');
    assert.equal(formatVietnamBusinessDate(newYear), '2027-01-01');
    assert.equal(formatVietnamOrderDatePrefix(newYear), '270101');
  });

  it('validates date strings strictly', () => {
    assert.equal(isValidDateString('2026-08-25'), true);
    assert.equal(isValidDateString('2028-02-29'), true); // leap day valid
    assert.equal(isValidDateString('2026-02-29'), false); // non-leap year invalid
    assert.equal(isValidDateString('2026-02-30'), false);
    assert.equal(isValidDateString('2026-13-01'), false);
    assert.equal(isValidDateString('2026-08-32'), false);
    assert.equal(isValidDateString('invalid'), false);
    assert.equal(isValidDateString(''), false);
    assert.equal(isValidDateString(null), false);
  });

  it('rejects ambiguous unzoned backend instants instead of using the server timezone', () => {
    assert.throws(
      () => getVietnamCalendarParts('2026-08-25 00:05:00'),
      (err) => err instanceof TypeError,
    );
    assert.equal(
      formatVietnamBusinessDate('2026-08-24T17:05:00.000Z'),
      '2026-08-25',
    );
  });

  it('converts single Vietnam date to accurate UTC half-open boundary', () => {
    const boundary = parseVietnamSingleDateBoundary('2026-08-25');
    // Start of 25/08/2026 00:00:00+07 = 2026-08-24 17:00:00.000Z
    assert.equal(boundary.start, '2026-08-24T17:00:00.000Z');
    // End of 25/08/2026 24:00:00+07 = 2026-08-25 17:00:00.000Z
    assert.equal(boundary.end, '2026-08-25T17:00:00.000Z');
    assert.equal(boundary.endDate.getTime() - boundary.startDate.getTime(), 24 * 3600 * 1000);
  });

  it('converts Vietnam date range to accurate UTC half-open boundaries', () => {
    const range = parseVietnamDateRange('2026-08-20', '2026-08-25');
    assert.equal(range.start, '2026-08-19T17:00:00.000Z');
    assert.equal(range.end, '2026-08-25T17:00:00.000Z');
    assert.equal(range.days, 6);

    // Single day range
    const singleDayRange = parseVietnamDateRange('2026-08-25', '2026-08-25');
    assert.equal(singleDayRange.start, '2026-08-24T17:00:00.000Z');
    assert.equal(singleDayRange.end, '2026-08-25T17:00:00.000Z');
    assert.equal(singleDayRange.days, 1);

    // Invalid range from > to
    assert.throws(() => parseVietnamDateRange('2026-08-26', '2026-08-25'), (err) => {
      assert.equal(err.status, 400);
      return true;
    });

    // Exceeds max range days
    assert.throws(() => parseVietnamDateRange('2025-01-01', '2026-08-25', 100), (err) => {
      assert.equal(err.status, 400);
      return true;
    });
  });
});
