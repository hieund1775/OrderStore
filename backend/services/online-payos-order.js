import crypto from 'node:crypto';
import ordersRepository from '../repositories/postgres/orders.js';
import { hashOrderRequest } from './order-idempotency.js';
import config from '../config/env.js';
import directPayOSAttemptService from './direct-payos-attempt.js';

export function appendOrderCodeToUrl(baseUrlString, code) {
  if (!baseUrlString || typeof baseUrlString !== 'string') return null;
  try {
    const url = new URL(baseUrlString);
    url.searchParams.set('code', code);
    return url.toString();
  } catch {
    return null;
  }
}

function buildSafePayOSRedirectUrl(requestedUrl, fallbackUrl, orderCode) {
  const candidate = requestedUrl || fallbackUrl;
  const fallback = fallbackUrl || candidate;
  let candidateUrl;
  let fallbackUrlObject;
  try {
    candidateUrl = new URL(candidate);
    fallbackUrlObject = new URL(fallback);
  } catch {
    const error = new Error('URL chuyển hướng PayOS không hợp lệ');
    error.status = 400;
    throw error;
  }

  const allowedOrigins = new Set(config.allowedOrigins);
  allowedOrigins.add(fallbackUrlObject.origin);
  if (!allowedOrigins.has(candidateUrl.origin)) {
    const error = new Error('URL chuyển hướng PayOS không được cho phép');
    error.status = 400;
    throw error;
  }

  return appendOrderCodeToUrl(candidateUrl.toString(), orderCode);
}

export async function createOnlinePayOSOrder({
  input,
  userId,
  cancelTokenHash,
  cancelToken,
  idempotencyKey,
  rootCategoryId = null,
  paymentProfile = null,
}) {
  const requestHash = hashOrderRequest(input);
  let rawCancelToken = cancelToken;
  let tokenHash = cancelTokenHash;
  if (!userId && !rawCancelToken) {
    rawCancelToken = crypto.randomBytes(32).toString('hex');
    tokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
  }
  const order = await ordersRepository.createPublicOrder({
    input,
    userId,
    cancelTokenHash: tokenHash,
    cancelToken: rawCancelToken,
    idempotencyKey,
    requestHash,
    paymentProvider: 'payos',
    rootCategoryId,
    paymentProfile,
  });
  const effectiveReturnUrl = buildSafePayOSRedirectUrl(input.return_url, config.payos.returnUrl, order.order_code);
  const effectiveCancelUrl = buildSafePayOSRedirectUrl(input.cancel_url, config.payos.cancelUrl, order.order_code);
  const payment = await directPayOSAttemptService.createForOrder({
    order,
    paymentProfile,
    returnUrl: effectiveReturnUrl,
    cancelUrl: effectiveCancelUrl,
  });
  return {
    ...order,
    checkout_url: payment.payment_checkout_url,
    qr_code: payment.payment_qr_code,
    payment_link_id: payment.payment_link_id,
    payos_order_code: payment.payos_order_code,
    payment_expires_at: payment.payment_expires_at,
  };
}
