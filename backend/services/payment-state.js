import db from '../config/db.js';

/**
 * Tự động kiểm tra và chuyển trạng thái các đơn hàng PayOS chưa thanh toán nhưng đã quá hạn
 * sang 'expired' bằng 1 câu UPDATE OUTPUT atomic duy nhất, không ghi status history ngoài enum.
 */
export async function expireUnpaidPayOSOrders() {
  try {
    const [rows, affected] = await db.query(
      `UPDATE orders
       SET payment_status = 'expired', updated_at = GETDATE()
       OUTPUT INSERTED.id, INSERTED.order_code
       WHERE payment_status = 'unpaid'
         AND payment_provider = 'payos'
         AND payment_expires_at IS NOT NULL
         AND payment_expires_at < GETDATE()`
    );

    const expiredCount = Array.isArray(rows) ? rows.length : (affected || 0);
    if (expiredCount > 0) {
      const codes = Array.isArray(rows) ? rows.map(r => r.order_code).join(', ') : `${expiredCount} đơn`;
      console.log(`⏱️ [Auto-Expire]: Đã chuyển ${expiredCount} đơn PayOS quá hạn sang expired (${codes})`);
    }
    return expiredCount;
  } catch (err) {
    console.error('❌ [Auto-Expire Error]: Lỗi khi quét và hết hạn đơn PayOS:', err.message);
    throw err;
  }
}
