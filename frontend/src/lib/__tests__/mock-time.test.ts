import { describe, expect, it } from "vitest";
import { formatVietnamOrderDatePrefix } from "../time";

describe("Standalone mock time suite", () => {
  it("generates mock order code with Vietnam date prefix at midnight boundary", () => {
    // 17:05 UTC on 24/08/2026 is 00:05 AM on 25/08/2026 in Vietnam
    const midnightEarly = new Date("2026-08-24T17:05:00.000Z");
    const prefix = formatVietnamOrderDatePrefix(midnightEarly);
    expect(prefix).toBe("260825");

    const mockCode = "TP" + prefix + "1234";
    expect(mockCode).toBe("TP2608251234");
    expect(mockCode).toMatch(/^TP\d{6}\d{4}$/);
  });
});
