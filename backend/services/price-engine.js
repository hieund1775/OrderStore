import postgresDb from '../config/db-postgres.js';

/**
 * Tính line_total từ DB — KHÔNG tin bất kỳ giá nào từ client (Zero-Trust).
 * unit_price = product_price + size_extra_price
 * line_total = (unit_price + sum(topping_prices)) * qty
 * @param {*} q query runner (postgresDb.query mặc định, hoặc tx.query trong transaction)
 */
export async function calcLineTotals({ product_id, size_id, topping_ids = [], qty = 1 }, q = postgresDb.query) {
  if (!product_id || !Number.isInteger(Number(product_id))) {
    throw new Error('product_id không hợp lệ');
  }
  if (!Number.isInteger(Number(qty)) || Number(qty) < 1 || Number(qty) > 50) {
    throw new Error('Số lượng phải từ 1 đến 50');
  }

  const [products] = await q(
    'SELECT id, name, price FROM products WHERE id = $1 AND is_available = TRUE',
    [product_id],
  );
  const product = products[0];
  if (!product) throw new Error('Sản phẩm không tồn tại hoặc đã ngưng bán');

  let sizeExtra = 0;
  if (size_id != null) {
    const [sizes] = await q('SELECT id, price_extra FROM size_options WHERE id = $1', [size_id]);
    const size = sizes[0];
    if (!size) throw new Error('Size không hợp lệ');
    sizeExtra = size.price_extra || 0;
  }

  let toppingsTotal = 0;
  const toppings = [];
  if (Array.isArray(topping_ids) && topping_ids.length > 0) {
    const unique = [...new Set(topping_ids.map(Number))].filter((id) => Number.isInteger(id));
    if (unique.length > 0) {
      const [toppingRows] = await q(
        'SELECT id, name, price FROM toppings WHERE id = ANY($1::int[]) AND is_available = TRUE',
        [unique],
      );
      const map = new Map(toppingRows.map((t) => [t.id, t]));
      for (const id of unique) {
        const t = map.get(id);
        if (t) {
          toppings.push({ id: t.id, name: t.name, price: t.price });
          toppingsTotal += t.price;
        }
      }
    }
  }

  const unit_price = Number(product.price) + Number(sizeExtra);
  const line_total = (unit_price + toppingsTotal) * qty;

  return { product_id: Number(product_id), product_name: product.name, unit_price, toppingsTotal, line_total, toppings };
}

/**
 * Validate voucher từ DB. Trả { discount_amount, promotion_id } hoặc ném Error tiếng Việt.
 * calculated_discount = round(subtotal * percent / 100)
 * discount_amount = max_discount ? min(calculated, max_discount) : calculated
 */
export async function validateVoucher({ code, subtotal, customer_phone }, q = postgresDb.query) {
  if (!code) return { discount_amount: 0, promotion_id: null };

  const [rows] = await q(
    `SELECT id, discount_value, discount_type, max_discount, min_order,
            voucher_type, usage_limit, used_count, start_date, end_date, status
     FROM promotions WHERE code = $1 AND is_active = TRUE`,
    [code],
  );
  const promo = rows[0];
  if (!promo) throw new Error('Mã giảm giá không tồn tại');

  if (promo.discount_type !== 'percent') throw new Error('Mã này không phải mã giảm theo %');
  if (promo.status !== 'Đang diễn ra' && promo.status !== 'Đang chạy') {
    throw new Error('Mã giảm giá chưa có hiệu lực hoặc đã kết thúc');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (promo.start_date && promo.start_date > today) throw new Error('Mã giảm giá chưa bắt đầu');
  if (promo.end_date && promo.end_date < today) throw new Error('Mã giảm giá đã hết hạn');
  if (promo.min_order && subtotal < promo.min_order) {
    throw new Error(`Đơn tối thiểu để dùng mã là ${Number(promo.min_order).toLocaleString('vi-VN')}₫`);
  }

  if (promo.voucher_type === 'single_use') {
    const [used] = await q(
      'SELECT COUNT(*)::int AS cnt FROM voucher_usage_history WHERE promotion_id = $1 AND user_phone = $2',
      [promo.id, customer_phone],
    );
    if (used[0].cnt > 0) throw new Error('Mã giảm giá đã được sử dụng cho số điện thoại này');
  } else {
    if (promo.usage_limit != null && promo.used_count >= promo.usage_limit) {
      throw new Error('Mã giảm giá đã hết lượt sử dụng');
    }
  }

  const calculated = Math.round(subtotal * (Number(promo.discount_value) / 100));
  const discount = promo.max_discount ? Math.min(calculated, Number(promo.max_discount)) : calculated;
  return { discount_amount: discount, promotion_id: promo.id };
}

/**
 * Tiêu hao voucher một cách atomic (chống race condition):
 * UPDATE promotions SET used_count = used_count + 1
 *   WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)
 * Trả false nếu hết lượt (rowsAffected = 0).
 */
export async function consumeVoucher(promoId, q = postgresDb.query) {
  const [, affected] = await q(
    'UPDATE promotions SET used_count = used_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)',
    [promoId],
  );
  return affected > 0;
}
