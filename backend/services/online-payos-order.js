import crypto from 'node:crypto';
import ordersRepository from '../repositories/postgres/orders.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import { createPaymentLinkForOrder } from './payos.js';
import { hashOrderRequest } from './order-idempotency.js';

function makePayOSCode(orderId) {
  return Number(`${String(Date.now()).slice(-6)}${String(Number(orderId) % 10000).padStart(4, '0')}`);
}

export function appendOrderCodeToUrl(baseUrlString, code) {
  if (!baseUrlString || typeof baseUrlString !== 'string') return null;
  try {
    const url = new URL(baseUrlString);
    url.searchParams.set('code', code);
    return url.toString();
  } catch {
    return baseUrlString.includes('?') ? `${baseUrlString}&code=${encodeURIComponent(code)}` : `${baseUrlString}?code=${encodeURIComponent(code)}`;
  }
}

export async function createOnlinePayOSOrder({ input, userId, cancelTokenHash, cancelToken, idempotencyKey }) {
  const requestHash = hashOrderRequest(input);
  let rawCancelToken = cancelToken;
  let tokenHash = cancelTokenHash;
  if (!userId && !rawCancelToken) {
    rawCancelToken = crypto.randomBytes(32).toString('hex');
    tokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
  }
  const order = await ordersRepository.createPublicOrder({
    input, userId, cancelTokenHash: tokenHash, cancelToken: rawCancelToken, idempotencyKey, requestHash, paymentProvider: 'payos',
  });
  const expiresAt = new Date(Date.now() + Number(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || 15) * 60_000);
  const reserved = await paymentsRepository.reservePayOSOrder({
    orderId: order.id,
    payosOrderCode: makePayOSCode(order.id),
    paymentExpiresAt: expiresAt,
  });
  if (!reserved) throw new Error('Không thể khởi tạo thanh toán PayOS');
  if (reserved.payment_link_id) {
    if (!reserved.payment_checkout_url && !reserved.payment_qr_code) {
      const error = new Error('PayOS đã có liên kết nhưng thiếu mã QR thanh toán, vui lòng thử lại');
      error.status = 502;
      throw error;
    }
    return {
      ...order,
      checkout_url: reserved.payment_checkout_url,
      qr_code: reserved.payment_qr_code,
      payment_link_id: reserved.payment_link_id,
      payos_order_code: reserved.payos_order_code,
      payment_expires_at: reserved.payment_expires_at,
    };
  }

  const effectiveReturnUrl = appendOrderCodeToUrl(input.return_url, order.order_code) || input.return_url;
  const effectiveCancelUrl = appendOrderCodeToUrl(input.cancel_url, order.order_code) || input.cancel_url;

  const link = await createPaymentLinkForOrder({
    orderId: order.id,
    orderCode: order.order_code,
    total: order.total,
    payosOrderCode: reserved.payos_order_code,
    paymentExpiresAt: reserved.payment_expires_at,
    returnUrl: effectiveReturnUrl,
    cancelUrl: effectiveCancelUrl,
  });
  if (!link.checkoutUrl && !link.qrCode) {
    const error = new Error('PayOS không trả về mã QR thanh toán');
    error.status = 502;
    throw error;
  }
  const payment = await paymentsRepository.attachPaymentLink({
    orderId: order.id, paymentLinkId: link.paymentLinkId, payosOrderCode: reserved.payos_order_code,
    paymentExpiresAt: reserved.payment_expires_at, checkoutUrl: link.checkoutUrl, qrCode: link.qrCode,
  });
  if (!payment) {
    const error = new Error('Không thể lưu liên kết thanh toán PayOS');
    error.status = 502;
    throw error;
  }
  return { ...order, checkout_url: link.checkoutUrl, qr_code: link.qrCode, payment_link_id: payment.payment_link_id, payos_order_code: payment.payos_order_code, payment_expires_at: payment.payment_expires_at };
}
