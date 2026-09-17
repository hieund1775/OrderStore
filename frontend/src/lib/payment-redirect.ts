export type CheckoutPaymentRedirect =
  | { kind: "sandbox"; token: string }
  | { kind: "external"; url: string }
  | { kind: "invalid" };

/**
 * Keeps sandbox navigation inside the SPA while preserving the external
 * redirect required by PayOS.  Do not trust a provider flag on its own: a
 * sandbox URL must also resolve to this application's sandbox route.
 */
export function resolveCheckoutPaymentRedirect(
  checkoutUrl: string | null | undefined,
  paymentProvider: string | null | undefined,
  appOrigin: string,
): CheckoutPaymentRedirect {
  if (!checkoutUrl || !appOrigin) return { kind: "invalid" };

  let url: URL;
  try {
    url = new URL(checkoutUrl, appOrigin);
  } catch {
    return { kind: "invalid" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid" };
  }

  const isSandboxRoute =
    url.origin === appOrigin &&
    url.pathname === "/thanh-toan/sandbox";

  if (paymentProvider === "sandbox" || isSandboxRoute) {
    const token = isSandboxRoute ? url.searchParams.get("token")?.trim() : "";
    return token ? { kind: "sandbox", token } : { kind: "invalid" };
  }

  return { kind: "external", url: url.toString() };
}
