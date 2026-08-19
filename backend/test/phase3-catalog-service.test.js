import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogService } from '../services/catalog/catalog-service.js';
import { createAdminMenuService } from '../services/catalog/admin-menu-service.js';

describe('Phase 3 Catalog & Admin Menu Service Unit Tests', () => {
  it('delegates public catalog queries to repository without Express objects', async () => {
    let listProductsCalled = false;
    let findBySlugCalled = false;

    const catalogService = createCatalogService({
      async listProducts(filters) {
        listProductsCalled = true;
        return [{ id: 1, name: 'Trà Xanh' }];
      },
      async findProductBySlug(slug) {
        findBySlugCalled = slug;
        return { id: 1, slug: 'tra-xanh' };
      },
      async listCategories() {
        return [{ id: 1, name: 'Trà' }];
      },
      async listOptions(kind) {
        return [{ id: 1, kind }];
      },
      async listSearchSuggestions(query) {
        return { products: [], toppings: [] };
      },
    });

    const products = await catalogService.listProducts({ category: 'tra' });
    assert.equal(products.length, 1);
    assert.equal(listProductsCalled, true);

    const product = await catalogService.findProductBySlug('tra-xanh');
    assert.equal(product.slug, 'tra-xanh');
    assert.equal(findBySlugCalled, 'tra-xanh');

    assert.equal(await catalogService.findProductBySlug(''), null);
  });

  it('delegates admin menu CRUD operations cleanly', async () => {
    let createdCategory = null;
    let toggledProductId = null;

    const adminMenuService = createAdminMenuService({
      async listCategories() { return []; },
      async createCategory(data) { createdCategory = data; return { id: 1, ...data }; },
      async updateCategory(id, data) { return { id, ...data }; },
      async deleteCategory(id) { return true; },
      async listProducts() { return []; },
      async createProduct(data) { return { id: 1, ...data }; },
      async updateProduct(id, data) { return { id, ...data }; },
      async toggleProductAvailability(id) { toggledProductId = id; return { id, is_available: false }; },
      async deleteProduct(id) { return true; },
      async listOptions() { return []; },
      async createTopping(data) { return { id: 1, ...data }; },
      async updateTopping(id, data) { return { id, ...data }; },
      async deleteTopping(id) { return true; },
      async createBase(data) { return { id: 1, ...data }; },
      async updateBase(id, data) { return { id, ...data }; },
      async deleteBase(id) { return true; },
    });

    const cat = await adminMenuService.createCategory({ name: 'Cà phê', slug: 'ca-phe' });
    assert.equal(createdCategory.name, 'Cà phê');
    assert.equal(cat.id, 1);

    const toggled = await adminMenuService.toggleProduct(5);
    assert.equal(toggledProductId, 5);
    assert.equal(toggled.is_available, false);
  });
});
