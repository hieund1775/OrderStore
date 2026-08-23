import postgresDb from '../config/db-postgres.js';
import { batchLoadPostgresOrderDetails } from '../services/order-batch-loader.js';
import defaultPostgresOrdersRepository, { createOrdersRepository } from './postgres/orders.js';

function appendScope(sql, params, scopedStoreId, column = 'o.store_id') {
  if (scopedStoreId) {
    params.push(scopedStoreId);
    return `${sql} AND ${column} = $${params.length}`;
  }
  return sql;
}

/**
 * Read-only order persistence boundary. Mutation locking and transactions stay
 * in repositories/postgres/admin-orders.js until the following slice.
 */
export function createOrderReadRepository(database = postgresDb) {
  return {
    async listAdmin({ status, scopedStoreId, dateFrom, dateTo, search, cursor, limit }) {
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

    async getAdminDetail({ orderId, scopedStoreId }) {
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

    async listKitchen({ scopedStoreId }) {
      const params = [];
      let filter = "WHERE (o.payment_status = 'paid' OR o.payment_method = 'COD' OR o.order_type = 'POS') AND latest.status IN ('Đang chuẩn bị', 'Chờ xác nhận')";
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

export const orderReadRepository = createOrderReadRepository();
export { createOrdersRepository, defaultPostgresOrdersRepository as ordersRepository };
export default orderReadRepository;
