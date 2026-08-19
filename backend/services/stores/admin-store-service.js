import defaultAdminStoresRepository from '../../repositories/postgres/admin-stores.js';

export function createAdminStoreService(repository = defaultAdminStoresRepository) {
  return {
    async listBranches({ scopedStoreId } = {}) {
      return repository.listBranches({ scopedStoreId });
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

    async listAllTables({ scopedStoreId } = {}) {
      if (typeof repository.listTables === 'function') {
        return repository.listTables({ scopedStoreId });
      }
      if (typeof repository.listAllTables === 'function') {
        return repository.listAllTables({ scopedStoreId });
      }
      return [];
    },

    async createTable(data, { scopedStoreId } = {}) {
      return repository.createTable(data, { scopedStoreId });
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
