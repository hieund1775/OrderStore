import defaultCatalogRepository from '../../repositories/postgres/catalog.js';

export function createCatalogService(repository = defaultCatalogRepository) {
  return {
    async listProducts(filters = {}) {
      return repository.listProducts(filters);
    },

    async findProductBySlug(slug) {
      if (!slug) return null;
      return repository.findProductBySlug(String(slug).trim());
    },

    async listCategories() {
      return repository.listCategories();
    },

    async listOptions(kind) {
      return repository.listOptions(kind);
    },

    async listSearchSuggestions(query) {
      return repository.listSearchSuggestions(query || '');
    },
  };
}

export const catalogService = createCatalogService();
export default catalogService;
