import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { reconcilePayOSCheckoutGroup, reconcilePayOSOrder } from '../services/payos-reconciliation.js';
import { processPayOSWebhookWithAttempts } from '../services/payment-attempt-settlement.js';
import { classifyWebhookError } from '../services/webhook-classifier.js';
import paymentsRepository from '../repositories/postgres/payments.js';
import directPayOSAttemptService from '../services/direct-payos-attempt.js';
import groupedPayOSAttemptService from '../services/grouped-payos-attempt.js';
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
import checkoutGroupsRepository from '../repositories/postgres/checkout-groups.js';

export function createPayOSWebhookHandler({ processWebhook = processPayOSWebhookWithAttempts } = {}) {
  return async function handlePayOSWebhook(req, res) {
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
    // Unknown/ambiguous candidates and business rejections never mutate a
    // target, and are non-retryable from PayOS's point of view.
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
 * Endpoint tra cứu trạng thái thanh toán đơn PayOS (Kèm chủ động đối soát Active Reconciliation)
 * GET /api/payments/payos/status?code=TPxxxxxx hoặc ?code=GRPxxxxxx
 */
router.get('/payos/status', noCache, async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Thiếu mã đơn code' });

    if (code.startsWith('GRP')) {
      const decodedToken = extractCustomerToken(req);
      const userId = decodedToken ? Number(decodedToken.id || decodedToken.sub) : null;
      const rawCancelToken = (req.headers['x-cancel-token'] || req.query.cancel_token || '').trim() || null;

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

    res.json({ order });
  } catch (err) {
    console.error('PayOS status lookup failed:', err.message);
    const status = err.status || (err.message.includes('quyền') ? 403 : 500);
    res.status(status).json({ error: err.message || 'Không thể tra cứu trạng thái thanh toán lúc này' });
  }
});

/**
 * Endpoint tái tạo mã QR thanh toán PayOS cho đơn cũ
 * POST /api/payments/payos/regenerate-qr
 */
router.post('/payos/regenerate-qr', async (req, res) => {
  try {
    const { order_code, cancel_token } = req.body || {};
    if (!order_code || typeof order_code !== 'string') {
      return res.status(400).json({ error: 'Thiếu mã đơn hàng order_code' });
    }

    const decodedToken = extractCustomerToken(req);
    const userId = decodedToken ? Number(decodedToken.id || decodedToken.sub) : null;
    const rawCancelToken = (req.headers['x-cancel-token'] || cancel_token || '').trim() || null;

    if (order_code.startsWith('GRP')) {
      const updatedGroup = await groupedPayOSAttemptService.regenerateForCustomer({
        groupCode: order_code.trim(),
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
        },
      });
    }

    const updatedOrder = await directPayOSAttemptService.regenerateForCustomer({
      orderCode: order_code.trim(),
      userId,
      cancelToken: rawCancelToken,
    });

    res.json({
      ok: true,
      order: {
        order_code: updatedOrder.order_code,
        total: Number(updatedOrder.total),
        checkout_url: updatedOrder.payment_checkout_url,
        qr_code: updatedOrder.payment_qr_code,
        payment_expires_at: updatedOrder.payment_expires_at,
        payment_status: updatedOrder.payment_status,
      },
    });
  } catch (err) {
    console.error('Regenerate PayOS QR failed:', err.message);
    const status = err.status || (err.message.includes('quyền') ? 403 : 502);
    const message = err.status && err.status < 500
      ? err.message
      : 'Không thể tạo lại mã thanh toán lúc này';
    res.status(status).json({ error: message });
  }
});

/**
 * Giả lập thanh toán PayOS thành công (Chỉ bật khi dev/test cục bộ)
 * POST /api/payments/payos/simulate-success
 */
router.post('/payos/simulate-success', async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PAYOS_SIMULATOR !== 'true') {
    return res.status(404).json({ error: 'Endpoint không khả dụng trên môi trường production' });
  }

  try {
    const { order_code } = req.body || {};
    if (!order_code || typeof order_code !== 'string') {
      return res.status(400).json({ error: 'Thiếu mã đơn hàng order_code' });
    }

    const result = await paymentsRepository.simulatePaymentSuccess({ orderCode: order_code.trim() });
    res.json(result);
  } catch (err) {
    console.error('Simulate PayOS payment failed:', err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: status < 500 ? err.message : 'Không thể giả lập thanh toán lúc này',
    });
  }
});

export default router;
