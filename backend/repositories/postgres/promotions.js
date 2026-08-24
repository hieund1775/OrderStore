import postgresDb from '../../config/db-postgres.js';
import { formatVietnamBusinessDate } from '../../services/business-time.js';

export class PromotionError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function calculateDiscount(promotion, subtotal) {
  const value = Number(promotion.discount_value || 0);
  let discount;
  if (promotion.discount_type === 'percent') {
    discount = Math.round(subtotal * value / 100);
    if (promotion.max_discount != null) discount = Math.min(discount, Number(promotion.max_discount));
  } else if (promotion.discount_type === 'fixed') {
    discount = value;
  } else {
    throw new PromotionError('Mã giảm giá không hợp lệ');
  }
  return Math.max(0, Math.min(discount, subtotal));
}

async function findEligiblePromotion({ code, subtotal, phone, storeId, businessDate, tx, lock = false }) {
  const normalizedCode = String(code || '').trim();
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedCode) return null;
  if (!Number.isFinite(Number(subtotal)) || Number(subtotal) < 0) throw new PromotionError('Giá trị đơn hàng không hợp lệ');
  if (!Number.isInteger(Number(storeId))) throw new PromotionError('Thiếu chi nhánh áp dụng voucher');
  const targetDate = businessDate;

  const [rows] = await tx.query(
    `SELECT p.*
     FROM promotions p
     WHERE p.code = $1
       AND p.is_active = TRUE
       AND p.deleted_at IS NULL
       AND (
         NOT EXISTS (SELECT 1 FROM promotion_stores ps WHERE ps.promotion_id = p.id)
         OR EXISTS (SELECT 1 FROM promotion_stores ps WHERE ps.promotion_id = p.id AND ps.store_id = $2)
       )
       AND p.start_date <= $3
       AND (p.end_date IS NULL OR p.end_date >= $3)
     ${lock ? 'FOR UPDATE OF p' : ''}`,
    [normalizedCode, Number(storeId), targetDate],
  );
  const promotion = rows[0];
  if (!promotion) throw new PromotionError('Mã giảm giá không tồn tại, đã hết hạn hoặc không áp dụng cho chi nhánh này');
  if (Number(promotion.min_order || 0) > Number(subtotal)) throw new PromotionError('Đơn hàng chưa đạt giá trị tối thiểu');
  if (promotion.voucher_type === 'single_use' && !normalizedPhone) throw new PromotionError('Cần số điện thoại để dùng mã giảm giá này');

  if (promotion.voucher_type === 'single_use') {
    const [used] = await tx.query(
      'SELECT 1 FROM voucher_usage_history WHERE promotion_id = $1 AND user_phone = $2',
      [promotion.id, normalizedPhone],
    );
    if (used[0]) throw new PromotionError('Mã giảm giá đã được sử dụng cho số điện thoại này');
  } else if (promotion.usage_limit != null && Number(promotion.used_count) >= Number(promotion.usage_limit)) {
    throw new PromotionError('Mã giảm giá đã hết lượt sử dụng');
  }

  return { promotion, phone: normalizedPhone, discount_amount: calculateDiscount(promotion, Number(subtotal)) };
}

export function createPromotionsRepository(database = postgresDb, { clock = () => new Date() } = {}) {
  return {
    async listActivePromotions({ status } = {}) {
      let sql = 'SELECT * FROM promotions WHERE is_active = TRUE AND deleted_at IS NULL';
      const params = [];
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      sql += ' ORDER BY start_date DESC';
      const [rows] = await database.query(sql, params);
      return rows;
    },

    async preview({ code, subtotal, phone, storeId }) {
      const businessDate = formatVietnamBusinessDate(clock());
      return findEligiblePromotion({ code, subtotal, phone, storeId, businessDate, tx: database });
    },

    async validateForOrder({ code, subtotal, phone, storeId, tx }) {
      if (!code || !String(code).trim()) return null;
      const businessDate = formatVietnamBusinessDate(clock());
      return findEligiblePromotion({ code, subtotal, phone, storeId, businessDate, tx, lock: true });
    },

    async consumeForOrder({ voucher, orderId, tx }) {
      if (!voucher) return;
      const { promotion, phone } = voucher;
      if (promotion.voucher_type === 'single_use') {
        const [inserted] = await tx.query(
          `INSERT INTO voucher_usage_history (promotion_id, user_phone, order_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (promotion_id, user_phone) DO NOTHING
           RETURNING id`,
          [promotion.id, phone, orderId],
        );
        if (!inserted[0]) throw new PromotionError('Mã giảm giá đã được sử dụng cho số điện thoại này');
        return;
      }
      const [, affected] = await tx.query(
        `UPDATE promotions SET used_count = used_count + 1
         WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)`,
        [promotion.id],
      );
      if (!affected) throw new PromotionError('Mã giảm giá đã hết lượt sử dụng');
    },
  };
}

export const promotionsRepository = createPromotionsRepository();
export default promotionsRepository;
