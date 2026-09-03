import { getPaymentLinkInformation } from './payos.js';

// Avoid hammering PayOS when several browser polls arrive at the same time.
const lastChecks = new Map();
const CHECK_INTERVAL_MS = 2500;

export async function reconcilePayOSOrder({ order, paymentRepository, getPaymentInfo = getPaymentLinkInformation }) {
  if (!order || order.payment_status !== 'unpaid' || order.payment_provider !== 'payos' || !order.payos_order_code) {
    return { changed: false, skipped: true };
  }

  const payosCode = String(order.payos_order_code);
  const now = Date.now();
  const lastCheck = lastChecks.get(payosCode) || 0;
  if (now - lastCheck < CHECK_INTERVAL_MS) return { changed: false, skipped: true };
  lastChecks.set(payosCode, now);

  const payosInfo = await getPaymentInfo(
    order.payos_order_code,
    order.payment_link_id,
    order.payment_profile_code || null,
  );
  const paidAmount = Number(payosInfo?.amountPaid ?? payosInfo?.amount);
  if (payosInfo?.status !== 'PAID' || !Number.isFinite(paidAmount) || paidAmount !== Number(order.total)) {
    return { changed: false, skipped: false };
  }

  const reference = payosInfo.transactions?.[0]?.reference
    || payosInfo.transactionId
    || payosInfo.id
    || payosCode;
  const result = await paymentRepository.processSuccessfulWebhook({
    eventKey: `reconcile-${payosCode}-${reference}`,
    orderCode: order.payos_order_code,
    amount: paidAmount,
    reference,
    paymentLinkId: payosInfo.id || order.payment_link_id || null,
    payload: payosInfo,
  });
  return { changed: result?.kind === 'paid' || result?.kind === 'already_paid', result };
}

