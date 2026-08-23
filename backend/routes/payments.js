import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { verifyWebhookData } from '../services/payos.js';
import { classifyWebhookError, classifyCASZeroAffected } from '../services/webhook-classifier.js';
import paymentsRepository from '../repositories/postgres/payments.js';

const router = Router();

function extractCustomerToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.role === 'customer' || decoded?.sub) {
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
export async function handlePayOSWebhook(req, res) {
  // Test event từ PayOS Dashboard - chỉ cho phép ở môi trường không phải production
  if (process.env.NODE_ENV !== 'production' && (req.body?.data?.orderCode === 123 || req.body?.desc?.includes('ma giao dich thu'))) {
    console.log('ℹ️ PayOS webhook test event verified');
    return res.json({ ok: true, message: 'Test webhook ok' });
  }

  let verifiedData;
  try {
    verifiedData = verifyWebhookData(req.body);
  } catch (err) {
    console.error('❌ PayOS Webhook Invalid Signature:', err.message);
    const classified = classifyWebhookError({ type: 'INVALID_SIGNATURE', message: err.message });
    return res.status(classified.statusCode).json(classified.body);
  }

  const { orderCode, amount, reference, paymentLinkId, code } = verifiedData || {};
  if (!orderCode) {
    return res.status(200).json({ ok: false, message: 'Thiếu orderCode' });
  }

  // Chỉ chấp nhận giao dịch thành công theo chuẩn PayOS (code '00')
  if (code !== '00') {
    console.warn(`⚠️ PayOS webhook báo trạng thái không thành công: code=${code}`);
    return res.status(200).json({ ok: false, message: 'Giao dịch chưa thành công' });
  }

  try {
    const result = await paymentsRepository.processSuccessfulWebhook({
      eventKey: String(reference || paymentLinkId || orderCode),
      orderCode, amount: Number(amount), reference, paymentLinkId,
      payload: { orderCode, amount: Number(amount), reference: reference || null, paymentLinkId: paymentLinkId || null, code },
    });
    if (result.kind === 'paid') {
      console.log(`✅ [PayOS Webhook Success]: Đã xác nhận thanh toán đơn (PayOS Code: ${orderCode}, ${amount}đ)`);
      return res.json({ ok: true, message: 'Thanh toán thành công' });
    }
    if (result.kind === 'duplicate' || result.kind === 'already_paid') {
      return res.json({ ok: true, message: 'Đơn hàng đã được xác nhận thanh toán từ trước' });
    }
    const order = result.order || null;
    const classified = classifyCASZeroAffected({ order, webhookAmount: amount });

    if (classified.ok) {
      console.log(`ℹ️ [PayOS Webhook Idempotent]: Đơn hàng ${order?.order_code} đã thanh toán từ trước`);
    } else {
      console.warn(`⚠️ [PayOS Webhook Rejection]: ${classified.message} (reason: ${classified.reason})`);
    }

    return res.status(classified.statusCode).json({ ok: classified.ok, message: classified.message });
  } catch (err) {
    console.error('PayOS webhook infrastructure error:', err?.name || 'unknown');
    // Lỗi hạ tầng / Database timeout phải trả HTTP 500 để PayOS retry
    const classified = classifyWebhookError({ type: 'INFRASTRUCTURE', message: err.message });
    return res.status(classified.statusCode).json(classified.body);
  }
}

router.post('/payos/webhook', handlePayOSWebhook);

/**
 * Endpoint tra cứu trạng thái thanh toán đơn PayOS
 * GET /api/payments/payos/status?code=TPxxxxxx
 */
router.get('/payos/status', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Thiếu mã đơn code' });
    const order = await paymentsRepository.findStatusByOrderCode(code);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    res.json({ order });
  } catch (err) {
    console.error('PayOS status lookup failed:', err.message);
    res.status(500).json({ error: 'Không thể tra cứu trạng thái thanh toán lúc này' });
  }
});

/**
 * Endpoint tái tạo mã QR thanh toán PayOS cho đơn cũ
 * POST /api/payments/payos/regenerate-qr
 */
router.post('/payos/regenerate-qr', async (req, res) => {
  try {
    const { order_code, cancel_token, return_url, cancel_url } = req.body || {};
    if (!order_code || typeof order_code !== 'string') {
      return res.status(400).json({ error: 'Thiếu mã đơn hàng order_code' });
    }

    const decodedToken = extractCustomerToken(req);
    const userId = decodedToken ? Number(decodedToken.id || decodedToken.sub) : null;
    const userPhone = decodedToken?.phone || null;
    const rawCancelToken = (req.headers['x-cancel-token'] || cancel_token || '').trim() || null;

    const updatedOrder = await paymentsRepository.renewPayOSOrderLink({
      orderCode: order_code.trim(),
      userId,
      userPhone,
      cancelToken: rawCancelToken,
      returnUrl: return_url || null,
      cancelUrl: cancel_url || null,
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
    const status = err.status || (err.message.includes('quyền') ? 403 : 500);
    res.status(status).json({ error: err.message || 'Không thể tạo lại mã thanh toán lúc này' });
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
    res.status(err.status || 500).json({ error: err.message || 'Không thể giả lập thanh toán lúc này' });
  }
});

export default router;
