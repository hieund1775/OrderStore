/**
 * Production Business Time Service for Vietnam Timezone (Asia/Ho_Chi_Minh / UTC+7)
 *
 * Provides pure, deterministic functions to calculate business dates, order code prefixes,
 * and UTC half-open boundaries for PostgreSQL TIMESTAMPTZ queries.
 */

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formatterParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIETNAM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const EXPLICIT_ZONE_REGEX = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * Coerces date/instant input to a valid JavaScript Date object.
 * Returns null if input is invalid or missing.
 */
function coerceDate(input) {
  if (input == null) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s || !EXPLICIT_ZONE_REGEX.test(s)) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Returns Vietnam calendar parts { year, month, day, hour, minute, second } as numbers for an instant.
 */
export function getVietnamCalendarParts(instant = new Date()) {
  const d = coerceDate(instant);
  if (!d) {
    throw new TypeError('Invalid date/instant provided to getVietnamCalendarParts');
  }
  const parts = formatterParts.formatToParts(d);
  const find = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  return {
    year: find('year'),
    month: find('month'),
    day: find('day'),
    hour: find('hour'),
    minute: find('minute'),
    second: find('second'),
  };
}

/**
 * Formats an instant as Vietnam business date: "YYYY-MM-DD"
 */
export function formatVietnamBusinessDate(instant = new Date()) {
  const { year, month, day } = getVietnamCalendarParts(instant);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Formats an instant as Vietnam order date prefix: "YYMMDD" (e.g. "260825")
 */
export function formatVietnamOrderDatePrefix(instant = new Date()) {
  const { year, month, day } = getVietnamCalendarParts(instant);
  const yy = String(year).slice(2);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Validates a YYYY-MM-DD calendar date string strictly.
 */
export function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const s = dateStr.trim();
  if (!DATE_REGEX.test(s)) return false;

  const [yearStr, monthStr, dayStr] = s.split('-');
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

function calendarDateToUtcMs(year, month, day) {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime();
}

function timeZoneOffsetMs(instant) {
  const parts = getVietnamCalendarParts(instant);
  const displayedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const instantWithoutMilliseconds = Math.trunc(instant.getTime() / 1000) * 1000;
  return displayedAsUtc - instantWithoutMilliseconds;
}

/** Converts a Vietnam wall-clock midnight to its UTC instant using the IANA timezone rules. */
function vietnamMidnightToUtc(year, month, day) {
  const wallClockUtcMs = calendarDateToUtcMs(year, month, day);
  let candidateMs = wallClockUtcMs;

  // Resolve the zone offset at the candidate instant. A second pass handles
  // zones whose offset changes near the requested wall-clock time.
  for (let attempt = 0; attempt < 3; attempt++) {
    const nextCandidateMs = wallClockUtcMs - timeZoneOffsetMs(new Date(candidateMs));
    if (nextCandidateMs === candidateMs) break;
    candidateMs = nextCandidateMs;
  }

  return new Date(candidateMs);
}

/**
 * Converts a Vietnam calendar date (YYYY-MM-DD) into UTC half-open interval [startInclusive, endExclusive).
 * Example for '2026-08-25':
 * Vietnam 00:00:00+07 = UTC 2026-08-24 17:00:00.000Z
 * Vietnam 24:00:00+07 = UTC 2026-08-25 17:00:00.000Z
 */
export function parseVietnamSingleDateBoundary(dateStr) {
  if (!isValidDateString(dateStr)) {
    const err = new Error(`Ngày không hợp lệ: "${dateStr}". Định dạng đúng là YYYY-MM-DD.`);
    err.status = 400;
    err.name = 'DateValidationError';
    throw err;
  }

  const [year, month, day] = dateStr.trim().split('-').map((v) => parseInt(v, 10));
  const nextDate = new Date(calendarDateToUtcMs(year, month, day + 1));
  const startDate = vietnamMidnightToUtc(year, month, day);
  const endDate = vietnamMidnightToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
  );

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    startDate,
    endDate,
  };
}

/**
 * Parses a Vietnam date range [fromDate, toDate] into UTC half-open interval [startInclusive, endExclusive).
 */
export function parseVietnamDateRange(fromDate, toDate, maxRangeDays = 365) {
  if (!isValidDateString(fromDate)) {
    const err = new Error(`Ngày bắt đầu không hợp lệ: "${fromDate}". Định dạng đúng là YYYY-MM-DD.`);
    err.status = 400;
    err.name = 'DateValidationError';
    throw err;
  }
  if (!isValidDateString(toDate)) {
    const err = new Error(`Ngày kết thúc không hợp lệ: "${toDate}". Định dạng đúng là YYYY-MM-DD.`);
    err.status = 400;
    err.name = 'DateValidationError';
    throw err;
  }

  const startBoundary = parseVietnamSingleDateBoundary(fromDate);
  const endBoundary = parseVietnamSingleDateBoundary(toDate);

  if (startBoundary.startDate.getTime() >= endBoundary.endDate.getTime()) {
    const err = new Error(`Khoảng ngày không hợp lệ: ngày bắt đầu (${fromDate}) phải trước hoặc bằng ngày kết thúc (${toDate}).`);
    err.status = 400;
    err.name = 'DateValidationError';
    throw err;
  }

  const diffMs = endBoundary.endDate.getTime() - startBoundary.startDate.getTime();
  const diffDays = Math.round(diffMs / (24 * 3600 * 1000));
  if (diffDays > maxRangeDays) {
    const err = new Error(`Khoảng thời gian không được vượt quá ${maxRangeDays} ngày (yêu cầu: ${diffDays} ngày).`);
    err.status = 400;
    err.name = 'DateValidationError';
    throw err;
  }

  return {
    start: startBoundary.start,
    end: endBoundary.end,
    startDate: startBoundary.startDate,
    endDate: endBoundary.endDate,
    days: diffDays,
  };
}

/**
 * Gets start and end boundaries for today in Vietnam timezone (Asia/Ho_Chi_Minh).
 */
export function getTodayBoundaries(instant = new Date()) {
  const todayStr = formatVietnamBusinessDate(instant);
  return parseVietnamSingleDateBoundary(todayStr);
}

/**
 * Builds a one-hour preorder slot from a Vietnam calendar date and hour.
 * This deliberately derives the instant from the IANA-aware Vietnam midnight
 * helper above; callers must not add a manual UTC+7 offset.
 */
export function buildVietnamPreorderSlot(dateStr, hour) {
  if (!isValidDateString(dateStr)) {
    const error = new Error('Ngày nhận đơn trước không hợp lệ');
    error.status = 400;
    error.code = 'PREORDER_DATE_INVALID';
    throw error;
  }
  const normalizedHour = Number(hour);
  if (!Number.isInteger(normalizedHour) || normalizedHour < 9 || normalizedHour > 22) {
    const error = new Error('Khung giờ đặt trước chỉ từ 09:00 đến 23:00');
    error.status = 400;
    error.code = 'PREORDER_SLOT_HOUR_INVALID';
    throw error;
  }
  const boundary = parseVietnamSingleDateBoundary(dateStr);
  const start = new Date(boundary.startDate.getTime() + (normalizedHour * 60 * 60 * 1000));
  const end = new Date(start.getTime() + (60 * 60 * 1000));
  return { start, end, date: dateStr.trim(), hour: normalizedHour };
}

const DEFAULT_PREORDER_MIN_LEAD_HOURS = 3;

/**
 * Runtime-only operator setting. Invalid or omitted values deliberately keep
 * the locked production default instead of silently opening preorder slots.
 */
export function getPreorderMinLeadHours(env = process.env) {
  const raw = String(env?.PREORDER_MIN_LEAD_HOURS ?? '').trim();
  if (!raw) return DEFAULT_PREORDER_MIN_LEAD_HOURS;
  const hours = Number(raw);
  return Number.isInteger(hours) && hours >= 0 && hours <= 168
    ? hours
    : DEFAULT_PREORDER_MIN_LEAD_HOURS;
}

/** Validates preorder lead/horizon rules against a real instant. */
export function validateVietnamPreorderSlot({ date, hour, now = new Date(), minimumLeadHours = getPreorderMinLeadHours() } = {}) {
  const slot = buildVietnamPreorderSlot(date, hour);
  const nowDate = coerceDate(now);
  if (!nowDate) throw new TypeError('Invalid now instant for preorder validation');
  const leadMs = slot.start.getTime() - nowDate.getTime();
  const normalizedMinimumLeadHours = Number.isInteger(Number(minimumLeadHours)) && Number(minimumLeadHours) >= 0
    ? Number(minimumLeadHours)
    : DEFAULT_PREORDER_MIN_LEAD_HOURS;
  if (leadMs < normalizedMinimumLeadHours * 60 * 60 * 1000) {
    const error = new Error(`Thời gian đặt trước còn dưới ${normalizedMinimumLeadHours} giờ, vui lòng sử dụng đặt đơn thông thường`);
    error.status = 422;
    error.code = 'PREORDER_MIN_LEAD_TIME';
    throw error;
  }
  const nowDateKey = formatVietnamBusinessDate(nowDate);
  const nowBoundary = parseVietnamSingleDateBoundary(nowDateKey).startDate;
  const slotBoundary = parseVietnamSingleDateBoundary(slot.date).startDate;
  const calendarDays = Math.round((slotBoundary.getTime() - nowBoundary.getTime()) / (24 * 60 * 60 * 1000));
  if (calendarDays < 0 || calendarDays > 7) {
    const error = new Error('Chỉ nhận đặt trước trong vòng 7 ngày');
    error.status = 422;
    error.code = 'PREORDER_MAX_HORIZON';
    throw error;
  }
  return { ...slot, calendarDays };
}

/**
 * Evaluates whether customer self check-in is open for a preorder scheduled instant.
 * Rule: same local calendar date in Asia/Ho_Chi_Minh, wall-clock time between 08:00 inclusive and 24:00 exclusive.
 */
export function evaluatePreorderCheckinWindow({ scheduledStartAt, now = new Date() } = {}) {
  const scheduledDate = coerceDate(scheduledStartAt);
  if (!scheduledDate) {
    throw new TypeError('Invalid scheduledStartAt provided to evaluatePreorderCheckinWindow');
  }
  const nowDate = coerceDate(now);
  if (!nowDate) {
    throw new TypeError('Invalid now provided to evaluatePreorderCheckinWindow');
  }

  const scheduledDayStr = formatVietnamBusinessDate(scheduledDate);
  const nowDayStr = formatVietnamBusinessDate(nowDate);

  const nowBoundary = parseVietnamSingleDateBoundary(nowDayStr);
  const scheduledBoundary = parseVietnamSingleDateBoundary(scheduledDayStr);

  const scheduledMidnightMs = scheduledBoundary.startDate.getTime();
  const nowMidnightMs = nowBoundary.startDate.getTime();

  if (nowMidnightMs < scheduledMidnightMs) {
    return {
      isOpen: false,
      reason: 'EARLY_DATE',
      scheduledDate: scheduledDayStr,
      currentDate: nowDayStr,
    };
  }

  if (nowMidnightMs > scheduledMidnightMs) {
    return {
      isOpen: false,
      reason: 'PAST_DATE',
      scheduledDate: scheduledDayStr,
      currentDate: nowDayStr,
    };
  }

  const parts = getVietnamCalendarParts(nowDate);
  if (parts.hour < 8) {
    return {
      isOpen: false,
      reason: 'BEFORE_OPERATING_HOURS',
      scheduledDate: scheduledDayStr,
      currentDate: nowDayStr,
      opensAtHour: 8,
    };
  }

  return {
    isOpen: true,
    scheduledDate: scheduledDayStr,
    currentDate: nowDayStr,
  };
}

/**
 * Checks whether customer self-cancellation is within the allowed window:
 * through the end of the scheduled local calendar day (24:00) in Asia/Ho_Chi_Minh.
 */
export function isWithinPreorderCancellationWindow({ scheduledStartAt, now = new Date() } = {}) {
  const scheduledDate = coerceDate(scheduledStartAt);
  if (!scheduledDate) throw new TypeError('Invalid scheduledStartAt');
  const nowDate = coerceDate(now);
  if (!nowDate) throw new TypeError('Invalid now');

  const scheduledDayStr = formatVietnamBusinessDate(scheduledDate);
  const scheduledBoundary = parseVietnamSingleDateBoundary(scheduledDayStr);

  return nowDate.getTime() < scheduledBoundary.endDate.getTime();
}
