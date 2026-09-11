import paymentAttemptsRepository from '../repositories/postgres/payment-attempts.js';
import { verifyWebhookData } from './payos.js';
import {
  buildPayOSProviderPaymentIdentity,
  doesPayOSDataMatchAttempt,
  extractPayOSIdentifiers,
} from './payment-attempt-provider-identity.js';
import preorderService from './preorders/preorder-service.js';

export async function resolveVerifiedPayOSAttempt({
  body,
  attemptsRepository = paymentAttemptsRepository,
  verifyWebhook = verifyWebhookData,
} = {}) {
  const raw = extractPayOSIdentifiers(body);
  if (raw.orderCode == null && !raw.paymentLinkId) return { kind: 'not_found' };

  const candidates = await attemptsRepository.findAttemptsByProviderIdentifiers({
    provider: 'payos',
    providerOrderCode: raw.orderCode,
    paymentLinkId: raw.paymentLinkId,
  });
  if (!candidates.length) return { kind: 'not_found' };

  const verified = [];
  for (const attempt of candidates) {
    try {
      const data = await verifyWebhook(body, { profileCode: attempt.payment_profile_code });
      if (!doesPayOSDataMatchAttempt(data, attempt)) continue;
      verified.push({ attempt, data });
    } catch {
      // Candidate lookup is intentionally untrusted. A signature is accepted
      // only after exactly one snapshot profile verifies it.
    }
  }
  if (verified.length === 0) return { kind: 'signature_invalid' };
  if (verified.length !== 1) return { kind: 'ambiguous', candidateCount: verified.length };
  return { kind: 'resolved', ...verified[0] };
}

export async function settleVerifiedPayOSAttempt({
  attempt,
  data,
  attemptsRepository = paymentAttemptsRepository,
  payload = data,
} = {}) {
  const { orderCode, paymentLinkId, reference } = extractPayOSIdentifiers(data);
  const amount = Number(data?.amount);
  const providerPaymentIdentity = buildPayOSProviderPaymentIdentity({ reference, paymentLinkId, orderCode });
  if (!providerPaymentIdentity || !Number.isFinite(amount)) {
    return { kind: 'invalid_payload' };
  }
  return attemptsRepository.processSuccessfulAttemptEvent({
    attemptId: attempt.id,
    provider: 'payos',
    providerPaymentIdentity,
    amount,
    reference,
    paymentLinkId,
    payload,
  });
}

export async function processPayOSWebhookWithAttempts({
  body,
  attemptsRepository = paymentAttemptsRepository,
  verifyWebhook = verifyWebhookData,
  preorderBridge = attemptsRepository === paymentAttemptsRepository ? preorderService : null,
} = {}) {
  const resolution = await resolveVerifiedPayOSAttempt({ body, attemptsRepository, verifyWebhook });
  if (resolution.kind !== 'resolved') return resolution;
  const { code } = resolution.data || {};
  if (code !== '00') return { kind: 'not_successful', attempt: resolution.attempt, data: resolution.data };
  const settled = await settleVerifiedPayOSAttempt({
    attempt: resolution.attempt,
    data: resolution.data,
    attemptsRepository,
    payload: resolution.data,
  });
  // Payment attempts remain the source of truth. The preorder bridge is an
  // idempotent post-settlement projection and never changes P1 state.
  if (preorderBridge && ['paid', 'duplicate', 'already_paid'].includes(settled.kind)) {
    await preorderBridge.onPaymentSettled({
      orderId: resolution.attempt.order_id,
      checkoutGroupId: resolution.attempt.checkout_group_id,
      late: ['expired', 'superseded'].includes(resolution.attempt.status),
    });
  }
  return settled;
}
