import { Router } from 'express';
import db from '../config/db.js';
import { verifyWebhookData } from '../services/payos.js';
import { PAYOS_CAS_UPDATE_SQL, classifyWebhookError, classifyCASZeroAffected } from '../services/webhook-classifier.js';

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
    // 1) Atomic Compare-And-Set (CAS) update
    const [, affected] = await db.query(
      PAYOS_CAS_UPDATE_SQL,
      [reference || String(orderCode), orderCode, paymentLinkId || null, Number(amount)]
    );

    if (affected > 0) {
      console.log(`✅ [PayOS Webhook Success]: Đã xác nhận thanh toán đơn (PayOS Code: ${orderCode}, ${amount}đ)`);
      return res.json({ ok: true, message: 'Thanh toán thành công' });
    }

    // 2) Affected == 0 -> Phân loại nguyên nhân chính xác
    const [orders] = await db.query(
      `SELECT id, order_code, total, payment_status, payment_provider
       FROM orders WHERE payos_order_code = ? OR payment_link_id = ?`,
      [orderCode, paymentLinkId || null]
    );

    const order = orders?.[0] || null;
    const classified = classifyCASZeroAffected({ order, webhookAmount: amount });

    if (classified.ok) {
      console.log(`ℹ️ [PayOS Webhook Idempotent]: Đơn hàng ${order?.order_code} đã thanh toán từ trước`);
    } else {
      console.warn(`⚠️ [PayOS Webhook Rejection]: ${classified.message} (reason: ${classified.reason})`);
    }

    return res.status(classified.statusCode).json({ ok: classified.ok, message: classified.message });
  } catch (err) {
    console.error('💥 PayOS Webhook Infrastructure Error:', err);
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
    const [rows] = await db.query(
      `SELECT id, order_code, total, payment_status, payment_provider, paid_at, payment_expires_at
       FROM orders WHERE order_code = ?`,
      [code]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    res.json({ order: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;