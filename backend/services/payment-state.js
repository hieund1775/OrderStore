import paymentsRepository from '../repositories/postgres/payments.js';

/**
 * Tự động kiểm tra và chuyển trạng thái các đơn hàng PayOS chưa thanh toán nhưng đã quá hạn
 * sang 'expired' bằng 1 câu UPDATE OUTPUT atomic duy nhất, không ghi status history ngoài enum.
 */
export async function expireUnpaidPayOSOrders(limit = 100) {
  try {
    const rows = await paymentsRepository.expireUnpaidPayOSOrders(limit);
    const expiredCount = rows.length;
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
