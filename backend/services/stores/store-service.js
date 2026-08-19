import defaultStoresRepository from '../../repositories/postgres/stores.js';

export function createStoreService(repository = defaultStoresRepository) {
  return {
    async listActiveStores(filters = {}) {
      return repository.listActiveStores(filters);
    },

    async listStoreDistricts() {
      if (typeof repository.listActiveDistricts === 'function') {
        return repository.listActiveDistricts();
      }
      if (typeof repository.listStoreDistricts === 'function') {
        return repository.listStoreDistricts();
      }
      return [];
    },

    async resolveTable(tableId) {
      if (!tableId) return null;
      return repository.resolveTable(tableId);
    },
  };
}

export const storeService = createStoreService();
export default storeService;
