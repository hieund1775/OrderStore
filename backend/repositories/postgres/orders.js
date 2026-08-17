import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';
import promotionsRepository from './promotions.js';

export class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function orderCode() {
  return `TP${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${crypto.randomInt(1000, 10000)}`;
}

export function createOrdersRepository(database = postgresDb, promotions = promotionsRepository) {
  return {
    async createOnlineOrder({ input, userId = null, idempotencyKey, requestHash }) {
      if (!idempotencyKey || idempotencyKey.length > 255) throw new OrderError('Thiếu Idempotency-Key hợp lệ');

      return database.transaction(async (tx) => {
        const [knownKeys] = await tx.query(
          `SELECT request_hash, status, response_status, response_body
           FROM idempotency_keys WHERE idempotency_key = $1 FOR UPDATE`,
          [idempotencyKey],
        );
        const known = knownKeys[0];
        if (known) {
          if (known.request_hash !== requestHash) throw new OrderError('Idempotency-Key đã được dùng cho yêu cầu khác', 409);
          if (known.status === 'completed') return { replay: true, ...known.response_body };
          throw new OrderError('Yêu cầu tạo đơn đang được xử lý, vui lòng thử lại', 409);
        }
        await tx.query(
          `INSERT INTO idempotency_keys (idempotency_key, scope, request_hash, expires_at)
           VALUES ($1, 'online-order', $2, CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
          [idempotencyKey, requestHash],
        );

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
        for (const item of input.items) {
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
          const toppingIds = [...new Set((item.topping_ids || []).map(Number).filter(Number.isInteger))];
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
        const discountAmount = voucher?.discount_amount || 0;
        const total = subtotal - discountAmount;
        const [orders] = await tx.query(
          `INSERT INTO orders (order_code, user_id, store_id, table_id, location_name, order_type,
             payment_method, payment_status, payment_provider, customer_name, customer_phone,
             delivery_addr, voucher_code, discount_amount, subtotal, total, note)
           VALUES ($1,$2,$3,$4,$5,$6,'VietQR','unpaid','payos',$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING id, order_code, subtotal, discount_amount, total, payment_status, payment_provider`,
          [orderCode(), userId, input.store_id, input.table_id || null, locationName, input.order_type || 'Take-away',
            input.customer_name, input.customer_phone, input.delivery_addr || null, input.voucher_code || null,
            discountAmount, subtotal, total, input.note || null],
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
        await tx.query(
          `UPDATE idempotency_keys SET status = 'completed', response_status = 201, response_body = $2::jsonb
           WHERE idempotency_key = $1`, [idempotencyKey, JSON.stringify(order)],
        );
        return { replay: false, ...order };
      });
    },
  };
}

export const ordersRepository = createOrdersRepository();
export default ordersRepository;
