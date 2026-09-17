import { describe, expect, it } from "vitest";
import { resolveCheckoutPaymentRedirect } from "../payment-redirect";

const origin = "https://teaplus-order-frontend.onrender.com";

describe("checkout payment redirect", () => {
  it.each([
    ["cart one-lane", "sandbox", "/thanh-toan/sandbox?token=cart-one"],
    ["cart grouped", "sandbox", "https://teaplus-order-frontend.onrender.com/thanh-toan/sandbox?token=cart-group"],
    ["buy now", "sandbox", "/thanh-toan/sandbox?token=buy-now"],
    ["preorder", "sandbox", "/thanh-toan/sandbox?token=preorder"],
  ])("routes %s checkout internally in sandbox mode", (_flow, provider, checkoutUrl) => {
    expect(resolveCheckoutPaymentRedirect(checkoutUrl, provider, origin)).toEqual({
      kind: "sandbox",
      token: checkoutUrl.includes("buy-now")
        ? "buy-now"
        : checkoutUrl.includes("group")
          ? "cart-group"
          : checkoutUrl.includes("preorder")
            ? "preorder"
            : "cart-one",
    });
  });

  it("keeps PayOS navigation external", () => {
    expect(
      resolveCheckoutPaymentRedirect("https://pay.payos.vn/web/abc", "payos", origin),
    ).toEqual({ kind: "external", url: "https://pay.payos.vn/web/abc" });
  });

  it("rejects a sandbox provider with a missing token and unsafe links", () => {
    expect(
      resolveCheckoutPaymentRedirect("/thanh-toan/sandbox", "sandbox", origin),
    ).toEqual({ kind: "invalid" });
    expect(
      resolveCheckoutPaymentRedirect("javascript:alert(1)", "payos", origin),
    ).toEqual({ kind: "invalid" });
  });
});
