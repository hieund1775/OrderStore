import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { isSandboxPaymentMode, assertSandboxPaymentMode } from '../config/payment-mode.js';
import { reconcilePayOSCheckoutGroup, reconcilePayOSOrder } from '../services/payos-reconciliation.js';
import { processPayOSWebhookWithAttempts } from '../services/payment-attempt-settlement.js';
import { classifyWebhookError } from '../services/webhook-classifier.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import checkoutGroupsRepository from '../repositories/postgres/checkout-groups.js';
import directPayOSAttemptService from '../services/direct-payos-attempt.js';
import groupedPayOSAttemptService from '../services/grouped-payos-attempt.js';
import sandboxPaymentAttemptService from '../services/sandbox-payment-attempt.js';
import { noCache } from '../middleware/no-cache.js';

const router = Router();

function extractCustomerToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.role === 'customer' && (decoded.id || decoded.sub)) {
        return decoded;
      }
    } catch {}
  }
  return null;
}

/**
 * Webhook PayOS tự động nhận báo tiền về
 * POST /api/payments/payos/webhook
 */
export function createPayOSWebhookHandler({ processWebhook = processPayOSWebhookWithAttempts } = {}) {
  return async function handlePayOSWebhook(req, res) {
    // In sandbox mode, ignore PayOS webhooks safely without mutating targets or retrying indefinitely
    if (isSandboxPaymentMode()) {
      return res.json({ ok: true, ignored: true, reason: 'PAYMENT_MODE_SANDBOX' });
    }

    // Test event từ PayOS Dashboard - chỉ cho phép ở môi trường không phải production
    if (process.env.NODE_ENV !== 'production' && (req.body?.data?.orderCode === 123 || req.body?.desc?.includes('ma giao dich thu'))) {
      console.log('ℹ️ PayOS webhook test event verified');
      return res.json({ ok: true, message: 'Test webhook ok' });
    }

    try {
      const result = await processWebhook({ body: req.body });
      if (['paid', 'duplicate', 'already_paid'].includes(result.kind)) {
        return res.json({ ok: true, message: 'Thanh toán thành công' });
      }
      if (result.kind === 'signature_invalid') {
        const classified = classifyWebhookError({ type: 'INVALID_SIGNATURE', message: 'signature verification failed' });
        return res.status(classified.statusCode).json(classified.body);
      }
      if (result.kind === 'not_successful') {
        return res.status(200).json({ ok: false, message: 'Giao dịch chưa thành công' });
      }
      if (result.kind === 'ambiguous') {
        console.warn('[PayOS Webhook Anomaly] Multiple payment-attempt snapshots verified one callback');
      }
      // Unknown/ambiguous candidates and business rejections never mutate a target
      return res.status(200).json({ ok: false, message: 'Giao dịch không hợp lệ' });
    } catch (err) {
      console.error('PayOS webhook infrastructure error:', err?.name || 'unknown');
      // Lỗi hạ tầng / Database timeout phải trả HTTP 500 để PayOS retry
      const classified = classifyWebhookError({ type: 'INFRASTRUCTURE', message: err.message });
      return res.status(classified.statusCode).json(classified.body);
    }
  };
}

export const handlePayOSWebhook = createPayOSWebhookHandler();
router.post('/payos/webhook', handlePayOSWebhook);

/**
 * Universal payment status handler
 * GET /api/payments/status?code=...
 * GET /api/payments/payos/status?code=... (compatibility alias)
 */
export async function handlePaymentStatus(req, res) {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Thiếu mã đơn code' });
    }

    const decodedToken = extractCustomerToken(req);
    const userId = decodedToken ? Number(decodedToken.id || decodedToken.sub) : null;
    const rawCancelToken = (req.headers['x-cancel-token'] || req.query.cancel_token || '').trim() || null;

    if (isSandboxPaymentMode()) {
      const status = await sandboxPaymentAttemptService.getStatus({
        code: code.trim(),
        userId,
        cancelToken: rawCancelToken,
      });
      return res.json({ order: status });
    }

    // PayOS mode logic
    if (code.startsWith('GRP')) {
      let groupDto = await checkoutGroupsRepository.findGroupForCustomerLookup(code, {
        userId,
        cancelToken: rawCancelToken,
      });
      if (!groupDto) return res.status(404).json({ error: 'Không tìm thấy đơn hàng gộp' });
      if (['unpaid', 'expired'].includes(groupDto.payment_status) && groupDto.payment_provider === 'payos') {
        const group = await checkoutGroupsRepository.findGroupByCode(code);
        await reconcilePayOSCheckoutGroup({ checkoutGroup: group });
        groupDto = await checkoutGroupsRepository.findGroupForCustomerLookup(code, {
          userId,
          cancelToken: rawCancelToken,
        });
      }
      return res.json({
        order: {
          order_code: groupDto.group_code,
          total: Number(groupDto.total_amount),
          payment_status: groupDto.payment_status,
          payment_provider: groupDto.payment_provider,
          payment_checkout_url: groupDto.payment_checkout_url,
          payment_qr_code: groupDto.payment_qr_code,
          payment_expires_at: groupDto.payment_expires_at,
          paid_at: groupDto.paid_at || null,
        },
      });
    }

    let order = await paymentsRepository.findStatusByOrderCode(code);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    if (['unpaid', 'expired'].includes(order.payment_status)) {
      await reconcilePayOSOrder({ order });
      if (order.payment_provider === 'payos') {
        order = await paymentsRepository.findStatusByOrderCode(code);
      }
    }

    const canRegenerate = Boolean(
      order.payment_provider === 'payos'
      && ['unpaid', 'expired'].includes(order.payment_status)
      && order.status !== 'Đã hủy'
      && order.status !== 'Hoàn thành'
    );

    return res.json({
      order: {
        ...order,
        can_regenerate_qr: canRegenerate,
      },
    });
  } catch (err) {
    console.error('Payment status lookup failed:', err.message);
    const status = err.status || (err.message.includes('quyền') ? 403 : 500);
    return res.status(status).json({ error: err.message || 'Không thể tra cứu trạng thái thanh toán lúc này' });
  }
}

router.get('/status', noCache, handlePaymentStatus);
router.get('/payos/status', noCache, handlePaymentStatus);

/**
 * Universal payment regenerate handler
 * POST /api/payments/regenerate
 * POST /api/payments/payos/regenerate-qr (compatibility alias)
 */
export async function handlePaymentRegenerate(req, res) {
  try {
    const { order_code, code, cancel_token } = req.body || {};
    const targetCode = String(order_code || code || '').trim();
    if (!targetCode) {
      return res.status(400).json({ error: 'Thiếu mã đơn hàng order_code' });
    }

    const decodedToken = extractCustomerToken(req);
    const userId = decodedToken ? Number(decodedToken.id || decodedToken.sub) : null;
    const rawCancelToken = (req.headers['x-cancel-token'] || cancel_token || '').trim() || null;

    if (isSandboxPaymentMode()) {
      const updated = await sandboxPaymentAttemptService.regenerateForCustomer({
        code: targetCode,
        userId,
        cancelToken: rawCancelToken,
      });

      return res.json({
        ok: true,
        order: {
          order_code: updated.order_code || updated.group_code,
          total: Number(updated.total || updated.total_amount),
          checkout_url: updated.payment_checkout_url,
          qr_code: null,
          payment_expires_at: updated.payment_expires_at,
          payment_status: updated.payment_status,
          payment_provider: 'sandbox',
        },
      });
    }

    // PayOS mode logic
    if (targetCode.startsWith('GRP')) {
      const updatedGroup = await groupedPayOSAttemptService.regenerateForCustomer({
        groupCode: targetCode,
        userId,
        cancelToken: rawCancelToken,
      });

      return res.json({
        ok: true,
        order: {
          order_code: updatedGroup.group_code,
          total: Number(updatedGroup.total_amount),
          checkout_url: updatedGroup.payment_checkout_url,
          qr_code: updatedGroup.payment_qr_code,
          payment_expires_at: updatedGroup.payment_expires_at,
          payment_status: updatedGroup.payment_status,
          payment_provider: updatedGroup.payment_provider || 'payos',
        },
      });
    }

    const updatedOrder = await directPayOSAttemptService.regenerateForCustomer({
      orderCode: targetCode,
      userId,
      cancelToken: rawCancelToken,
    });

    return res.json({
      ok: true,
      order: {
        order_code: updatedOrder.order_code,
        total: Number(updatedOrder.total),
        checkout_url: updatedOrder.payment_checkout_url,
        qr_code: updatedOrder.payment_qr_code,
        payment_expires_at: updatedOrder.payment_expires_at,
        payment_status: updatedOrder.payment_status,
        payment_provider: updatedOrder.payment_provider || 'payos',
      },
    });
  } catch (err) {
    console.error('Regenerate QR failed:', err.message);
    const status = err.status || (err.message.includes('quyền') ? 403 : 502);
    const message = err.status && err.status < 500
      ? err.message
      : 'Không thể tạo lại mã thanh toán lúc này';
    return res.status(status).json({ error: message });
  }
}

router.post('/regenerate', handlePaymentRegenerate);
router.post('/payos/regenerate-qr', handlePaymentRegenerate);

/**
 * Sandbox payment session lookup
 * GET /api/payments/sandbox/session?token=...
 */
router.get('/sandbox/session', noCache, async (req, res) => {
  try {
    assertSandboxPaymentMode();
    const { token } = req.query;
    const decodedToken = extractCustomerToken(req);
    if (!decodedToken) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản trước khi xem phiên thanh toán' });
    }
    const userId = Number(decodedToken.id || decodedToken.sub);
    const session = await sandboxPaymentAttemptService.findSessionByToken(token, { userId });
    return res.json(session);
  } catch (err) {
    const status = err.status || (err.message?.includes('không khả dụng') ? 404 : 500);
    return res.status(status).json({ error: err.message, code: err.code });
  }
});

/**
 * Sandbox exact amount transfer settlement
 * POST /api/payments/sandbox/transfer
 */
router.post('/sandbox/transfer', async (req, res) => {
  try {
    assertSandboxPaymentMode();
    const { token, amount } = req.body || {};
    const decodedToken = extractCustomerToken(req);
    if (!decodedToken) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản trước khi thanh toán' });
    }
    const userId = Number(decodedToken.id || decodedToken.sub);
    const result = await sandboxPaymentAttemptService.transferExactAmount({
      rawToken: token,
      amount,
      userId,
    });
    return res.json(result);
  } catch (err) {
    const status = err.status || (err.message?.includes('không khả dụng') ? 404 : 500);
    return res.status(status).json({ error: err.message, code: err.code });
  }
});

/**
 * Giả lập thanh toán PayOS thành công (Đã bị vô hiệu hóa hoàn toàn)
 * POST /api/payments/payos/simulate-success
 */
router.post('/payos/simulate-success', async (_req, res) => {
  return res.status(404).json({ error: 'Endpoint đã bị vô hiệu hóa hoàn toàn' });
});

export default router;
