import { PayOS } from '@payos/node';
import dotenv from 'dotenv';
import { generateEnvPrefix } from '../repositories/postgres/payment-profiles.js';

dotenv.config();

let payOSInstance = null;
const profileInstancesCache = new Map();

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

export function isPayOSConfigured(profileCode = null) {
  if (profileCode) {
    const normalizedCode = String(profileCode).toUpperCase().trim();
    const envPrefix = generateEnvPrefix(normalizedCode);
    const cid = process.env[`${envPrefix}_CLIENT_ID`]?.trim();
    const key = process.env[`${envPrefix}_API_KEY`]?.trim();
    const cs = process.env[`${envPrefix}_CHECKSUM_KEY`]?.trim();
    if (cid && key && cs) return true;

    // Only system profiles LONG_GROUPED_CHECKOUT / DEFAULT_LONG can fallback to legacy PAYOS_*
    if (normalizedCode === 'LONG_GROUPED_CHECKOUT' || normalizedCode === 'DEFAULT_LONG') {
      const rootCid = process.env.PAYOS_CLIENT_ID?.trim();
      const rootKey = process.env.PAYOS_API_KEY?.trim();
      const rootCs = process.env.PAYOS_CHECKSUM_KEY?.trim();
      return Boolean(rootCid && rootKey && rootCs);
    }

    // Specific industry profile missing ENV returns false (no silent fallback)
    return false;
  }

  const rootCid = process.env.PAYOS_CLIENT_ID?.trim();
  const rootKey = process.env.PAYOS_API_KEY?.trim();
  const rootCs = process.env.PAYOS_CHECKSUM_KEY?.trim();
  return Boolean(rootCid && rootKey && rootCs);
}

export function getPayOS(profileCode = null) {
  if (payOSInstance) return payOSInstance;

  if (profileCode) {
    const normalizedCode = String(profileCode).toUpperCase().trim();
    if (profileInstancesCache.has(normalizedCode)) {
      return profileInstancesCache.get(normalizedCode);
    }

    const envPrefix = generateEnvPrefix(normalizedCode);
    const cid = process.env[`${envPrefix}_CLIENT_ID`]?.trim();
    const key = process.env[`${envPrefix}_API_KEY`]?.trim();
    const cs = process.env[`${envPrefix}_CHECKSUM_KEY`]?.trim();

    if (cid && key && cs) {
      const instance = new PayOS({ clientId: cid, apiKey: key, checksumKey: cs });
      profileInstancesCache.set(normalizedCode, instance);
      return instance;
    }

    // Only system default profiles can fallback to root PAYOS_* instance
    if (normalizedCode === 'LONG_GROUPED_CHECKOUT' || normalizedCode === 'DEFAULT_LONG') {
      if (isPayOSConfigured()) {
        const defaultInstance = new PayOS({
          clientId: process.env.PAYOS_CLIENT_ID.trim(),
          apiKey: process.env.PAYOS_API_KEY.trim(),
          checksumKey: process.env.PAYOS_CHECKSUM_KEY.trim(),
        });
        profileInstancesCache.set(normalizedCode, defaultInstance);
        return defaultInstance;
      }
    }

    // Industry profile with missing keys returns null (never silently charges Long)
    return null;
  }

  // Default system PayOS instance
  if (isPayOSConfigured()) {
    const defaultInstance = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID.trim(),
      apiKey: process.env.PAYOS_API_KEY.trim(),
      checksumKey: process.env.PAYOS_CHECKSUM_KEY.trim(),
    });
    return defaultInstance;
  }

  return null;
}

/**
 * Tạo link thanh toán PayOS cho đơn hàng (hoặc Grouped Checkout)
 */
export async function createPaymentLinkForOrder({
  orderId,
  orderCode,
  total,
  payosOrderCode: reservedPayosOrderCode,
  returnUrl,
  cancelUrl,
  description,
  paymentProfileCode = null,
}) {
  const instance = getPayOS(paymentProfileCode);
  if (!instance) {
    throw new Error(
      `PayOS chưa được cấu hình cho profile "${paymentProfileCode || 'default'}" (thiếu CLIENT_ID / API_KEY / CHECKSUM_KEY)`,
    );
  }

  const timePart = String(Date.now()).slice(-6);
  const idPart = String((Number(orderId) || 1) % 10000).padStart(4, '0');
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
 * Xác thực dữ liệu webhook từ PayOS (hỗ trợ xác thực theo Profile Snapshot)
 */
export function verifyWebhookData(body, { profileCode = null } = {}) {
  const instance = getPayOS(profileCode);
  if (!instance) {
    throw new Error(`PayOS chưa được cấu hình cho profile "${profileCode || 'default'}"`);
  }

  if (typeof instance.webhooks?.verify === 'function') {
    return instance.webhooks.verify(body);
  } else if (typeof instance.verifyPaymentWebhookData === 'function') {
    return instance.verifyPaymentWebhookData(body);
  } else {
    throw new Error('SDK PayOS không tìm thấy hàm verify webhook');
  }
}

/**
 * Chủ động truy vấn trạng thái link thanh toán từ PayOS
 */
export async function getPaymentLinkInformation(orderCode, paymentLinkId = null, profileCode = null) {
  const instance = getPayOS(profileCode);
  if (!instance) return null;

  try {
    if (typeof instance.paymentRequests?.get === 'function') {
      const lookupId = paymentLinkId || orderCode;
      if (!lookupId) return null;
      return await instance.paymentRequests.get(String(lookupId));
    } else if (typeof instance.getPaymentLinkInformation === 'function') {
      const numericCode = Number(orderCode);
      if (!Number.isSafeInteger(numericCode) || numericCode <= 0) return null;
      return await instance.getPaymentLinkInformation(numericCode);
    }
    return null;
  } catch (err) {
    console.warn(`[PayOS Active Recon] Không thể lấy thông tin link ${orderCode}:`, err.message);
    return null;
  }
}
