import crypto from 'node:crypto';
import config from '../config/env.js';
import { withDedicatedAdvisoryLock } from '../config/db-postgres.js';
import paymentAttemptsRepository, { PaymentAttemptError } from '../repositories/postgres/payment-attempts.js';
import { createPaymentLinkForOrder, lookupPaymentLinkForRecovery } from './payos.js';

function makeReservedPayOSOrderCode() {
  // 14 digits stays inside JavaScript safe-integer range and is reserved once
  // on the immutable attempt. Retries never generate another code.
  const timePart = String(Date.now()).slice(-8);
  const entropy = String(crypto.randomInt(100000, 1_000_000));
  return Number(`${timePart}${entropy}`);
}

function isCancelled(target) {
  return target?.payment_status === 'cancelled' || target?.current_status === 'Đã hủy';
}

function assertRegenerationOwner(order, { userId = null, cancelToken = null }) {
  const userMatches = userId != null && Number(order.user_id) === Number(userId);
  const tokenMatches = (() => {
    if (!cancelToken || typeof cancelToken !== 'string' || !order.cancel_token_hash) return false;
    const provided = crypto.createHash('sha256').update(cancelToken).digest();
    const stored = Buffer.from(String(order.cancel_token_hash).trim(), 'hex');
    return provided.length === stored.length && crypto.timingSafeEqual(provided, stored);
  })();
  if (!userMatches && !tokenMatches) {
    throw new PaymentAttemptError('Bạn không có quyền thao tác trên đơn hàng này', 403, 'PAYMENT_ATTEMPT_FORBIDDEN');
  }
}

function artifactFromAttempt(order, attempt) {
  return {
    id: order.id,
    order_code: order.order_code,
    total: Number(order.total),
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

export function createDirectPayOSAttemptService({
  attemptsRepository = paymentAttemptsRepository,
  createPaymentLink = createPaymentLinkForOrder,
  lookupPaymentLink = lookupPaymentLinkForRecovery,
  withCreationLock = withDedicatedAdvisoryLock,
  now = () => new Date(),
  makeProviderOrderCode = makeReservedPayOSOrderCode,
} = {}) {
  async function reserve({ order, paymentProfileCode, paymentProfileVersion = null, forceRegenerate }) {
    const expiresAt = new Date(now().getTime() + Number(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || 15) * 60_000);
    return attemptsRepository.reserveOrRecoverCreatingAttempt({
      orderId: order.id,
      paymentProfileCode,
      paymentProfileVersion,
      amount: Number(order.total),
      providerOrderCode: makeProviderOrderCode(),
      expiresAt,
      forceRegenerate,
    });
  }

  async function promote({ order, attempt, paymentProfileCode, returnUrl, cancelUrl }) {
    const lookup = await lookupPaymentLink(attempt.provider_order_code, paymentProfileCode);
    let artifact;
    if (lookup.kind === 'found') {
      artifact = normalizeRecoveredPayOSLink(lookup.payment, attempt);
    } else if (lookup.kind === 'not_found') {
      const link = await createPaymentLink({
        orderId: order.id,
        orderCode: order.order_code,
        total: Number(order.total),
        payosOrderCode: attempt.provider_order_code,
        attemptExpiresAt: attempt.expires_at,
        returnUrl: returnUrl || config.payos.returnUrl,
        cancelUrl: cancelUrl || config.payos.cancelUrl,
        paymentProfileCode,
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
      throw new PaymentAttemptError('Đơn hàng đã thanh toán hoặc đã hủy khi PayOS đang tạo QR', 409, code);
    }
    return artifactFromAttempt(order, activated);
  }

  async function createOrRegenerate({
    order,
    paymentProfileCode = order.payment_profile_code,
    paymentProfileVersion = order.payment_profile_version ?? null,
    forceRegenerate = false,
    returnUrl = null,
    cancelUrl = null,
  }) {
    if (!order?.id || !order?.order_code) {
      throw new PaymentAttemptError('Thiếu thông tin đơn hàng PayOS', 400, 'PAYMENT_ATTEMPT_ORDER_REQUIRED');
    }
    if (!paymentProfileCode) {
      throw new PaymentAttemptError('Thiếu payment profile snapshot', 409, 'PAYMENT_ATTEMPT_PROFILE_REQUIRED');
    }
    if (order.checkout_group_id != null) {
      throw new PaymentAttemptError('Don con trong thanh toan gop khong co QR rieng', 409, 'GROUP_CHILD_PAYMENT_MANAGED_BY_GROUP');
    }
    if (order.payment_status === 'paid') {
      throw new PaymentAttemptError('Đơn hàng đã được thanh toán thành công', 409, 'PAYMENT_ATTEMPT_TARGET_PAID');
    }
    if (isCancelled(order)) {
      throw new PaymentAttemptError('Đơn hàng đã bị hủy, không thể tạo lại mã thanh toán', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
    }

    const initial = await reserve({ order, paymentProfileCode, paymentProfileVersion, forceRegenerate });
    if (initial.kind === 'active') return artifactFromAttempt(order, initial.attempt);

    const lockKey = `payos-direct-attempt:order:${order.id}`;
    const locked = await withCreationLock(lockKey, async () => {
      // Re-read after acquiring the session lock. A concurrent request may
      // already have created/activated the same attempt while this waited.
      const current = await reserve({
        order,
        paymentProfileCode,
        paymentProfileVersion,
        forceRegenerate: initial.recovered ? false : forceRegenerate,
      });
      if (current.kind === 'active') return artifactFromAttempt(order, current.attempt);
      return promote({
        order,
        attempt: current.attempt,
        paymentProfileCode: current.attempt.payment_profile_code,
        returnUrl,
        cancelUrl,
      });
    });

    if (locked?.acquired === false) {
      const attempts = await attemptsRepository.findAttemptsByTarget({ orderId: order.id });
      const currentActive = attempts.find((attempt) => attempt.status === 'active'
        && attempt.provider_payment_link_id && (attempt.checkout_url || attempt.qr_code));
      if (currentActive) return artifactFromAttempt(order, currentActive);
      throw new PaymentAttemptError('Mã thanh toán đang được tạo, vui lòng thử lại', 409, 'PAYMENT_ATTEMPT_CREATING');
    }
    return locked;
  }

  return {
    async createForOrder({ order, paymentProfile = null, returnUrl = null, cancelUrl = null }) {
      return createOrRegenerate({
        order,
        paymentProfileCode: paymentProfile?.code || order.payment_profile_code,
        paymentProfileVersion: paymentProfile?.version ?? order.payment_profile_version ?? null,
        returnUrl,
        cancelUrl,
      });
    },

    async regenerateForCustomer({ orderCode, userId = null, cancelToken = null, returnUrl = null, cancelUrl = null }) {
      const order = await attemptsRepository.findDirectOrderForRegeneration(orderCode);
      if (!order) throw new PaymentAttemptError('Không tìm thấy đơn hàng', 404, 'PAYMENT_ATTEMPT_TARGET_NOT_FOUND');
      assertRegenerationOwner(order, { userId, cancelToken });
      return createOrRegenerate({ order, forceRegenerate: true, returnUrl, cancelUrl });
    },
  };
}

export const directPayOSAttemptService = createDirectPayOSAttemptService();
export default directPayOSAttemptService;
