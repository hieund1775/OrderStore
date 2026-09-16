import crypto from 'node:crypto';
import paymentAttemptsRepository, { PaymentAttemptError } from '../repositories/postgres/payment-attempts.js';
import checkoutGroupsRepository, { verifyGroupOwnership } from '../repositories/postgres/checkout-groups.js';
import { settleVerifiedAttemptEvent } from './payment-attempt-settlement-core.js';
import preorderService from './preorders/preorder-service.js';

function makeReservedSandboxOrderCode() {
  const timePart = String(Date.now()).slice(-8);
  const entropy = String(crypto.randomInt(100000, 1_000_000));
  return Number(`${timePart}${entropy}`);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '').trim()).digest('hex');
}

function assertRegenerationOwner(order, { userId = null, cancelToken = null } = {}) {
  if (!order) {
    throw new PaymentAttemptError('Không tìm thấy đơn hàng', 404, 'ORDER_NOT_FOUND');
  }
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

function artifactFromAttempt(target, attempt) {
  const isGroup = target.target_type === 'checkout_group' || Boolean(target.group_code);
  return {
    id: target.id,
    order_code: isGroup ? target.group_code : target.order_code,
    group_code: isGroup ? target.group_code : undefined,
    total: Number(isGroup ? target.total_amount : target.total),
    total_amount: isGroup ? Number(target.total_amount) : undefined,
    payment_status: attempt.status === 'paid' ? 'paid' : 'unpaid',
    payment_provider: 'sandbox',
    payment_link_id: attempt.provider_payment_link_id,
    payos_order_code: Number(attempt.provider_order_code),
    payment_checkout_url: attempt.checkout_url,
    payment_qr_code: null,
    payment_expires_at: attempt.expires_at,
  };
}

export function createSandboxPaymentAttemptService({
  attemptsRepository = paymentAttemptsRepository,
  checkoutGroupsRepo = checkoutGroupsRepository,
  settleAttemptEvent = settleVerifiedAttemptEvent,
  preorderBridge = preorderService,
  now = () => new Date(),
  makeProviderOrderCode = makeReservedSandboxOrderCode,
} = {}) {
  function getTimeoutMinutes() {
    return Number(
      process.env.SANDBOX_PAYMENT_TIMEOUT_MINUTES ||
      process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES ||
      15
    );
  }

  async function createForOrder({
    order,
    returnUrl = null,
    cancelUrl = null,
    forceRegenerate = false,
  }) {
    if (!order?.id || !order?.order_code) {
      throw new PaymentAttemptError('Thiếu thông tin đơn hàng', 400, 'PAYMENT_ATTEMPT_ORDER_REQUIRED');
    }

    const expiresAt = new Date(now().getTime() + getTimeoutMinutes() * 60_000);
    const providerOrderCode = makeProviderOrderCode();

    const reserve = await attemptsRepository.reserveOrRecoverCreatingAttempt({
      orderId: order.id,
      paymentProfileCode: order.payment_profile_code || 'DEFAULT',
      paymentProfileVersion: order.payment_profile_version ?? null,
      amount: Number(order.total),
      providerOrderCode,
      expiresAt,
      forceRegenerate,
      provider: 'sandbox',
    });

    if (reserve.kind === 'active') {
      return artifactFromAttempt(order, reserve.attempt);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const checkoutUrl = `/thanh-toan/sandbox?token=${rawToken}`;

    const activated = await attemptsRepository.activateAttempt({
      attemptId: reserve.attempt.id,
      providerOrderCode: reserve.attempt.provider_order_code,
      paymentLinkId: tokenHash,
      checkoutUrl,
      qrCode: null,
      expiresAt: reserve.attempt.expires_at,
    });

    if (activated?.kind === 'target_closed') {
      const code = activated.target?.payment_status === 'paid'
        ? 'PAYMENT_ATTEMPT_TARGET_PAID'
        : 'PAYMENT_ATTEMPT_TARGET_CANCELLED';
      throw new PaymentAttemptError('Đơn hàng đã thanh toán hoặc đã hủy', 409, code);
    }

    return artifactFromAttempt(order, activated);
  }

  async function createForGroup({
    group,
    returnUrl = null,
    cancelUrl = null,
    preorderCode = null,
    forceRegenerate = false,
  }) {
    if (!group?.id || !group?.group_code) {
      throw new PaymentAttemptError('Thiếu thông tin đơn hàng gộp', 400, 'PAYMENT_ATTEMPT_GROUP_REQUIRED');
    }

    const expiresAt = new Date(now().getTime() + getTimeoutMinutes() * 60_000);
    const providerOrderCode = makeProviderOrderCode();

    const reserve = await attemptsRepository.reserveOrRecoverCreatingAttempt({
      checkoutGroupId: group.id,
      paymentProfileCode: group.payment_profile_code || 'DEFAULT',
      paymentProfileVersion: group.payment_profile_version ?? null,
      amount: Number(group.total_amount),
      providerOrderCode,
      expiresAt,
      forceRegenerate,
      provider: 'sandbox',
    });

    if (reserve.kind === 'active') {
      return artifactFromAttempt(group, reserve.attempt);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const checkoutUrl = `/thanh-toan/sandbox?token=${rawToken}`;

    const activated = await attemptsRepository.activateAttempt({
      attemptId: reserve.attempt.id,
      providerOrderCode: reserve.attempt.provider_order_code,
      paymentLinkId: tokenHash,
      checkoutUrl,
      qrCode: null,
      expiresAt: reserve.attempt.expires_at,
    });

    if (activated?.kind === 'target_closed') {
      const code = activated.target?.payment_status === 'paid'
        ? 'PAYMENT_ATTEMPT_TARGET_PAID'
        : 'PAYMENT_ATTEMPT_TARGET_CANCELLED';
      throw new PaymentAttemptError('Đơn hàng gộp đã thanh toán hoặc đã hủy', 409, code);
    }

    return artifactFromAttempt(group, activated);
  }

  async function findSessionByToken(rawToken, { userId = null } = {}) {
    if (!rawToken || typeof rawToken !== 'string') {
      const error = new Error('Thiếu mã token thanh toán');
      error.status = 400;
      error.code = 'SANDBOX_TOKEN_REQUIRED';
      throw error;
    }

    if (!userId) {
      const error = new Error('Vui lòng đăng nhập tài khoản trước khi thanh toán');
      error.status = 401;
      error.code = 'CUSTOMER_AUTH_REQUIRED';
      throw error;
    }

    const tokenHash = hashToken(rawToken);
    const candidates = await attemptsRepository.findAttemptsByProviderIdentifiers({
      provider: 'sandbox',
      paymentLinkId: tokenHash,
    });

    if (!candidates.length) {
      const error = new Error('Không tìm thấy phiên thanh toán sandbox hoặc token không hợp lệ');
      error.status = 404;
      error.code = 'SANDBOX_SESSION_NOT_FOUND';
      throw error;
    }

    const attempt = candidates[0];
    let targetCode = null;
    let target = null;

    if (attempt.target_type === 'order') {
      target = await attemptsRepository.findDirectOrderById(attempt.order_id);
      if (!target) {
        const error = new Error('Không tìm thấy đơn hàng của phiên thanh toán');
        error.status = 404;
        error.code = 'ORDER_NOT_FOUND';
        throw error;
      }
      assertRegenerationOwner(target, { userId });
      targetCode = target.order_code;
    } else if (attempt.target_type === 'checkout_group') {
      target = await checkoutGroupsRepo.findGroupById(attempt.checkout_group_id);
      if (!target) {
        const error = new Error('Không tìm thấy đơn hàng gộp của phiên thanh toán');
        error.status = 404;
        error.code = 'GROUP_NOT_FOUND';
        throw error;
      }
      verifyGroupOwnership(target, { userId });
      targetCode = target.group_code;
    }

    // Check expiry
    if (attempt.status === 'active' && attempt.expires_at && new Date(attempt.expires_at).getTime() < now().getTime()) {
      const expired = await attemptsRepository.expireAttempt({ attemptId: attempt.id });
      attempt.status = expired?.status || 'expired';
    }

    return {
      ok: true,
      payment_code: targetCode,
      order_code: targetCode,
      target_type: attempt.target_type,
      amount: Number(attempt.amount),
      expires_at: attempt.expires_at,
      status: attempt.status,
      payment_provider: 'sandbox',
    };
  }

  async function transferExactAmount({ rawToken, amount, userId = null } = {}) {
    if (!rawToken || typeof rawToken !== 'string') {
      const error = new Error('Thiếu mã token thanh toán');
      error.status = 400;
      error.code = 'SANDBOX_TOKEN_REQUIRED';
      error.expose = true;
      throw error;
    }

    if (!userId) {
      const error = new Error('Vui lòng đăng nhập tài khoản trước khi thanh toán');
      error.status = 401;
      error.code = 'CUSTOMER_AUTH_REQUIRED';
      error.expose = true;
      throw error;
    }

    // Exact amount invariants:
    // - const parsedAmount = Number(amount)
    // - Number.isSafeInteger(parsedAmount)
    // - parsedAmount > 0
    // - parsedAmount === Number(attempt.amount)
    // - Cấm Math.round, parseInt hoặc mọi hình thức làm tròn.
    const parsedAmount = Number(amount);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      const error = new Error('Số tiền chuyển khoản không hợp lệ');
      error.status = 400;
      error.code = 'INVALID_AMOUNT';
      error.expose = true;
      throw error;
    }

    const tokenHash = hashToken(rawToken);
    const candidates = await attemptsRepository.findAttemptsByProviderIdentifiers({
      provider: 'sandbox',
      paymentLinkId: tokenHash,
    });

    if (!candidates.length) {
      const error = new Error('Không tìm thấy phiên thanh toán sandbox');
      error.status = 404;
      error.code = 'SANDBOX_SESSION_NOT_FOUND';
      error.expose = true;
      throw error;
    }

    const attempt = candidates[0];

    // Verify ownership
    let target = null;
    let targetCode = null;
    if (attempt.target_type === 'order') {
      target = await attemptsRepository.findDirectOrderById(attempt.order_id);
      if (!target) {
        const error = new Error('Không tìm thấy đơn hàng của phiên thanh toán');
        error.status = 404;
        error.code = 'ORDER_NOT_FOUND';
        error.expose = true;
        throw error;
      }
      assertRegenerationOwner(target, { userId });
      targetCode = target.order_code;
    } else if (attempt.target_type === 'checkout_group') {
      target = await checkoutGroupsRepo.findGroupById(attempt.checkout_group_id);
      if (!target) {
        const error = new Error('Không tìm thấy đơn hàng gộp của phiên thanh toán');
        error.status = 404;
        error.code = 'GROUP_NOT_FOUND';
        error.expose = true;
        throw error;
      }
      verifyGroupOwnership(target, { userId });
      targetCode = target.group_code;
    }

    // Check terminal statuses
    if (attempt.status === 'paid') {
      return {
        ok: true,
        success: true,
        kind: 'already_paid',
        payment_code: targetCode,
        order_code: targetCode,
        total: parsedAmount,
      };
    }

    if (attempt.status === 'expired') {
      const error = new Error('Mã thanh toán đã hết hạn, vui lòng tạo lại mã');
      error.status = 409;
      error.code = 'SANDBOX_ATTEMPT_EXPIRED';
      error.expose = true;
      throw error;
    }

    if (attempt.status === 'superseded') {
      const error = new Error('Mã thanh toán đã bị thay thế bởi mã mới');
      error.status = 409;
      error.code = 'SANDBOX_ATTEMPT_SUPERSEDED';
      error.expose = true;
      throw error;
    }

    if (attempt.status !== 'active') {
      const error = new Error(`Trạng thái thanh toán không hợp lệ: ${attempt.status}`);
      error.status = 409;
      error.code = 'SANDBOX_ATTEMPT_INVALID_STATUS';
      error.expose = true;
      throw error;
    }

    // Check expiry timestamp
    if (attempt.expires_at && new Date(attempt.expires_at).getTime() < now().getTime()) {
      await attemptsRepository.expireAttempt({ attemptId: attempt.id });
      const error = new Error('Mã thanh toán đã hết hạn, vui lòng tạo lại mã');
      error.status = 409;
      error.code = 'SANDBOX_ATTEMPT_EXPIRED';
      error.expose = true;
      throw error;
    }

    // Exact amount matching
    if (parsedAmount !== Number(attempt.amount)) {
      const error = new Error('Số tiền chuyển khoản không khớp số tiền cần thanh toán');
      error.status = 400;
      error.code = 'AMOUNT_MISMATCH';
      error.expose = true;
      throw error;
    }

    // Canonical settlement
    const providerPaymentIdentity = `sandbox_transfer:${attempt.id}`;
    const settled = await settleAttemptEvent({
      attempt,
      provider: 'sandbox',
      providerPaymentIdentity,
      amount: parsedAmount,
      reference: `SANDBOX_${attempt.id}`,
      paymentLinkId: tokenHash,
      payload: {
        transferred_at: new Date().toISOString(),
        user_id: userId,
      },
      attemptsRepository,
      preorderBridge,
    });

    if (['paid', 'duplicate', 'already_paid'].includes(settled?.kind)) {
      return {
        ok: true,
        success: true,
        kind: settled.kind,
        payment_code: targetCode,
        order_code: targetCode,
        total: parsedAmount,
      };
    }

    if (settled?.kind === 'amount_mismatch') {
      const error = new Error('Số tiền không khớp với thông tin lưu trên hệ thống');
      error.status = 400;
      error.code = 'AMOUNT_MISMATCH';
      error.expose = true;
      throw error;
    }

    if (settled?.kind === 'cancelled') {
      const error = new Error('Đơn hàng đã bị hủy, không thể thanh toán');
      error.status = 409;
      error.code = 'TARGET_CANCELLED';
      error.expose = true;
      throw error;
    }

    const error = new Error(`Thanh toán không thành công: ${settled?.kind || 'unknown'}`);
    error.status = 409;
    error.code = settled?.kind?.toUpperCase() || 'SETTLEMENT_FAILED';
    error.expose = true;
    throw error;
  }

  async function regenerateForCustomer({
    orderCode = null,
    groupCode = null,
    code = null,
    userId = null,
    cancelToken = null,
  } = {}) {
    const targetCode = (code || groupCode || orderCode || '').trim();
    if (!targetCode) {
      throw new PaymentAttemptError('Thiếu mã đơn hàng', 400, 'ORDER_CODE_REQUIRED');
    }

    if (targetCode.startsWith('GRP')) {
      const group = await checkoutGroupsRepo.findGroupByCode(targetCode);
      if (!group) {
        throw new PaymentAttemptError('Không tìm thấy đơn hàng gộp', 404, 'GROUP_NOT_FOUND');
      }
      verifyGroupOwnership(group, { userId, cancelToken });
      return createForGroup({ group, forceRegenerate: true });
    }

    const order = await attemptsRepository.findDirectOrderForRegeneration(targetCode);
    if (!order) {
      throw new PaymentAttemptError('Không tìm thấy đơn hàng', 404, 'ORDER_NOT_FOUND');
    }
    assertRegenerationOwner(order, { userId, cancelToken });
    return createForOrder({ order, forceRegenerate: true });
  }

  async function getStatus({ code, userId = null, cancelToken = null } = {}) {
    const targetCode = String(code || '').trim();
    if (!targetCode) {
      throw new PaymentAttemptError('Thiếu mã đơn hàng', 400, 'ORDER_CODE_REQUIRED');
    }

    if (targetCode.startsWith('GRP')) {
      const group = await checkoutGroupsRepo.findGroupByCode(targetCode);
      if (!group) {
        throw new PaymentAttemptError('Không tìm thấy đơn hàng gộp', 404, 'GROUP_NOT_FOUND');
      }
      verifyGroupOwnership(group, { userId, cancelToken });
      const currentAttempt = group.current_payment_attempt_id
        ? await attemptsRepository.findAttemptById(group.current_payment_attempt_id)
        : null;

      return {
        order_code: group.group_code,
        total: Number(group.total_amount),
        payment_status: group.payment_status,
        payment_provider: 'sandbox',
        payment_checkout_url: group.payment_checkout_url || currentAttempt?.checkout_url || null,
        payment_qr_code: null,
        payment_expires_at: group.payment_expires_at || currentAttempt?.expires_at || null,
        paid_at: group.paid_at || null,
        can_regenerate_qr: ['unpaid', 'expired'].includes(group.payment_status),
      };
    }

    const order = await attemptsRepository.findDirectOrderForRegeneration(targetCode);
    if (!order) {
      throw new PaymentAttemptError('Không tìm thấy đơn hàng', 404, 'ORDER_NOT_FOUND');
    }
    assertRegenerationOwner(order, { userId, cancelToken });
    const currentAttempt = order.current_payment_attempt_id
      ? await attemptsRepository.findAttemptById(order.current_payment_attempt_id)
      : null;

    const canRegenerate = Boolean(
      ['unpaid', 'expired'].includes(order.payment_status) &&
      order.current_status !== 'Đã hủy' &&
      order.current_status !== 'Hoàn thành'
    );

    return {
      order_code: order.order_code,
      total: Number(order.total),
      payment_status: order.payment_status,
      payment_provider: 'sandbox',
      payment_checkout_url: order.payment_checkout_url || currentAttempt?.checkout_url || null,
      payment_qr_code: null,
      payment_expires_at: order.payment_expires_at || currentAttempt?.expires_at || null,
      paid_at: order.paid_at || null,
      can_regenerate_qr: canRegenerate,
    };
  }

  return {
    createForOrder,
    createForGroup,
    findSessionByToken,
    transferExactAmount,
    regenerateForCustomer,
    getStatus,
  };
}

export const sandboxPaymentAttemptService = createSandboxPaymentAttemptService();
export default sandboxPaymentAttemptService;
