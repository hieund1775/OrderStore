import crypto from 'node:crypto';
import ordersRepository from '../repositories/postgres/orders.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import { createPaymentLinkForOrder } from './payos.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function makePayOSCode(orderId) {
  return Number(`${String(Date.now()).slice(-6)}${String(Number(orderId) % 10000).padStart(4, '0')}`);
}

export async function createOnlinePayOSOrder({ input, userId, idempotencyKey }) {
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  const order = await ordersRepository.createOnlineOrder({ input, userId, idempotencyKey, requestHash });
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
