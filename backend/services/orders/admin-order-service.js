import { buildPageInfo } from '../cursor-pagination.js';
import adminOrdersRepository from '../../repositories/postgres/admin-orders.js';
import { evaluateOrderTransition } from '../order-transition-policy.js';
import defaultPaymentsRepository from '../../repositories/postgres/payments.js';
import { reconcilePayOSOrder } from '../payos-reconciliation.js';

/**
 * HTTP-agnostic composition for admin and KDS reads. Scope resolution and
 * validation remain at the route boundary; this service receives only values.
 */
export function createAdminOrderService(repository = adminOrdersRepository, paymentsRepository = defaultPaymentsRepository) {
  return {
    async list({ status, storeId, dateFrom, dateTo, search, cursor, limit, paginated = false }) {
      const rows = await repository.list({
        status,
        scopedStoreId: storeId,
        dateFrom,
        dateTo,
        search,
        cursor,
        limit,
      });
      if (!paginated) return rows;
      const { rows: orders, page_info } = buildPageInfo({ rows, limit });
      return { orders, page_info };
    },

    getDetail({ orderId, storeId }) {
      return repository.detail({ orderId, scopedStoreId: storeId });
    },

    async listKitchen({ storeId }) {
      if (typeof repository.listPendingPayOS === 'function') {
        const pending = await repository.listPendingPayOS({ scopedStoreId: storeId });
        await Promise.all(pending.map((order) => reconcilePayOSOrder({ order, paymentRepository: paymentsRepository })));
      }
      return repository.listKitchen({ scopedStoreId: storeId });
    },

    updateStatus({ orderId, storeId, status, note, actor, driverName, driverPhone, trackingUrl }) {
      return repository.transition({
        orderId,
        scopedStoreId: storeId,
        targetStatus: status,
        note,
        actorId: actor.id,
        actorRole: actor.role,
        driverName,
        driverPhone,
        trackingUrl,
        evaluateTransition: evaluateOrderTransition,
      });
    },

    cancel({ orderId, storeId, reason, actor }) {
      return repository.cancel({
        orderId,
        scopedStoreId: storeId,
        reason,
        actorId: actor.id,
        actorRole: actor.role,
        evaluateTransition: evaluateOrderTransition,
      });
    },

    confirmPayment({ orderId, storeId, actor }) {
      return repository.confirmPayment({
        orderId,
        scopedStoreId: storeId,
        actorId: actor.id,
      });
    },

    markPrinted({ orderId, storeId }) {
      return repository.markPrinted({ orderId, scopedStoreId: storeId });
    },
  };
}

export const adminOrderService = createAdminOrderService();
export default adminOrderService;
