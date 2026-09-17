import paymentAttemptsRepository from '../repositories/postgres/payment-attempts.js';
import ordersRepository from '../repositories/postgres/orders.js';
import preorderService from './preorders/preorder-service.js';

/**
 * Provider-neutral settlement core that performs canonical settlement
 * via paymentAttemptsRepository.processSuccessfulAttemptEvent and triggers
 * the preorder bridge projection exactly once on successful/idempotent settlement.
 *
 * It does NOT contain provider-specific webhook/signature logic or UI logic.
 */
export async function settleVerifiedAttemptEvent({
  attempt,
  provider,
  providerPaymentIdentity,
  amount,
  reference = null,
  paymentLinkId = null,
  payload = null,
  attemptsRepository = paymentAttemptsRepository,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
  orderFulfillmentBridge = attemptsRepository === paymentAttemptsRepository ? ordersRepository : null,
} = {}) {
  if (!attempt?.id || !provider || !providerPaymentIdentity || !Number.isFinite(amount)) {
    return { kind: 'invalid_payload' };
  }

  const settled = await attemptsRepository.processSuccessfulAttemptEvent({
    attemptId: attempt.id,
    provider,
    providerPaymentIdentity,
    amount,
    reference,
    paymentLinkId,
    payload,
  });

  if (
    preorderBridge &&
    typeof preorderBridge.onPaymentSettled === 'function' &&
    ['paid', 'duplicate', 'already_paid'].includes(settled?.kind)
  ) {
    await preorderBridge.onPaymentSettled({
      orderId: attempt.order_id,
      checkoutGroupId: attempt.checkout_group_id,
      late: ['expired', 'superseded'].includes(attempt.status),
    });
  }

  if (
    orderFulfillmentBridge
    && typeof orderFulfillmentBridge.activateFulfillmentAfterPayment === 'function'
    && ['paid', 'duplicate', 'already_paid'].includes(settled?.kind)
  ) {
    await orderFulfillmentBridge.activateFulfillmentAfterPayment({
      orderId: attempt.order_id,
      checkoutGroupId: attempt.checkout_group_id,
    });
  }

  return settled;
}

export default {
  settleVerifiedAttemptEvent,
};
