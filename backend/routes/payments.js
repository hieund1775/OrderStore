import { Router } from 'express';
import { verifyWebhookData } from '../services/payos.js';
import { classifyWebhookError, classifyCASZeroAffected } from '../services/webhook-classifier.js';
import paymentsRepository from '../repositories/postgres/payments.js';

const router = Router();

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

export default router;
