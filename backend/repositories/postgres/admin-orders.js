import postgresDb from '../../config/db-postgres.js';
import { OrderDomainError } from '../../services/orders/order-errors.js';
import { createOrderReadRepository } from '../orders.js';
import { normalizeAndValidatePhone } from '../../validation/customer-schemas.js';
import defaultNotificationsRepository from './notifications.js';

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

export function createAdminOrdersRepository(
  database = postgresDb,
  notifications = defaultNotificationsRepository,
) {
  const readRepository = createOrderReadRepository(database);
  return {
    async list({ status, scopedStoreId, dateFrom, dateTo, search, cursor, limit }) {
      return readRepository.listAdmin({ status, scopedStoreId, dateFrom, dateTo, search, cursor, limit });
    },

    async detail({ orderId, scopedStoreId }) {
      return readRepository.getAdminDetail({ orderId, scopedStoreId });
    },

    async transition({ orderId, scopedStoreId, targetStatus, note, actorId, actorRole, driverName, driverPhone, trackingUrl, cancelReason, evaluateTransition }) {
      return database.transaction(async (tx) => {
        const params = [orderId];
        let filter = 'WHERE id = $1';
        filter = appendScope(filter, params, scopedStoreId, 'store_id');
        const [orders] = await tx.query(`SELECT id, order_code, user_id, store_id, payment_status, order_type FROM orders ${filter} FOR UPDATE`, params);
        const order = orders[0];
        if (!order) throw new AdminOrderError('Không tìm thấy đơn hàng hoặc không có quyền thao tác', 404);
        const [current] = await tx.query('SELECT status FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE', [order.id]);
        const transition = evaluateTransition({ currentStatus: current[0]?.status || 'Chờ xác nhận', targetStatus, role: actorRole, isPaid: order.payment_status === 'paid' });
        if (!transition.allowed) throw new AdminOrderError(transition.error, transition.status || 400);
        if (targetStatus === 'Đang giao' && order.order_type !== 'Delivery') {
          throw new AdminOrderError('Chỉ đơn giao hàng Delivery mới được chuyển sang trạng thái Đang giao', 400);
        }
        if (transition.idempotent) return { order_id: Number(order.id), status: targetStatus, idempotent: true };

        let normalizedDriverPhone = null;
        let normalizedDriverName = null;
        if (targetStatus === 'Đang giao' && order.order_type === 'Delivery') {
          if (!driverName || typeof driverName !== 'string' || driverName.trim().length < 2) {
            throw new AdminOrderError('Đơn giao hàng yêu cầu đầy đủ tên Shipper (tối thiểu 2 ký tự)', 400);
          }
          if (!driverPhone || typeof driverPhone !== 'string' || !driverPhone.trim()) {
            throw new AdminOrderError('Đơn giao hàng yêu cầu số điện thoại Shipper hợp lệ', 400);
          }
          try {
            normalizedDriverPhone = normalizeAndValidatePhone(driverPhone);
          } catch (err) {
            throw new AdminOrderError('Số điện thoại Shipper không hợp lệ (yêu cầu 10 chữ số Việt Nam hoặc chuẩn quốc tế E.164)', 400);
          }
          normalizedDriverName = driverName.trim();
        } else if (driverName || driverPhone) {
          normalizedDriverName = driverName ? driverName.trim() : null;
          if (driverPhone) {
            try {
              normalizedDriverPhone = normalizeAndValidatePhone(driverPhone, { required: false });
            } catch {
              normalizedDriverPhone = driverPhone.trim();
            }
          }
        }

        await tx.query('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)', [order.id, targetStatus, note || null, actorId]);
        if (targetStatus === 'Đã hủy') await tx.query('UPDATE orders SET cancel_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id, cancelReason || note]);
        if (targetStatus === 'Đang chuẩn bị') await tx.query('UPDATE orders SET kitchen_notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id]);
        if (targetStatus === 'Đang giao') {
          await tx.query('UPDATE orders SET shipping_driver_name = $2, shipping_driver_phone = $3, shipping_tracking_url = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [order.id, normalizedDriverName || null, normalizedDriverPhone || null, trackingUrl || null]);
        }

        if (order.user_id) {
          if (targetStatus === 'Đang giao') {
            await notifications.insertForUser({
              userId: order.user_id,
              type: 'order',
              title: `Đơn hàng #${order.order_code} đang được giao`,
              body: `Tài xế ${normalizedDriverName || 'giao hàng'} (SĐT: ${normalizedDriverPhone || ''}) đang vận chuyển đơn hàng tới bạn.`,
              link: `/theo-doi-don?code=${order.order_code}`,
            }, { tx });
          } else if (targetStatus === 'Hoàn thành') {
            await notifications.insertForUser({
              userId: order.user_id,
              type: 'order',
              title: `Đơn hàng #${order.order_code} đã hoàn thành`,
              body: `Đơn hàng #${order.order_code} đã được hoàn tất thành công. Chúc bạn ngon miệng!`,
              link: `/theo-doi-don?code=${order.order_code}`,
            }, { tx });
          } else if (targetStatus === 'Đã hủy') {
            await notifications.insertForUser({
              userId: order.user_id,
              type: 'order',
              title: `Đơn hàng #${order.order_code} đã bị hủy`,
              body: `Đơn hàng #${order.order_code} đã bị hủy.${cancelReason || note ? ' Lý do: ' + (cancelReason || note) : ''}`,
              link: `/theo-doi-don?code=${order.order_code}`,
            }, { tx });
          }
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
      return readRepository.listKitchen({ scopedStoreId });
    },

    async listPendingPayOS({ scopedStoreId }) {
      return readRepository.listPendingPayOS({ scopedStoreId });
    },
  };
}

export const adminOrdersRepository = createAdminOrdersRepository();
export default adminOrdersRepository;
