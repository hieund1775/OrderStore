import defaultAdminStoresRepository from '../../repositories/postgres/admin-stores.js';
import { createTableQrToken, hashTableQrToken, getTableDeterministicToken } from '../table-qr-token.js';

export function createAdminStoreService(repository = defaultAdminStoresRepository) {
  return {
    async listBranches({ scopedStoreId, page, limit } = {}) {
      return repository.listBranches({ scopedStoreId, page, limit });
    },

    async createBranch(data) {
      return repository.createBranch(data);
    },

    async updateBranch(id, data) {
      return repository.updateBranch(id, data);
    },

    async deleteBranch(id) {
      return repository.deleteBranch(id);
    },

    async listTablesByStore(storeId, { scopedStoreId } = {}) {
      const rows = await repository.listTablesByStore(storeId, { scopedStoreId });
      return (rows || []).map((row) => ({
        ...row,
        qr_checkout_token: getTableDeterministicToken(row.id, row.store_id || storeId),
        has_checkout_qr: true,
      }));
    },

    async listAllTables({ scopedStoreId, page, limit } = {}) {
      let result;
      if (typeof repository.listTables === 'function') {
        result = await repository.listTables({ scopedStoreId, page, limit });
      } else if (typeof repository.listAllTables === 'function') {
        result = await repository.listAllTables({ scopedStoreId, page, limit });
      } else {
        return [];
      }

      const attachToken = (row) => {
        if (!row || !row.id || !row.store_id) return row;
        const qr_checkout_token = getTableDeterministicToken(row.id, row.store_id);
        return {
          ...row,
          qr_checkout_token,
          has_checkout_qr: true,
        };
      };

      if (Array.isArray(result)) {
        return result.map(attachToken);
      }
      if (result && Array.isArray(result.items)) {
        return {
          ...result,
          items: result.items.map(attachToken),
        };
      }
      return result;
    },

    async createTable(data, { scopedStoreId } = {}) {
      // 1. Create table record
      const created = await repository.createTable(data, { scopedStoreId });
      const table = created?.table || created;
      const targetStoreId = table.store_id || data.store_id;
      const qrToken = getTableDeterministicToken(table.id, targetStoreId);
      const tokenHash = hashTableQrToken(qrToken);
      if (typeof repository.rotateTableCheckoutToken === 'function') {
        await repository.rotateTableCheckoutToken(table.id, {
          scopedStoreId,
          qrCheckoutTokenHash: tokenHash,
        }).catch(() => {});
      }
      return { table: { ...table, qr_checkout_token: qrToken, has_checkout_qr: true }, qrToken };
    },

    async rotateTableCheckoutToken(id, { scopedStoreId } = {}) {
      const qrToken = createTableQrToken();
      const table = await repository.rotateTableCheckoutToken(id, {
        scopedStoreId,
        qrCheckoutTokenHash: hashTableQrToken(qrToken),
      });
      return { table: { ...table, qr_checkout_token: qrToken, has_checkout_qr: true }, qrToken };
    },

    async updateTable(id, data, { scopedStoreId } = {}) {
      return repository.updateTable(id, { ...data, scopedStoreId });
    },

    async deleteTable(id, { scopedStoreId } = {}) {
      return repository.deleteTable(id, { scopedStoreId });
    },
  };
}

export const adminStoreService = createAdminStoreService();
export default adminStoreService;
