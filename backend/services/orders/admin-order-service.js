import { buildPageInfo } from '../cursor-pagination.js';
import adminOrdersRepository from '../../repositories/postgres/admin-orders.js';

/**
 * HTTP-agnostic composition for admin and KDS reads. Scope resolution and
 * validation remain at the route boundary; this service receives only values.
 */
export function createAdminOrderService(repository = adminOrdersRepository) {
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

    listKitchen({ storeId }) {
      return repository.listKitchen({ scopedStoreId: storeId });
    },
  };
}

export const adminOrderService = createAdminOrderService();
export default adminOrderService;
