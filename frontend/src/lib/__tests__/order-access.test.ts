import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrderCancelToken,
  getOrderRequestHeaders,
  isPayOSLinkActive,
  isSafePayOSCheckoutUrl,
} from "../order-access";

describe("Order Access & Guest Token Headers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("reads cancellation token from sessionStorage first", () => {
    window.sessionStorage.setItem("cancel_token_TP100", "session-token");
    window.localStorage.setItem("cancel_token_TP100", "local-token");

    expect(getOrderCancelToken("TP100")).toBe("session-token");
  });

  it("falls back to localStorage if not in sessionStorage", () => {
    window.localStorage.setItem("cancel_token_TP200", "local-token-200");

    expect(getOrderCancelToken("TP200")).toBe("local-token-200");
  });

  it("generates headers with x-cancel-token when token is present", () => {
    window.sessionStorage.setItem("cancel_token_TP300", "my-token");

    expect(getOrderRequestHeaders("TP300")).toEqual({
      "x-cancel-token": "my-token",
    });
    expect(getOrderRequestHeaders("TP999")).toEqual({});
  });

  it("correctly assesses active vs expired PayOS link", () => {
    const now = 1750000000000;
    expect(
      isPayOSLinkActive({ payment_expires_at: new Date(now + 10000).toISOString() }, now),
    ).toBe(true);
    expect(isPayOSLinkActive({ payment_expires_at: new Date(now - 1000).toISOString() }, now)).toBe(
      false,
    );
    expect(isPayOSLinkActive({ payment_expires_at: null }, now)).toBe(false);
  });

  it("fails closed when browser storage cannot be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(getOrderCancelToken("TP400")).toBeNull();
    expect(getOrderRequestHeaders("TP400")).toEqual({});
    getItem.mockRestore();
  });

  it("only accepts HTTPS checkout URLs on the PayOS domain", () => {
    expect(isSafePayOSCheckoutUrl("https://pay.payos.vn/web/123")).toBe(true);
    expect(isSafePayOSCheckoutUrl("https://payos.vn/demo")).toBe(true);
    expect(isSafePayOSCheckoutUrl("http://pay.payos.vn/web/123")).toBe(false);
    expect(isSafePayOSCheckoutUrl("https://payos.vn.evil.example/steal")).toBe(false);
    expect(isSafePayOSCheckoutUrl("javascript:alert(1)")).toBe(false);
  });
});
