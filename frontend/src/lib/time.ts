/**
 * Production Time Service for Multizone Display & Vietnam Business Time
 *
 * Implements strict instant parsing, cached Intl formatters, and operation time helpers.
 */

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";
export const FALLBACK_DASH = "—";

const UNZONED_REGEX = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;
const ZONED_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** Cache for Intl.DateTimeFormat instances by composite key */
const formattersCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formattersCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formattersCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Validates whether calendar year, month, day is logically valid (including leap years).
 */
function isValidCalendarDay(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function utcWallClockMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): number {
  const date = new Date(0);
  date.setUTCHours(hour, minute, second, millisecond);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

function parseOffsetMinutes(offset: string): number | null {
  if (offset.toUpperCase() === "Z") return 0;
  const match = offset.match(/^([+-])(\d{2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  if (hours > 23 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return match[1] === "-" ? -total : total;
}

export function canonicalizeTimeZone(timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const CANONICAL_VIETNAM_TIMEZONE = canonicalizeTimeZone(VIETNAM_TIMEZONE);

export function isVietnamTimeZone(timeZone: string): boolean {
  const canonical = canonicalizeTimeZone(timeZone);
  return canonical !== null && canonical === CANONICAL_VIETNAM_TIMEZONE;
}

/**
 * Parses an instant from ISO string (with Z/offset), legacy unzoned string (assumed Vietnam +07:00),
 * epoch millisecond number, or Date instance.
 *
 * Returns null if input is empty, malformed, invalid calendar date, or contains trailing garbage.
 */
export function parseTimestamp(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;

  // 1. Zoned ISO string with explicit 'Z' or offset (+HH:mm / -HH:mm)
  const zonedMatch = s.match(ZONED_REGEX);
  if (zonedMatch) {
    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr = "0", fraction = "0", offset] = zonedMatch;
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const hour = Number(hhStr);
    const minute = Number(mmStr);
    const second = Number(ssStr);
    const offsetMinutes = parseOffsetMinutes(offset);
    if (
      !isValidCalendarDay(year, month, day) ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      offsetMinutes === null
    ) {
      return null;
    }
    const millisecond = Number(fraction.padEnd(3, "0").slice(0, 3));
    return new Date(
      utcWallClockMs(year, month, day, hour, minute, second, millisecond) - offsetMinutes * 60_000,
    );
  }

  // 2. Unzoned ISO/SQL datetime "YYYY-MM-DD[T ]HH:mm[:ss][.SSS]" -> treat as Vietnam Asia/Ho_Chi_Minh (+07:00)
  const match = s.match(UNZONED_REGEX);
  if (match) {
    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr = "0", msStr = "0"] = match;
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    const hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    const ss = parseInt(ssStr, 10);

    if (
      !isValidCalendarDay(y, m, d) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59 ||
      ss < 0 ||
      ss > 59
    ) {
      return null;
    }

    const isoWithVnOffset = `${yStr}-${mStr}-${dStr}T${hhStr}:${mmStr}:${ssStr.padStart(2, "0")}.${msStr.padEnd(3, "0").slice(0, 3)}+07:00`;
    const parsed = new Date(isoWithVnOffset);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Backwards-compatible alias for parseTimestamp, returning a Date object.
 * Returns an invalid Date for legacy consumers when parsing fails.
 */
export function parseLocalDate(dateInput: string | Date): Date {
  return parseTimestamp(dateInput) || new Date(Number.NaN);
}

/**
 * Formats a timestamp in a specific timezone with given format options.
 * Returns '—' if input is null or invalid.
 */
export function formatDateTimeInZone(
  value: unknown,
  timeZone: string = VIETNAM_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
): string {
  const d = parseTimestamp(value);
  if (!d) return FALLBACK_DASH;

  try {
    const formatter = getFormatter("en-GB", { ...options, timeZone });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

    // If options include both time and date
    if (options.hour && options.day) {
      return `${getPart("hour")}:${getPart("minute")} - ${getPart("day")}/${getPart("month")}/${getPart("year")}`;
    }
    // Date only
    if (options.day && !options.hour) {
      return `${getPart("day")}/${getPart("month")}/${getPart("year")}`;
    }
    // Time only with seconds
    if (options.second) {
      return `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
    }
    // Time only
    if (options.hour) {
      return `${getPart("hour")}:${getPart("minute")}`;
    }
    return formatter.format(d);
  } catch {
    return FALLBACK_DASH;
  }
}

/**
 * Format Vietnam time only: HH:mm (e.g. 21:30)
 */
export function formatVietnamTime(value: unknown): string {
  return formatDateTimeInZone(value, VIETNAM_TIMEZONE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format Vietnam time with seconds: HH:mm:ss (e.g. 21:30:45)
 */
export function formatVietnamTimeFull(value: unknown): string {
  return formatDateTimeInZone(value, VIETNAM_TIMEZONE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Format Vietnam date only: DD/MM/YYYY (e.g. 25/08/2026)
 */
export function formatVietnamDate(value: unknown): string {
  return formatDateTimeInZone(value, VIETNAM_TIMEZONE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format full Vietnam date-time: HH:mm - DD/MM/YYYY
 */
export function formatVietnamDateTime(value: unknown): string {
  return formatDateTimeInZone(value, VIETNAM_TIMEZONE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Calculate a non-negative elapsed duration in ms between a start instant and an end epoch timestamp.
 */
export function elapsedDurationMs(start: unknown, endAt: number): number {
  const startDate = parseTimestamp(start);
  if (!startDate || !Number.isFinite(endAt)) return 0;
  return Math.max(0, endAt - startDate.getTime());
}

/**
 * Format elapsed duration as a stable digital clock: HH:mm:ss.
 */
export function fmtClockTimer(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Generates Vietnam order date prefix: "YYMMDD"
 */
export function formatVietnamOrderDatePrefix(value: unknown = new Date()): string {
  const d = parseTimestamp(value);
  if (!d) throw new TypeError("Invalid date/instant provided to formatVietnamOrderDatePrefix");
  const formatter = getFormatter("en-GB", {
    timeZone: VIETNAM_TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const find = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${find("year")}${find("month")}${find("day")}`;
}

// Aliases for data.ts backwards compatibility
export const fmtTime = formatVietnamTime;
export const fmtTimeFull = formatVietnamTimeFull;
export const fmtDate = formatVietnamDate;
export const fmtDateTime = formatVietnamDateTime;
