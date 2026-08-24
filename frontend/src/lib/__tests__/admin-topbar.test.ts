import { describe, expect, it } from "vitest";
import {
  formatAdminRoleLabel,
  formatNotificationBadgeCount,
  getRecentNotifications,
} from "../admin-topbar";

describe("Admin Topbar helpers", () => {
  it("formats admin roles accurately", () => {
    expect(formatAdminRoleLabel("super")).toBe("Quản trị viên cấp cao");
    expect(formatAdminRoleLabel("manager")).toBe("Quản lý chi nhánh");
    expect(formatAdminRoleLabel("kitchen")).toBe("Bếp / Pha chế");
    expect(formatAdminRoleLabel("cashier")).toBe("Thu ngân");
    expect(formatAdminRoleLabel(null)).toBe("Nhân viên");
  });

  it("formats notification badge count with 99+ cap", () => {
    expect(formatNotificationBadgeCount(0)).toBe("");
    expect(formatNotificationBadgeCount(-5)).toBe("");
    expect(formatNotificationBadgeCount(5)).toBe("5");
    expect(formatNotificationBadgeCount(99)).toBe("99");
    expect(formatNotificationBadgeCount(150)).toBe("99+");
  });

  it("slices up to 5 recent notifications safely", () => {
    const list = [1, 2, 3, 4, 5, 6, 7];
    expect(getRecentNotifications(list, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getRecentNotifications(list, 0)).toEqual([]);
    expect(getRecentNotifications([])).toEqual([]);
  });
});
