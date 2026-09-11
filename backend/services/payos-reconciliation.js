import paymentAttemptsRepository from '../repositories/postgres/payment-attempts.js';
import { getPaymentLinkInformation } from './payos.js';
import { settleVerifiedPayOSAttempt } from './payment-attempt-settlement.js';
import preorderService from './preorders/preorder-service.js';

// Avoid hammering PayOS when several browser polls arrive at the same time.
const lastChecks = new Map();
const CHECK_INTERVAL_MS = 2500;

function payosReference(payment, fallback) {
  return payment?.transactions?.[0]?.reference
    || payment?.transactionId
    || payment?.reference
    || payment?.id
    || fallback;
}

export async function reconcilePayOSAttempt({
  attempt,
  attemptsRepository = paymentAttemptsRepository,
  getPaymentInfo = getPaymentLinkInformation,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
} = {}) {
  if (!attempt || attempt.provider !== 'payos'
    || !['active', 'expired', 'superseded'].includes(attempt.status)
    || attempt.provider_order_code == null) {
    return { changed: false, skipped: true };
  }

  const throttleKey = `${attempt.payment_profile_code}:${attempt.provider_order_code}`;
  const now = Date.now();
  const lastCheck = lastChecks.get(throttleKey) || 0;
  if (now - lastCheck < CHECK_INTERVAL_MS) return { changed: false, skipped: true };
  lastChecks.set(throttleKey, now);

  const payosInfo = await getPaymentInfo(
    attempt.provider_order_code,
    attempt.provider_payment_link_id,
    attempt.payment_profile_code,
  );
  const amount = Number(payosInfo?.amountPaid ?? payosInfo?.amount);
  if (payosInfo?.status !== 'PAID' || !Number.isFinite(amount)
    || Math.round(amount) !== Math.round(Number(attempt.amount))) {
    return { changed: false, skipped: false };
  }

  const data = {
    orderCode: attempt.provider_order_code,
    paymentLinkId: payosInfo.id || attempt.provider_payment_link_id || null,
    amount,
    reference: payosReference(payosInfo, attempt.provider_order_code),
    code: '00',
  };
  const result = await settleVerifiedPayOSAttempt({
    attempt,
    data,
    attemptsRepository,
    payload: payosInfo,
  });
  if (preorderBridge && ['paid', 'already_paid', 'duplicate'].includes(result?.kind)) {
    await preorderBridge.onPaymentSettled({
      orderId: attempt.order_id,
      checkoutGroupId: attempt.checkout_group_id,
      late: ['expired', 'superseded'].includes(attempt.status),
    });
  }
  return { changed: result?.kind === 'paid' || result?.kind === 'already_paid', result };
}

/**
 * Compatibility entry point for existing customer/admin polling callers.
 * The order object only locates its canonical pointer; provider resolution and
 * settlement use the immutable attempt snapshot.
 */
export async function reconcilePayOSOrder({
  order,
  attemptsRepository = paymentAttemptsRepository,
  getPaymentInfo = getPaymentLinkInformation,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
} = {}) {
  if (!order || !order.id || order.payment_provider !== 'payos'
    || !['unpaid', 'expired'].includes(order.payment_status)) {
    return { changed: false, skipped: true };
  }
  const attempt = await attemptsRepository.findCurrentAttemptForTarget({ orderId: order.id });
  return reconcilePayOSAttempt({ attempt, attemptsRepository, getPaymentInfo, preorderBridge });
}

export async function reconcilePayOSCheckoutGroup({
  checkoutGroup,
  attemptsRepository = paymentAttemptsRepository,
  getPaymentInfo = getPaymentLinkInformation,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
} = {}) {
  if (!checkoutGroup || !checkoutGroup.id || checkoutGroup.payment_provider !== 'payos'
    || !['unpaid', 'expired'].includes(checkoutGroup.payment_status)) {
    return { changed: false, skipped: true };
  }
  const attempt = await attemptsRepository.findCurrentAttemptForTarget({ checkoutGroupId: checkoutGroup.id });
  return reconcilePayOSAttempt({ attempt, attemptsRepository, getPaymentInfo, preorderBridge });
}

