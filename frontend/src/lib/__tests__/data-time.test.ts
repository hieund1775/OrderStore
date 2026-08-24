import { describe, expect, it } from "vitest";
import {
  parseTimestamp,
  formatVietnamDateTime,
  formatVietnamDate,
  formatVietnamTime,
  formatVietnamTimeFull,
  formatDateTimeInZone,
  elapsedDurationMs,
  fmtClockTimer,
  formatVietnamOrderDatePrefix,
  canonicalizeTimeZone,
  isVietnamTimeZone,
  FALLBACK_DASH,
  VIETNAM_TIMEZONE,
} from "../time";

describe("Time and date formatting suite", () => {
  it("formats UTC ISO timestamp into Vietnam timezone (00:05 AM on 25/08/2026)", () => {
    // 17:05 UTC on 24/08/2026 is 00:05 AM on 25/08/2026 in Vietnam (UTC+7)
    const utcIso = "2026-08-24T17:05:00.000Z";
    expect(formatVietnamDateTime(utcIso)).toBe("00:05 - 25/08/2026");
    expect(formatVietnamDate(utcIso)).toBe("25/08/2026");
    expect(formatVietnamTime(utcIso)).toBe("00:05");
    expect(formatVietnamTimeFull(utcIso)).toBe("00:05:00");
    expect(formatVietnamOrderDatePrefix(utcIso)).toBe("260825");
  });

  it("handles explicit +07:00 offset and preserves identical instant", () => {
    const vnIso = "2026-08-25T00:05:00.000+07:00";
    expect(formatVietnamDateTime(vnIso)).toBe("00:05 - 25/08/2026");
    expect(formatVietnamDate(vnIso)).toBe("25/08/2026");
    expect(formatVietnamTime(vnIso)).toBe("00:05");
  });

  it("converts foreign timezone ISO timestamps accurately to Vietnam timezone", () => {
    // Tokyo (UTC+9) 02:05 AM on 25/08/2026 is 00:05 AM on 25/08/2026 in Vietnam
    const tokyoIso = "2026-08-25T02:05:00+09:00";
    expect(formatVietnamDateTime(tokyoIso)).toBe("00:05 - 25/08/2026");

    // New York (UTC-4 EDT) 13:05 PM on 24/08/2026 is 00:05 AM on 25/08/2026 in Vietnam
    const nyIso = "2026-08-24T13:05:00-04:00";
    expect(formatVietnamDateTime(nyIso)).toBe("00:05 - 25/08/2026");
  });

  it("parses legacy unzoned datetime strings as Vietnam wall time", () => {
    expect(formatVietnamDateTime("2026-08-25 00:05:00")).toBe("00:05 - 25/08/2026");
    expect(formatVietnamDateTime("2026-08-25T14:30:00")).toBe("14:30 - 25/08/2026");
  });

  it("safely handles invalid dates, garbage suffixes, and empty inputs", () => {
    expect(parseTimestamp("2026-02-30 10:00:00")).toBeNull(); // Feb 30 does not exist
    expect(parseTimestamp("2026-02-30T10:00:00Z")).toBeNull();
    expect(parseTimestamp("2026-04-31T10:00:00+07:00")).toBeNull();
    expect(parseTimestamp("2026-08-25T24:00:00Z")).toBeNull();
    expect(parseTimestamp("2026-08-25T10:00:00+24:00")).toBeNull();
    expect(parseTimestamp("2026-08-25 10:00:00 garbage")).toBeNull(); // Trailing garbage
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();

    expect(formatVietnamDateTime("invalid-date")).toBe(FALLBACK_DASH);
    expect(formatVietnamDate("")).toBe(FALLBACK_DASH);
    expect(formatVietnamTime(null)).toBe(FALLBACK_DASH);
    expect(() => formatVietnamOrderDatePrefix("invalid-date")).toThrow(TypeError);
  });

  it("recognizes Vietnam IANA aliases without duplicating store time", () => {
    expect(canonicalizeTimeZone("Invalid/Zone")).toBeNull();
    expect(isVietnamTimeZone(VIETNAM_TIMEZONE)).toBe(true);
    expect(isVietnamTimeZone("Asia/Saigon")).toBe(true);
    expect(isVietnamTimeZone("Asia/Tokyo")).toBe(false);
  });

  it("formats custom target timezones with formatDateTimeInZone", () => {
    const instant = "2026-08-24T17:05:00.000Z";
    // Tokyo (Asia/Tokyo) is UTC+9 -> 02:05 - 25/08/2026
    expect(formatDateTimeInZone(instant, "Asia/Tokyo")).toBe("02:05 - 25/08/2026");
    // Los Angeles (America/Los_Angeles) is UTC-7 PDT -> 10:05 - 24/08/2026
    expect(formatDateTimeInZone(instant, "America/Los_Angeles")).toBe("10:05 - 24/08/2026");
  });

  it("computes accurate KDS elapsed duration without timezone distortion", () => {
    const createdAt = "2026-08-24T17:05:00.000Z"; // 00:05 VN
    const endAt = new Date("2026-08-24T17:19:20.000Z").getTime(); // 14 mins 20 secs later

    const elapsed = elapsedDurationMs(createdAt, endAt);
    expect(elapsed).toBe(14 * 60_000 + 20_000);
    expect(fmtClockTimer(elapsed)).toBe("00:14:20");

    // Invalid or future start returns 0
    expect(elapsedDurationMs("invalid", endAt)).toBe(0);
    expect(elapsedDurationMs(createdAt, new Date("2026-08-24T16:00:00.000Z").getTime())).toBe(0);
  });
});
