export type PendingPayOSPayment = {
  payment_code: string;
  order_code?: string;
  order_id?: number | null;
  total: number;
  is_grouped: boolean;
  checkout_url?: string | null;
  qr_code?: string | null;
  payment_expires_at?: string | null;
};

export function normalizePendingPayment(
  response: {
    payment_code?: string;
    order_code?: string;
    group_code?: string;
    order_id?: number | string | null;
    total?: number | string | null;
    total_amount?: number | string | null;
    is_grouped?: boolean;
    checkout_url?: string | null;
    qr_code?: string | null;
    payment_expires_at?: string | null;
  } | null | undefined
): PendingPayOSPayment | null {
  if (!response) return null;
  const code = response.payment_code || response.group_code || response.order_code;
  if (!code) return null;

  const isGrouped = Boolean(
    response.is_grouped || (typeof code === 'string' && code.startsWith('GRP'))
  );

  const rawTotal = response.total_amount ?? response.total ?? 0;
  const numericTotal = Number(rawTotal);
  const total = Number.isFinite(numericTotal) ? numericTotal : 0;

  const rawOrderId = response.order_id != null ? Number(response.order_id) : null;
  const orderId = Number.isInteger(rawOrderId) ? rawOrderId : null;

  return {
    payment_code: code,
    order_code: code,
    order_id: orderId,
    total,
    is_grouped: isGrouped,
    checkout_url: response.checkout_url || null,
    qr_code: response.qr_code || null,
    payment_expires_at: response.payment_expires_at || null,
  };
}

export function parsePendingPaymentFromSession(raw: string | null | undefined): PendingPayOSPayment | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return normalizePendingPayment(parsed);
  } catch {
    return null;
  }
}
