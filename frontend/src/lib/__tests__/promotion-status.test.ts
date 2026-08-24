import { describe, expect, it } from "vitest";
import { getPromotionStatus, formatLocalDateKey, formatVoucherDate } from "../promotion-status";

describe("Promotion Status & Badge calculation", () => {
  const baseDate = new Date("2026-08-24T12:00:00Z");

  it("identifies inactive promotion regardless of date/usage", () => {
    const status = getPromotionStatus(
      {
        is_active: false,
        voucher_type: "shared",
        start_date: "2026-08-01",
        end_date: "2026-08-30",
      },
      baseDate,
    );
    expect(status.label).toBe("Tạm tắt");
    expect(status.variant).toBe("inactive");
  });

  it("marks expired when end_date has passed", () => {
    const status = getPromotionStatus(
      {
        is_active: true,
        voucher_type: "shared",
        start_date: "2026-08-01",
        end_date: "2026-08-20",
      },
      baseDate,
    );
    expect(status.label).toBe("Hết hạn");
    expect(status.variant).toBe("expired");
  });

  it("marks exhausted when shared voucher usage_limit is reached", () => {
    const status = getPromotionStatus(
      {
        is_active: true,
        voucher_type: "shared",
        start_date: "2026-08-01",
        end_date: "2026-08-30",
        usage_limit: 10,
        used_count: 10,
      },
      baseDate,
    );
    expect(status.label).toBe("Hết lượt");
    expect(status.variant).toBe("exhausted");
  });

  it("never marks single_use expired by usage_limit", () => {
    const status = getPromotionStatus(
      {
        is_active: true,
        voucher_type: "single_use",
        start_date: "2026-08-01",
        end_date: null,
        usage_limit: null,
        used_count: 100,
      },
      baseDate,
    );
    expect(status.label).toBe("Đang diễn ra");
    expect(status.isUnlimitedDate).toBe(true);
    expect(status.dateDisplay).toBe("Không hạn ngày");
    expect(status.usageDisplay).toBe("1 lần / SĐT");
    expect(status.isUnlimitedUsage).toBe(false);
  });

  it("marks pending when start_date is in the future", () => {
    const status = getPromotionStatus(
      {
        is_active: true,
        voucher_type: "shared",
        start_date: "2026-08-30",
        end_date: "2026-09-10",
      },
      baseDate,
    );
    expect(status.label).toBe("Sắp diễn ra");
    expect(status.variant).toBe("pending");
  });

  it("formats dates consistently", () => {
    expect(formatVoucherDate("2026-08-25")).toBe("25/08/2026");
    expect(formatVoucherDate(null)).toBe("Không hạn ngày");
  });

  it("uses the local calendar date instead of UTC when calculating status", () => {
    const localLateNight = new Date(2026, 7, 24, 23, 30, 0);
    expect(formatLocalDateKey(localLateNight)).toBe("2026-08-24");
    expect(
      getPromotionStatus(
        {
          is_active: true,
          voucher_type: "shared",
          start_date: "2026-08-25",
          end_date: null,
        },
        localLateNight,
      ).variant,
    ).toBe("pending");
  });
});
