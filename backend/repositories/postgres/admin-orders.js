import postgresDb from '../../config/db-postgres.js';
import { batchLoadPostgresOrderDetails } from '../../services/order-batch-loader.js';
import { OrderDomainError } from '../../services/orders/order-errors.js';

export class AdminOrderError extends OrderDomainError {
  constructor(message, status = 400, code = 'ADMIN_ORDER_BUSINESS_RULE') {
    super(message, { status, code, expose: true });
    this.name = 'AdminOrderError';
  }
}

function appendScope(sql, params, scopedStoreId, column = 'o.store_id') {
  if (scopedStoreId) {
    params.push(scopedStoreId);
    return `${sql} AND ${column} = $${params.length}`;
  }
  return sql;
}

export function createAdminOrdersRepository(database = postgresDb) {
  return {
    async list({ status, scopedStoreId, dateFrom, dateTo, search, cursor, limit }) {
      const params = [];
      let filters = 'WHERE TRUE';
      if (status) {
        params.push(status);
        filters += ` AND latest.status = $${params.length}`;
      }
      filters = appendScope(filters, params, scopedStoreId);
      if (dateFrom) {
        params.push(dateFrom);
        filters += ` AND o.created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        filters += ` AND o.created_at < $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        filters += ` AND (o.order_code ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_phone ILIKE $${params.length})`;
      }
      if (cursor) {
        params.push(cursor.createdAtIso, cursor.id);
        filters += ` AND (o.created_at < $${params.length - 1} OR (o.created_at = $${params.length - 1} AND o.id < $${params.length}))`;
      }
      params.push(limit + 1);
      const [rows] = await database.query(
        `SELECT o.id, o.order_code, o.user_id, o.store_id, o.table_id, o.location_name,
                o.order_type, o.payment_method, o.payment_status, o.payment_provider,
                o.customer_name, o.customer_phone, o.delivery_addr, o.voucher_code,
                o.discount_amount, o.subtotal, o.total, o.shipping_driver_name,
                o.shipping_driver_phone, o.shipping_tracking_url, o.is_printed,
                o.note, o.cancel_reason, o.created_at, o.updated_at, s.name AS store_name,
                latest.status AS current_status
         FROM orders o JOIN stores s ON s.id = o.store_id
         LEFT JOIN LATERAL (SELECT status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1) latest ON TRUE
         ${filters} ORDER BY o.created_at DESC, o.id DESC LIMIT $${params.length}`,
        params,
      );
      return rows;
    },

    async detail({ orderId, scopedStoreId }) {
      const params = [orderId];
      let filter = 'WHERE o.id = $1';
      filter = appendScope(filter, params, scopedStoreId);
      const [orders] = await database.query(
        `SELECT o.*, s.name AS store_name, latest.status AS current_status
         FROM orders o JOIN stores s ON s.id = o.store_id
         LEFT JOIN LATERAL (SELECT status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1) latest ON TRUE
         ${filter}`,
        params,
      );
      const order = orders[0];
      if (!order) return null;
      await batchLoadPostgresOrderDetails([order], database.query);
      const [history] = await database.query(
        `SELECT osh.*, u.fullname AS changed_by_name FROM order_status_history osh
         LEFT JOIN users u ON u.id = osh.changed_by WHERE osh.order_id = $1 ORDER BY osh.created_at ASC, osh.id ASC`,
        [order.id],
      );
      return { ...order, status_history: history };
    },

    async transition({ orderId, scopedStoreId, targetStatus, note, actorId, actorRole, driverName, driverPhone, trackingUrl, cancelReason, evaluateTransition }) {
      return database.transaction(async (tx) => {
        const params = [orderId];
        let filter = 'WHERE id = $1';
        filter = appendScope(filter, params, scopedStoreId, 'store_id');
        const [orders] = await tx.query(`SELECT id, payment_status FROM orders ${filter} FOR UPDATE`, params);
        const order = orders[0];
        if (!order) throw new AdminOrderError('Không tìm thấy đơn hàng hoặc không có quyền thao tác', 404);
        const [current] = await tx.query('SELECT status FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE', [order.id]);
        const transition = evaluateTransition({ currentStatus: current[0]?.status || 'Chờ xác nhận', targetStatus, role: actorRole, isPaid: order.payment_status === 'paid' });
        if (!transition.allowed) throw new AdminOrderError(transition.error, transition.status || 400);
        if (transition.idempotent) return { order_id: Number(order.id), status: targetStatus, idempotent: true };
        await tx.query('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)', [order.id, targetStatus, note || null, actorId]);
        if (targetStatus === 'Đã hủy') await tx.query('UPDATE orders SET cancel_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id, cancelReason || note]);
        if (targetStatus === 'Đang chuẩn bị') await tx.query('UPDATE orders SET kitchen_notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id]);
        if (targetStatus === 'Đang giao' && (driverName || driverPhone || trackingUrl)) {
          await tx.query('UPDATE orders SET shipping_driver_name = $2, shipping_driver_phone = $3, shipping_tracking_url = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id, driverName || null, driverPhone || null, trackingUrl || null]);
        }
        return { order_id: Number(order.id), status: targetStatus };
      });
    },

    async cancel({ orderId, scopedStoreId, reason, actorId, actorRole, evaluateTransition }) {
      const result = await this.transition({ orderId, scopedStoreId, targetStatus: 'Đã hủy', note: reason || `Hủy bởi ${actorRole}`, cancelReason: reason || `Hủy bởi ${actorRole}`, actorId, actorRole, evaluateTransition });
      return { ...result, already_cancelled: Boolean(result.idempotent) };
    },

    async confirmPayment({ orderId, scopedStoreId, actorId }) {
      return database.transaction(async (tx) => {
        const params = [orderId];
        let filter = 'WHERE id = $1';
        filter = appendScope(filter, params, scopedStoreId, 'store_id');
        const [orders] = await tx.query(`SELECT id, payment_status, payment_provider FROM orders ${filter} FOR UPDATE`, params);
        const order = orders[0];
        if (!order) throw new AdminOrderError('Không tìm thấy đơn hàng hoặc không có quyền thao tác', 404);
        if (order.payment_provider === 'payos') throw new AdminOrderError('Đơn hàng PayOS được xác nhận tự động qua Webhook, không thể xác nhận thủ công');
        if (order.payment_status === 'paid') return { alreadyPaid: true };
        if (order.payment_status === 'expired') throw new AdminOrderError('Đơn hàng đã hết hạn thanh toán, không thể xác nhận thủ công');
        if (!['manual_vietqr', 'cod', 'momo', 'zalopay'].includes(order.payment_provider || 'cod')) throw new AdminOrderError('Không thể xác nhận thanh toán cho đơn hàng');
        await tx.query("UPDATE orders SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, paid_verified_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order.id, actorId]);
        return { alreadyPaid: false };
      });
    },

    async markPrinted({ orderId, scopedStoreId }) {
      const params = [orderId];
      let filter = 'WHERE id = $1';
      filter = appendScope(filter, params, scopedStoreId, 'store_id');
      const [, affected] = await database.query(`UPDATE orders SET is_printed = TRUE, updated_at = CURRENT_TIMESTAMP ${filter}`, params);
      return affected > 0;
    },

    async listKitchen({ scopedStoreId }) {
      const params = [];
      let filter = "WHERE o.payment_status = 'paid' AND latest.status IN ('Đang chuẩn bị', 'Chờ xác nhận')";
      filter = appendScope(filter, params, scopedStoreId);
      const [orders] = await database.query(
        `SELECT o.id, o.order_code, o.order_type, o.customer_name, o.customer_phone, o.delivery_addr, o.table_id, o.store_id, o.location_name, o.note, o.subtotal, o.discount_amount, o.total, o.payment_method, o.payment_status, o.payment_provider, o.paid_at, o.created_at, s.name AS store_name, latest.status AS current_status
         FROM orders o JOIN stores s ON s.id = o.store_id
         JOIN LATERAL (SELECT status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1) latest ON TRUE
         ${filter} ORDER BY o.created_at ASC`,
        params,
      );
      return batchLoadPostgresOrderDetails(orders, database.query);
    },
  };
}

export const adminOrdersRepository = createAdminOrdersRepository();
export default adminOrdersRepository;
