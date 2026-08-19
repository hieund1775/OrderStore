import defaultAdminInventoryRepository from '../../repositories/postgres/admin-inventory.js';

export function createAdminInventoryService(repository = defaultAdminInventoryRepository) {
  return {
    async listInventory({ scopedStoreId } = {}) {
      return repository.listInventory({ scopedStoreId });
    },

    async updateInventory(id, { stock, safe_level, scopedStoreId }) {
      return repository.updateInventory(id, { stock, safe_level, scopedStoreId });
    },

    async logInventory(id, { change_amount, reason, reference, created_by, scopedStoreId }) {
      return repository.logInventory(id, { change_amount, reason, reference, created_by, scopedStoreId });
    },
  };
}

export const adminInventoryService = createAdminInventoryService();
export default adminInventoryService;
