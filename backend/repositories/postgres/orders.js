import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';
import promotionsRepository from './promotions.js';
import { claimOrderIdempotency, completeOrderIdempotency } from '../../services/order-idempotency.js';
import { OrderDomainError } from '../../services/orders/order-errors.js';

export class OrderError extends OrderDomainError {
  constructor(message, status = 400, code = 'ORDER_BUSINESS_RULE') {
    super(message, { status, code, expose: true });
    this.name = 'OrderError';
  }
}

function orderCode() {
  return `TP${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${crypto.randomInt(1000, 10000)}`;
}

function normalizeRows(rows) {
  return rows.map((row) => ({ ...row, id: Number(row.id), order_id: row.order_id == null ? row.order_id : Number(row.order_id) }));
}

function idempotencyScope(userId, input) {
  if (userId) return `online-order:user:${userId}`;
  const guestFingerprint = crypto.createHash('sha256').update(String(input.customer_phone || '')).digest('hex');
  return `online-order:guest:${guestFingerprint}`;
}

export function createOrdersRepository(database = postgresDb, promotions = promotionsRepository) {
  return {
    async createPublicOrder({ input, userId = null, cancelTokenHash = null, cancelToken = null, idempotencyKey, requestHash, paymentProvider = 'cod' }) {
      if (!idempotencyKey || idempotencyKey.length > 255) throw new OrderError('Thiếu Idempotency-Key hợp lệ');

      return database.transaction(async (tx) => {
        const idempotency = await claimOrderIdempotency(tx, {
          key: idempotencyKey,
          scope: idempotencyScope(userId, input),
          requestHash,
        });
        if (idempotency.replay) return { replay: true, ...idempotency.response };

        const [stores] = await tx.query('SELECT id FROM stores WHERE id = $1 AND is_active = TRUE', [input.store_id]);
        if (!stores[0]) throw new OrderError('Chi nhánh không tồn tại hoặc đã ngừng hoạt động');

        let locationName = null;
        if (input.table_id) {
          const [tables] = await tx.query(
            'SELECT name FROM tables WHERE id = $1 AND store_id = $2 AND is_active = TRUE',
            [input.table_id, input.store_id],
          );
          if (!tables[0]) throw new OrderError('Bàn không thuộc chi nhánh đã chọn hoặc đã ngừng hoạt động');
          locationName = tables[0].name;
        }

        const lines = [];
        let subtotal = 0;
        for (const item of input.items || []) {
          const qty = Number(item.qty || 1);
          if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new OrderError('Số lượng phải từ 1 đến 50');
          const [products] = await tx.query('SELECT id, name, price FROM products WHERE id = $1 AND is_available = TRUE', [item.product_id]);
          if (!products[0]) throw new OrderError('Sản phẩm không tồn tại hoặc đã ngừng bán');
          let sizeExtra = 0;
          let sizeLabel = item.size_label || 'M';
          if (item.size_id != null) {
            const [sizes] = await tx.query('SELECT label, price_extra FROM size_options WHERE id = $1', [item.size_id]);
            if (!sizes[0]) throw new OrderError('Size không hợp lệ');
            sizeExtra = Number(sizes[0].price_extra || 0);
            sizeLabel = sizes[0].label;
          }
          const rawToppings = item.topping_ids || (Array.isArray(item.toppings) ? item.toppings.map((t) => (typeof t === 'object' && t !== null ? t.topping_id : t)) : []);
          const toppingIds = [...new Set(rawToppings.map(Number).filter(Number.isInteger))];
          const [toppings] = toppingIds.length
            ? await tx.query('SELECT id, name, price FROM toppings WHERE id = ANY($1::bigint[]) AND is_available = TRUE', [toppingIds])
            : [[]];
          if (toppings.length !== toppingIds.length) throw new OrderError('Topping không hợp lệ hoặc đã ngừng bán');
          const toppingTotal = toppings.reduce((sum, topping) => sum + Number(topping.price), 0);
          const unitPrice = Number(products[0].price) + sizeExtra;
          const lineTotal = (unitPrice + toppingTotal) * qty;
          subtotal += lineTotal;
          lines.push({ item, product: products[0], qty, sizeLabel, unitPrice, lineTotal, toppings });
        }

        const voucher = await promotions.validateForOrder({
          code: input.voucher_code, subtotal, phone: input.customer_phone, storeId: input.store_id, tx,
        });
        const discountAmount = Number(voucher?.discount_amount || 0);
        const total = subtotal - discountAmount;
        const [orders] = await tx.query(
          `INSERT INTO orders (order_code, user_id, store_id, table_id, location_name, order_type,
             payment_method, payment_status, payment_provider, paid_at, cancel_token_hash, customer_name, customer_phone,
             delivery_addr, voucher_code, discount_amount, points_earned, subtotal, total, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           RETURNING id, order_code, subtotal, discount_amount, total, payment_status, payment_provider`,
          [orderCode(), userId, input.store_id, input.table_id || null, locationName, input.order_type || 'Take-away',
            input.payment_method || 'COD', (input.order_type === 'POS' || input.source === 'pos') ? 'paid' : 'unpaid', paymentProvider,
            (input.order_type === 'POS' || input.source === 'pos') ? new Date() : null, cancelTokenHash, input.customer_name, input.customer_phone,
            input.delivery_addr || null, input.voucher_code || null, discountAmount, Math.floor(total / 1000), subtotal, total, input.note || null],
        );
        const order = orders[0];
        await promotions.consumeForOrder({ voucher, orderId: order.id, tx });
        for (const line of lines) {
          const [items] = await tx.query(
            `INSERT INTO order_items (order_id, product_id, product_name, qty, size_label, base_tea,
              sugar_level, ice_level, note, unit_price, line_total)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [order.id, line.product.id, line.product.name, line.qty, line.sizeLabel, line.item.base_tea || '',
              line.item.sugar_level || '', line.item.ice_level || '', line.item.note || null, line.unitPrice, line.lineTotal],
          );
          for (const topping of line.toppings) {
            await tx.query('INSERT INTO order_item_toppings (order_item_id, topping_name, topping_price) VALUES ($1,$2,$3)', [items[0].id, topping.name, topping.price]);
          }
        }
        await tx.query("INSERT INTO order_status_history (order_id, status) VALUES ($1, 'Đang chuẩn bị')", [order.id]);
        const response = { ...order };
        if (cancelToken) response.cancel_token = cancelToken;
        await completeOrderIdempotency(tx, { key: idempotencyKey, responseStatus: 201, response });
        return { replay: false, ...response };
      });
    },

    async findPublicOrder(orderCodeValue) {
      const [rows] = await database.query(
        `SELECT o.id, o.order_code, o.user_id, o.store_id, o.location_name, o.order_type,
                o.payment_method, o.payment_status, o.payment_provider, o.paid_at,
                o.payment_link_id, o.payos_order_code, o.customer_name, o.customer_phone, o.delivery_addr,
                o.discount_amount, o.subtotal, o.total, o.payment_expires_at, o.created_at,
                o.shipping_driver_name, o.shipping_driver_phone, o.shipping_tracking_url, o.cancel_token_hash,
                s.name AS store_name, latest.status AS current_status
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         LEFT JOIN LATERAL (
           SELECT status FROM order_status_history WHERE order_id = o.id
           ORDER BY created_at DESC, id DESC LIMIT 1
         ) latest ON TRUE
         WHERE o.order_code = $1`,
        [orderCodeValue],
      );
      return rows[0] || null;
    },

    async listCustomerOrders({ userId, limit, cursor = null }) {
      const params = [userId];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor.createdAtIso, cursor.id);
        cursorClause = `AND (o.created_at < $2 OR (o.created_at = $2 AND o.id < $3))`;
      }
      params.push(limit + 1);
      const [rows] = await database.query(
        `SELECT o.id, o.order_code, o.user_id, o.store_id, o.table_id, o.location_name,
                o.order_type, o.payment_method, o.payment_status, o.payment_provider,
                o.customer_name, o.customer_phone, o.delivery_addr, o.voucher_code,
                o.discount_amount, o.subtotal, o.total, o.note, o.created_at, o.updated_at,
                s.name AS store_name, latest.status AS current_status
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         LEFT JOIN LATERAL (
           SELECT status FROM order_status_history WHERE order_id = o.id
           ORDER BY created_at DESC, id DESC LIMIT 1
         ) latest ON TRUE
         WHERE o.user_id = $1 ${cursorClause}
         ORDER BY o.created_at DESC, o.id DESC LIMIT $${params.length}`,
        params,
      );
      return normalizeRows(rows);
    },

    async loadPublicDetails(orderId) {
      const [items] = await database.query(
        `SELECT id, order_id, product_name, qty, size_label, base_tea, sugar_level, ice_level, note, unit_price, line_total
         FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
        [orderId],
      );
      const itemIds = items.map((item) => item.id);
      const [toppings] = itemIds.length
        ? await database.query(
          `SELECT order_item_id, topping_name AS name, topping_price AS price
           FROM order_item_toppings WHERE order_item_id = ANY($1::bigint[]) ORDER BY id ASC`,
          [itemIds],
        )
        : [[]];
      const byItem = new Map();
      for (const topping of toppings) byItem.set(String(topping.order_item_id), [...(byItem.get(String(topping.order_item_id)) || []), topping]);
      return normalizeRows(items).map((item) => ({ ...item, toppings: byItem.get(String(item.id)) || [] }));
    },

    async loadStatusHistory(orderId) {
      const [rows] = await database.query(
        'SELECT status, note, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC, id ASC',
        [orderId],
      );
      return rows;
    },

    async cancelCustomerOrder({ identifier, userId = null, cancelToken, reason, evaluateTransition }) {
      return database.transaction(async (tx) => {
        const isNumericId = /^\d+$/.test(String(identifier));
        const [orders] = await tx.query(
          isNumericId
            ? 'SELECT id, order_code, user_id, payment_status, cancel_token_hash FROM orders WHERE id = $1 FOR UPDATE'
            : 'SELECT id, order_code, user_id, payment_status, cancel_token_hash FROM orders WHERE order_code = $1 FOR UPDATE',
          [identifier],
        );
        const order = orders[0];
        if (!order) throw new OrderError('Không tìm thấy đơn hàng', 404);
        if (order.user_id) {
          if (!userId || Number(userId) !== Number(order.user_id)) throw new OrderError('Bạn không có quyền hủy đơn hàng này', 403);
        } else {
          if (!cancelToken) throw new OrderError('Thiếu mã hủy đơn (cancellation token)', 403);
          const providedHash = crypto.createHash('sha256').update(cancelToken).digest();
          const storedHash = Buffer.from(String(order.cancel_token_hash || '').trim(), 'hex');
          if (providedHash.length !== storedHash.length || !crypto.timingSafeEqual(providedHash, storedHash)) {
            throw new OrderError('Mã hủy đơn không chính xác hoặc không hợp lệ', 403);
          }
        }
        const [latestRows] = await tx.query(
          `SELECT status FROM order_status_history WHERE order_id = $1
           ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
          [order.id],
        );
        const transition = evaluateTransition({
          currentStatus: latestRows[0]?.status || 'Chờ xác nhận',
          targetStatus: 'Đã hủy', role: 'customer', isPaid: order.payment_status === 'paid',
        });
        if (!transition.allowed) throw new OrderError(transition.error, transition.status || 400);
        if (transition.idempotent) return { order_id: Number(order.id), order_code: order.order_code, status: 'Đã hủy', already_cancelled: true };
        const cancelReason = reason || 'Khách yêu cầu hủy đơn';
        await tx.query("INSERT INTO order_status_history (order_id, status, note) VALUES ($1, 'Đã hủy', $2)", [order.id, cancelReason]);
        await tx.query('UPDATE orders SET cancel_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id, cancelReason]);
        return { order_id: Number(order.id), order_code: order.order_code, status: 'Đã hủy' };
      });
    },
  };
}

export const ordersRepository = createOrdersRepository();
export default ordersRepository;
