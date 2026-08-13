import { Router } from 'express';
import db from '../config/db.js';
import { verifyWebhookData } from '../services/payos.js';

const router = Router();

/**
 * Webhook PayOS tự động nhận báo tiền về
 * POST /api/payments/payos/webhook
 */
router.post('/payos/webhook', async (req, res) => {
  try {
    console.log('🔔 [PayOS Webhook Received]:', JSON.stringify(req.body));

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
      return res.status(200).json({ ok: false, message: 'Chữ ký không hợp lệ' });
    }

    const { orderCode, amount, reference, paymentLinkId } = verifiedData || {};
    if (!orderCode) {
      return res.status(200).json({ ok: false, message: 'Thiếu orderCode' });
    }

    // 0) Chỉ chấp nhận giao dịch thành công theo chuẩn PayOS (code '00')
    if (verifiedData?.code !== '00') {
      console.warn(`⚠️ PayOS webhook báo trạng thái không thành công: code=${verifiedData?.code} desc=${verifiedData?.desc}`);
      return res.status(200).json({ ok: false, message: 'Giao dịch chưa thành công' });
    }

    // 1) Tìm đơn hàng theo payos_order_code (fallback theo payment_link_id)
    const [orders] = await db.query(
      `SELECT id, order_code, total, payment_status
       FROM orders WHERE payos_order_code = ? OR payment_link_id = ?`,
      [orderCode, paymentLinkId || null]
    );

    if (!orders.length) {
      console.warn(`⚠️ không tìm thấy order với payos_order_code = ${orderCode}`);
      return res.status(200).json({ ok: false, message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];

    // 2) Idempotency check
    if (order.payment_status === 'paid') {
      console.log(`ℹ️ Đơn hàng ${order.order_code} đã thanh toán từ trước`);
      return res.json({ ok: true, message: 'Đã thanh toán từ trước' });
    }

    // 3) Zero-Trust check: Đối chiếu số tiền
    if (amount !== undefined && Number(amount) !== Number(order.total)) {
      console.error(`❌ Số tiền webhook (${amount}) lệch với tổng đơn (${order.total}) cho đơn ${order.order_code}`);
      return res.status(200).json({ ok: false, message: 'Số tiền không khớp' });
    }

    // 4) Cập nhật trạng thái paid
    await db.query(
      `UPDATE orders
       SET payment_status = 'paid',
           paid_at = GETDATE(),
           transaction_id = ?,
           payment_provider = 'payos'
       WHERE id = ?`,
      [reference || String(orderCode), order.id]
    );

    console.log(`✅ [PayOS Webhook Success]: Đơn hàng ${order.order_code} đã xác nhận thanh toán (${amount}đ)`);
    return res.json({ ok: true, message: 'Thanh toán thành công' });
  } catch (err) {
    console.error('💥 PayOS Webhook Error:', err);
    // Trả 200 để PayOS không retry liên tục khi server gặp sự cố logic
    return res.status(200).json({ ok: false, error: err.message });
  }
});

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