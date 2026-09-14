import paymentAttemptsRepository from '../repositories/postgres/payment-attempts.js';
import { getPaymentLinkInformation, classifyPayOSPaymentStatus } from './payos.js';
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
  bypassThrottle = false,
} = {}) {
  if (!attempt || attempt.provider !== 'payos'
    || !['active', 'expired', 'superseded'].includes(attempt.status)
    || attempt.provider_order_code == null) {
    return { outcome: 'skipped', changed: false, skipped: true };
  }

  const throttleKey = `${attempt.payment_profile_code}:${attempt.provider_order_code}`;
  const now = Date.now();
  const lastCheck = lastChecks.get(throttleKey) || 0;
  if (!bypassThrottle && (now - lastCheck < CHECK_INTERVAL_MS)) {
    return { outcome: 'skipped', changed: false, skipped: true };
  }
  lastChecks.set(throttleKey, now);

  let payosInfo = null;
  try {
    payosInfo = await getPaymentInfo(
      attempt.provider_order_code,
      attempt.provider_payment_link_id,
      attempt.payment_profile_code,
    );
  } catch (error) {
    return { outcome: 'provider_uncertain', changed: false, skipped: false, error };
  }

  if (!payosInfo || typeof payosInfo !== 'object') {
    return { outcome: 'provider_uncertain', changed: false, skipped: false };
  }

  // Recovery code 101 keeps its narrow meaning for a newly reserved provider code
  // and must not be used as cancellation evidence for an already-active attempt.
  if (payosInfo.code === '101' || payosInfo.code === 101) {
    return { outcome: 'provider_uncertain', changed: false, skipped: false };
  }

  const classifiedStatus = classifyPayOSPaymentStatus(payosInfo);

  // 1) Handle Terminal Unpaid (CANCELLED, CANCELED, EXPIRED)
  if (classifiedStatus === 'terminal_unpaid') {
    if (attempt.status === 'active') {
      const closeResult = typeof attemptsRepository.expireAttemptFromProviderTerminalState === 'function'
        ? await attemptsRepository.expireAttemptFromProviderTerminalState({
            attemptId: attempt.id,
            providerStatus: payosInfo?.status,
          })
        : typeof attemptsRepository.expireAttemptFromProvider === 'function'
          ? await attemptsRepository.expireAttemptFromProvider({
              attemptId: attempt.id,
              providerStatus: payosInfo?.status,
            })
          : null;

      if (closeResult?.changed) {
        if (preorderBridge && typeof preorderBridge.onPaymentExpired === 'function') {
          await preorderBridge.onPaymentExpired({
            orderId: attempt.order_id,
            checkoutGroupId: attempt.checkout_group_id,
          });
        }
        return {
          outcome: 'terminal_unpaid',
          changed: true,
          result: { kind: 'expired', attempt: closeResult.attempt },
          attempt: closeResult.attempt,
        };
      }
    }
    return { outcome: 'terminal_unpaid', changed: false, skipped: false, attempt };
  }

  // 2) Handle PAID Settlement
  if (classifiedStatus === 'paid') {
    const amount = Number(payosInfo?.amountPaid ?? payosInfo?.amount);
    if (!Number.isFinite(amount)
      || Math.round(amount) !== Math.round(Number(attempt.amount))) {
      return { outcome: 'provider_uncertain', changed: false, skipped: false };
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
    return {
      outcome: 'paid',
      changed: result?.kind === 'paid' || result?.kind === 'already_paid',
      result,
      attempt,
    };
  }

  // 3) Handle Provider Pending with usable current-link identity
  const hasUsableIdentity = Boolean(
    (payosInfo.id || payosInfo.paymentLinkId || payosInfo.orderCode === attempt.provider_order_code)
    && (payosInfo.checkoutUrl || payosInfo.qrCode || attempt.checkout_url || attempt.qr_code)
  );

  if (hasUsableIdentity) {
    return {
      outcome: 'provider_pending',
      changed: false,
      skipped: false,
      attempt,
      payment: payosInfo,
    };
  }

  // Any non-terminal status without usable identity or unexpected shape is uncertain
  return { outcome: 'provider_uncertain', changed: false, skipped: false };
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
  bypassThrottle = false,
} = {}) {
  if (!order || !order.id || order.payment_provider !== 'payos'
    || !['unpaid', 'expired'].includes(order.payment_status)) {
    return { outcome: 'skipped', changed: false, skipped: true };
  }
  const attempt = await attemptsRepository.findCurrentAttemptForTarget({ orderId: order.id });
  return reconcilePayOSAttempt({ attempt, attemptsRepository, getPaymentInfo, preorderBridge, bypassThrottle });
}

export async function reconcilePayOSCheckoutGroup({
  checkoutGroup,
  attemptsRepository = paymentAttemptsRepository,
  getPaymentInfo = getPaymentLinkInformation,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
  bypassThrottle = false,
} = {}) {
  if (!checkoutGroup || !checkoutGroup.id || checkoutGroup.payment_provider !== 'payos'
    || !['unpaid', 'expired'].includes(checkoutGroup.payment_status)) {
    return { outcome: 'skipped', changed: false, skipped: true };
  }
  const attempt = await attemptsRepository.findCurrentAttemptForTarget({ checkoutGroupId: checkoutGroup.id });
  return reconcilePayOSAttempt({ attempt, attemptsRepository, getPaymentInfo, preorderBridge, bypassThrottle });
}

