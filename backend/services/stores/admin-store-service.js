import defaultAdminStoresRepository from '../../repositories/postgres/admin-stores.js';
import { createTableQrToken, hashTableQrToken } from '../table-qr-token.js';

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
      return repository.listTablesByStore(storeId, { scopedStoreId });
    },

    async listAllTables({ scopedStoreId, page, limit } = {}) {
      if (typeof repository.listTables === 'function') {
        return repository.listTables({ scopedStoreId, page, limit });
      }
      if (typeof repository.listAllTables === 'function') {
        return repository.listAllTables({ scopedStoreId, page, limit });
      }
      return [];
    },

    async createTable(data, { scopedStoreId } = {}) {
      const qrToken = createTableQrToken();
      const table = await repository.createTable({
        ...data,
        qrCheckoutTokenHash: hashTableQrToken(qrToken),
      }, { scopedStoreId });
      return { table, qrToken };
    },

    async rotateTableCheckoutToken(id, { scopedStoreId } = {}) {
      const qrToken = createTableQrToken();
      const table = await repository.rotateTableCheckoutToken(id, {
        scopedStoreId,
        qrCheckoutTokenHash: hashTableQrToken(qrToken),
      });
      return { table, qrToken };
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
