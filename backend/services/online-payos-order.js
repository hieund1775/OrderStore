import crypto from 'node:crypto';
import ordersRepository from '../repositories/postgres/orders.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import { createPaymentLinkForOrder } from './payos.js';
import { hashOrderRequest } from './order-idempotency.js';

function makePayOSCode(orderId) {
  return Number(`${String(Date.now()).slice(-6)}${String(Number(orderId) % 10000).padStart(4, '0')}`);
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
  if (reserved.payment_link_id) return { ...order, payment_link_id: reserved.payment_link_id, payment_expires_at: reserved.payment_expires_at };
  const link = await createPaymentLinkForOrder({
    orderId: order.id, orderCode: order.order_code, total: order.total,
    payosOrderCode: reserved.payos_order_code, paymentExpiresAt: reserved.payment_expires_at,
    returnUrl: input.return_url, cancelUrl: input.cancel_url,
  });
  const payment = await paymentsRepository.attachPaymentLink({
    orderId: order.id, paymentLinkId: link.paymentLinkId, payosOrderCode: reserved.payos_order_code,
    paymentExpiresAt: reserved.payment_expires_at,
  });
  return { ...order, checkout_url: link.checkoutUrl, qr_code: link.qrCode, payment_link_id: payment.payment_link_id, payos_order_code: payment.payos_order_code, payment_expires_at: payment.payment_expires_at };
}
