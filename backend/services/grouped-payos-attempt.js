import crypto from 'node:crypto';
import config from '../config/env.js';
import { withDedicatedAdvisoryLock } from '../config/db-postgres.js';
import paymentAttemptsRepository, { PaymentAttemptError } from '../repositories/postgres/payment-attempts.js';
import checkoutGroupsRepository, { verifyGroupOwnership } from '../repositories/postgres/checkout-groups.js';
import { createPaymentLinkForOrder, lookupPaymentLinkForRecovery } from './payos.js';

function makeReservedPayOSOrderCode() {
  return Number(`${String(Date.now()).slice(-8)}${String(crypto.randomInt(100000, 1_000_000))}`);
}

function groupIsCancelled(group) {
  return group?.payment_status === 'cancelled';
}

function artifactFromAttempt(group, attempt) {
  return {
    id: group.id,
    group_code: group.group_code,
    total_amount: Number(group.total_amount),
    payment_status: attempt.status === 'paid' ? 'paid' : 'unpaid',
    payment_provider: attempt.provider,
    payment_link_id: attempt.provider_payment_link_id,
    payos_order_code: Number(attempt.provider_order_code),
    payment_checkout_url: attempt.checkout_url,
    payment_qr_code: attempt.qr_code,
    payment_expires_at: attempt.expires_at,
  };
}

function normalizeRecoveredPayOSLink(payment, attempt) {
  const paymentLinkId = payment?.paymentLinkId || payment?.id || payment?.linkId || attempt.provider_payment_link_id;
  const checkoutUrl = payment?.checkoutUrl || payment?.checkout_url || attempt.checkout_url || null;
  const qrCode = payment?.qrCode || payment?.qr_code || attempt.qr_code || null;
  if (!paymentLinkId || (!checkoutUrl && !qrCode)) {
    throw new PaymentAttemptError('PayOS tìm thấy liên kết nhưng thiếu artifact để khôi phục', 502, 'PAYMENT_ATTEMPT_RECOVERY_INCOMPLETE');
  }
  return { paymentLinkId, checkoutUrl, qrCode };
}

function uncertainProviderError() {
  return new PaymentAttemptError(
    'Chưa xác định được trạng thái PayOS; mã đang được giữ để thử lại an toàn',
    502,
    'PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN',
  );
}

export function createGroupedPayOSAttemptService({
  attemptsRepository = paymentAttemptsRepository,
  groupsRepository = checkoutGroupsRepository,
  createPaymentLink = createPaymentLinkForOrder,
  lookupPaymentLink = lookupPaymentLinkForRecovery,
  withCreationLock = withDedicatedAdvisoryLock,
  now = () => new Date(),
  makeProviderOrderCode = makeReservedPayOSOrderCode,
} = {}) {
  async function reserve({ group, forceRegenerate }) {
    const expiresAt = new Date(now().getTime() + Number(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || 15) * 60_000);
    return attemptsRepository.reserveOrRecoverCreatingAttempt({
      checkoutGroupId: group.id,
      paymentProfileCode: group.payment_profile_code,
      paymentProfileVersion: group.payment_profile_version ?? null,
      amount: Number(group.total_amount),
      providerOrderCode: makeProviderOrderCode(),
      expiresAt,
      forceRegenerate,
    });
  }

  async function promote({ group, attempt, returnUrl, cancelUrl }) {
    const lookup = await lookupPaymentLink(attempt.provider_order_code, attempt.payment_profile_code);
    let artifact;
    if (lookup.kind === 'found') {
      artifact = normalizeRecoveredPayOSLink(lookup.payment, attempt);
    } else if (lookup.kind === 'not_found') {
      const link = await createPaymentLink({
        orderId: group.id,
        orderCode: group.group_code,
        total: Number(group.total_amount),
        payosOrderCode: attempt.provider_order_code,
        attemptExpiresAt: attempt.expires_at,
        returnUrl: returnUrl || config.payos.returnUrl,
        cancelUrl: cancelUrl || config.payos.cancelUrl,
        paymentProfileCode: attempt.payment_profile_code,
      });
      if (!link?.paymentLinkId || (!link.checkoutUrl && !link.qrCode)) {
        throw new PaymentAttemptError('PayOS không trả về mã QR thanh toán', 502, 'PAYMENT_ATTEMPT_CREATE_INCOMPLETE');
      }
      artifact = { paymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl, qrCode: link.qrCode };
    } else {
      throw uncertainProviderError();
    }

    const activated = await attemptsRepository.activateAttempt({
      attemptId: attempt.id,
      providerOrderCode: attempt.provider_order_code,
      paymentLinkId: artifact.paymentLinkId,
      checkoutUrl: artifact.checkoutUrl,
      qrCode: artifact.qrCode,
      expiresAt: attempt.expires_at,
    });
    if (activated?.kind === 'target_closed') {
      const code = activated.target?.payment_status === 'paid'
        ? 'PAYMENT_ATTEMPT_TARGET_PAID'
        : 'PAYMENT_ATTEMPT_TARGET_CANCELLED';
      throw new PaymentAttemptError('Đơn gộp đã thanh toán hoặc đã hủy khi PayOS đang tạo QR', 409, code);
    }
    return artifactFromAttempt(group, activated);
  }

  async function createOrRegenerate({ group, forceRegenerate = false, returnUrl = null, cancelUrl = null }) {
    if (!group?.id || !group?.group_code) {
      throw new PaymentAttemptError('Thiếu thông tin đơn gộp PayOS', 400, 'PAYMENT_ATTEMPT_GROUP_REQUIRED');
    }
    if (!group.payment_profile_code) {
      throw new PaymentAttemptError('Thiếu payment profile snapshot', 409, 'PAYMENT_ATTEMPT_PROFILE_REQUIRED');
    }
    if (group.payment_status === 'paid') {
      throw new PaymentAttemptError('Đơn gộp đã được thanh toán thành công', 409, 'PAYMENT_ATTEMPT_TARGET_PAID');
    }
    if (groupIsCancelled(group)) {
      throw new PaymentAttemptError('Đơn gộp đã bị hủy, không thể tạo lại mã thanh toán', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
    }

    const initial = await reserve({ group, forceRegenerate });
    if (initial.kind === 'active') return artifactFromAttempt(group, initial.attempt);

    const lockKey = `payos-group-attempt:group:${group.id}`;
    const locked = await withCreationLock(lockKey, async () => {
      const current = await reserve({ group, forceRegenerate: initial.recovered ? false : forceRegenerate });
      if (current.kind === 'active') return artifactFromAttempt(group, current.attempt);
      return promote({ group, attempt: current.attempt, returnUrl, cancelUrl });
    });

    if (locked?.acquired === false) {
      const attempts = await attemptsRepository.findAttemptsByTarget({ checkoutGroupId: group.id });
      const currentActive = attempts.find((attempt) => attempt.status === 'active'
        && attempt.provider_payment_link_id && (attempt.checkout_url || attempt.qr_code));
      if (currentActive) return artifactFromAttempt(group, currentActive);
      throw new PaymentAttemptError('Mã thanh toán đang được tạo, vui lòng thử lại', 409, 'PAYMENT_ATTEMPT_CREATING');
    }
    return locked;
  }

  return {
    async createForGroup({ group, returnUrl = null, cancelUrl = null }) {
      return createOrRegenerate({ group, returnUrl, cancelUrl });
    },

    async regenerateForCustomer({ groupCode, userId = null, cancelToken = null, returnUrl = null, cancelUrl = null }) {
      const group = await groupsRepository.findGroupByCode(groupCode);
      verifyGroupOwnership(group, { userId, cancelToken });
      return createOrRegenerate({ group, forceRegenerate: true, returnUrl, cancelUrl });
    },
  };
}

export const groupedPayOSAttemptService = createGroupedPayOSAttemptService();
export default groupedPayOSAttemptService;
