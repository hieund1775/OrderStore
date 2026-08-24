export function getOrderCancelToken(orderCode: string): string | null {
  if (!orderCode || typeof window === "undefined") return null;
  const key = `cancel_token_${orderCode}`;
  try {
    const sessionVal = window.sessionStorage?.getItem(key);
    if (sessionVal && sessionVal.trim()) return sessionVal.trim();
  } catch {
    // sessionStorage can be blocked by browser privacy settings.
  }

  try {
    const localVal = window.localStorage?.getItem(key);
    if (localVal && localVal.trim()) return localVal.trim();
  } catch {
    // localStorage can be blocked independently; fail closed without a token.
  }

  return null;
}

export function getOrderRequestHeaders(orderCode?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!orderCode) return headers;
  const token = getOrderCancelToken(orderCode);
  if (token) {
    headers["x-cancel-token"] = token;
  }
  return headers;
}

export function isPayOSLinkActive(
  order?: { payment_expires_at?: string | null } | null,
  nowMs: number = Date.now(),
): boolean {
  if (!order || !order.payment_expires_at) return false;
  try {
    const expiresMs = new Date(order.payment_expires_at).getTime();
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  } catch {
    return false;
  }
}

export function isSafePayOSCheckoutUrl(value?: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "payos.vn" || hostname.endsWith(".payos.vn"));
  } catch {
    return false;
  }
}
