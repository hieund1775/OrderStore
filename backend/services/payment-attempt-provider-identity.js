function normalizedIdentifier(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

// provider_event_key remains VARCHAR(255) until 0027. With `payos`, the
// profile-code maximum (50), separators, and this bound, the canonical key is
// at most 247 characters and is safe for both legacy and additive schemas.
export const MAX_PAYOS_PROVIDER_PAYMENT_IDENTITY_LENGTH = 190;

function boundedIdentity(prefix, value) {
  const normalized = normalizedIdentifier(value);
  if (!normalized) return null;
  const identity = `${prefix}:${normalized}`;
  return identity.length <= MAX_PAYOS_PROVIDER_PAYMENT_IDENTITY_LENGTH ? identity : null;
}

/**
 * PayOS can expose several identifiers for one completed payment. Keep one
 * deterministic identity for both webhook and active reconciliation so the
 * same provider payment writes one idempotency event.
 */
export function buildPayOSProviderPaymentIdentity({ reference = null, paymentLinkId = null, orderCode = null } = {}) {
  const transactionReference = boundedIdentity('reference', reference);
  if (transactionReference) return transactionReference;
  const linkId = boundedIdentity('payment_link', paymentLinkId);
  if (linkId) return linkId;
  const providerOrderCode = boundedIdentity('order_code', orderCode);
  if (providerOrderCode) return providerOrderCode;
  return null;
}

export function extractPayOSIdentifiers(value = {}) {
  const data = value?.data && typeof value.data === 'object' ? value.data : value;
  return {
    orderCode: data?.orderCode ?? null,
    paymentLinkId: data?.paymentLinkId ?? null,
    reference: data?.reference ?? null,
  };
}

export function doesPayOSDataMatchAttempt(data, attempt) {
  const { orderCode, paymentLinkId } = extractPayOSIdentifiers(data);
  if (orderCode == null && paymentLinkId == null) return false;
  if (orderCode != null && Number(orderCode) !== Number(attempt.provider_order_code)) return false;
  if (paymentLinkId != null
    && String(paymentLinkId) !== String(attempt.provider_payment_link_id || '')) return false;
  return true;
}
