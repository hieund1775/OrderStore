import crypto from 'node:crypto';
import { PaymentAttemptError } from '../repositories/postgres/payment-attempts.js';

/**
 * Confirms that a customer owns a direct-order payment target.  Both payment
 * providers use this exact rule so a provider switch cannot drift ownership
 * behaviour between regeneration, status, and settlement paths.
 */
export function assertDirectOrderPaymentOwnership(order, { userId = null, cancelToken = null } = {}) {
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
