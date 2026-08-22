import { PayOS } from '@payos/node';
import dotenv from 'dotenv';

dotenv.config();

let payOSInstance = null;

function appendQueryParam(value, key, paramValue) {
  if (!value) return value;
  const hashIndex = value.indexOf('#');
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const separator = base.includes('?')
    ? (base.endsWith('?') || base.endsWith('&') ? '' : '&')
    : '?';
  return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(paramValue)}${hash}`;
}

export function setPayOSForTest(instance = null) {
  payOSInstance = instance;
}

export function isPayOSConfigured() {
  const cid = process.env.PAYOS_CLIENT_ID?.trim();
  const key = process.env.PAYOS_API_KEY?.trim();
  const cs = process.env.PAYOS_CHECKSUM_KEY?.trim();
  return Boolean(cid && key && cs);
}

export function getPayOS() {
  if (!payOSInstance && isPayOSConfigured()) {
    payOSInstance = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID.trim(),
      apiKey: process.env.PAYOS_API_KEY.trim(),
      checksumKey: process.env.PAYOS_CHECKSUM_KEY.trim(),
    });
  }
  return payOSInstance;
}

/**
 * Tạo link thanh toán PayOS cho đơn hàng
 */
export async function createPaymentLinkForOrder({
  orderId,
  orderCode,
  total,
  payosOrderCode: reservedPayosOrderCode,
  returnUrl,
  cancelUrl,
  description,
}) {
  const instance = getPayOS();
  if (!instance) {
    throw new Error('PayOS chưa được cấu hình (thiếu PAYOS_CLIENT_ID / API_KEY / CHECKSUM_KEY trong backend/.env)');
  }

  // orderCode cho PayOS phải là số nguyên dương và có giới hạn độ dài.
  // Dùng 6 chữ số cuối timestamp + 4 chữ số cuối orderId → tương đương 10 chữ số để tránh vượt giới hạn API.
  const timePart = String(Date.now()).slice(-6);
  const idPart = String(orderId % 10000).padStart(4, '0');
  // PostgreSQL returns BIGINT columns as strings. PayOS requires orderCode
  // to be a positive safe integer, so normalize it before calling the SDK.
  const generatedOrderCode = Number(`${timePart}${idPart}`);
  const payosOrderCode = reservedPayosOrderCode == null
    ? generatedOrderCode
    : Number(reservedPayosOrderCode);
  if (!Number.isSafeInteger(payosOrderCode) || payosOrderCode <= 0) {
    throw new Error('Mã đơn PayOS không hợp lệ');
  }
  const timeoutMinutes = parseInt(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || '15', 10);
  const expiredAtSec = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
  const paymentExpiresAt = new Date(expiredAtSec * 1000);

  const desc = (description || `Don ${orderCode}`).slice(0, 25);
  const rUrl = returnUrl || process.env.PAYOS_RETURN_URL || 'http://localhost:8080/theo-doi-don';
  const cUrl = cancelUrl || process.env.PAYOS_CANCEL_URL || 'http://localhost:8080/thanh-toan';

  const paymentData = {
    orderCode: payosOrderCode,
    amount: Math.round(total),
    description: desc,
    // PayOS also appends its own `code`/`orderCode` query params. Preserve
    // the application's order code under a separate key so the return page
    // can load the correct order after a successful payment.
    returnUrl: appendQueryParam(rUrl, 'order_code', orderCode),
    cancelUrl: appendQueryParam(cUrl, 'order_code', orderCode),
    expiredAt: expiredAtSec,
  };

  let res;
  if (typeof instance.paymentRequests?.create === 'function') {
    res = await instance.paymentRequests.create(paymentData);
  } else if (typeof instance.createPaymentLink === 'function') {
    res = await instance.createPaymentLink(paymentData);
  } else {
    throw new Error('SDK PayOS không tìm thấy hàm tạo thanh toán');
  }

  return {
    checkoutUrl: res.checkoutUrl,
    qrCode: res.qrCode,
    paymentLinkId: res.paymentLinkId || res.id || String(payosOrderCode),
    payosOrderCode,
    paymentExpiresAt,
  };
}

/**
 * Xác thực dữ liệu webhook từ PayOS
 */
export function verifyWebhookData(body) {
  const instance = getPayOS();
  if (!instance) {
    throw new Error('PayOS chưa được cấu hình');
  }

  if (typeof instance.webhooks?.verify === 'function') {
    return instance.webhooks.verify(body);
  } else if (typeof instance.verifyPaymentWebhookData === 'function') {
    return instance.verifyPaymentWebhookData(body);
  } else {
    throw new Error('SDK PayOS không tìm thấy hàm verify webhook');
  }
}
