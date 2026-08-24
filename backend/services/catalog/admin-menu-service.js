import defaultAdminCatalogRepository from '../../repositories/postgres/admin-catalog.js';

export function createAdminMenuService(repository = defaultAdminCatalogRepository) {
  return {
    // Categories
    async listCategories() {
      return repository.listCategories();
    },

    async createCategory(data) {
      return repository.createCategory(data);
    },

    async updateCategory(id, data) {
      return repository.updateCategory(id, data);
    },

    async deleteCategory(id) {
      return repository.deleteCategory(id);
    },

    // Products
    async listProducts(filters = {}) {
      return repository.listProducts(filters);
    },

    async createProduct(data) {
      return repository.createProduct(data);
    },

    async updateProduct(id, data) {
      return repository.updateProduct(id, data);
    },

    async setProductAvailability(id, desiredState) {
      return repository.setProductAvailability(id, desiredState);
    },

    async deleteProduct(id) {
      return repository.deleteProduct(id);
    },

    // Options
    async listOptions() {
      return repository.listOptions();
    },

    async createTopping(data) {
      return repository.createTopping(data);
    },

    async updateTopping(id, data) {
      return repository.updateTopping(id, data);
    },

    async deleteTopping(id) {
      return repository.deleteTopping(id);
    },

    async createBase(data) {
      return repository.createBase(data);
    },

    async updateBase(id, data) {
      return repository.updateBase(id, data);
    },

    async deleteBase(id) {
      return repository.deleteBase(id);
    },
  };
}

export const adminMenuService = createAdminMenuService();
export default adminMenuService;
