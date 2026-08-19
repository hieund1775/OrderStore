import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import catalogRepository from '../repositories/postgres/catalog.js';
import adminCatalogRepository from '../repositories/postgres/admin-catalog.js';

const superToken = jwt.sign({ sub: 1, role: 'super' }, JWT_SECRET);
const cashierToken = jwt.sign({ sub: 2, role: 'cashier' }, JWT_SECRET);

describe('Phase 3 Slice 2 Catalog & Menu HTTP Characterization', () => {
  let server;
  let baseUrl;
  let originals;

  before(async () => {
    originals = {
      listProducts: catalogRepository.listProducts,
      findProductBySlug: catalogRepository.findProductBySlug,
      listCategories: catalogRepository.listCategories,
      listOptions: catalogRepository.listOptions,
      listSearchSuggestions: catalogRepository.listSearchSuggestions,
      adminListCategories: adminCatalogRepository.listCategories,
      adminCreateCategory: adminCatalogRepository.createCategory,
      adminListProducts: adminCatalogRepository.listProducts,
      adminCreateProduct: adminCatalogRepository.createProduct,
      adminToggleProduct: adminCatalogRepository.toggleProductAvailability,
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    Object.assign(catalogRepository, {
      listProducts: originals.listProducts,
      findProductBySlug: originals.findProductBySlug,
      listCategories: originals.listCategories,
      listOptions: originals.listOptions,
      listSearchSuggestions: originals.listSearchSuggestions,
    });
    Object.assign(adminCatalogRepository, {
      listCategories: originals.adminListCategories,
      createCategory: originals.adminCreateCategory,
      listProducts: originals.adminListProducts,
      createProduct: originals.adminCreateProduct,
      toggleProductAvailability: originals.adminToggleProduct,
    });
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves public products, categories, options, and suggestions with correct DTO shape', async () => {
    catalogRepository.listProducts = async () => [
      { id: 1, category_id: 2, name: 'Trà Đào Cam Sả', slug: 'tra-dao', price: 45000, tags: '["best-seller"]' },
    ];
    catalogRepository.findProductBySlug = async (slug) => {
      if (slug === 'tra-dao') return { id: 1, category_id: 2, name: 'Trà Đào Cam Sả', slug: 'tra-dao', price: 45000 };
      return null;
    };
    catalogRepository.listCategories = async () => [
      { id: 2, name: 'Trà Trái Cây', slug: 'tra-trai-cay', sort_order: 1 },
    ];
    catalogRepository.listOptions = async (kind) => [
      { id: 1, name: `${kind}-opt`, price: 10000 },
    ];
    catalogRepository.listSearchSuggestions = async (q) => ({
      products: ['Trà Đào'],
      toppings: ['Trân châu'],
    });

    const productsRes = await fetch(`${baseUrl}/api/products`);
    assert.equal(productsRes.status, 200);
    const products = await productsRes.json();
    assert.equal(products[0].name, 'Trà Đào Cam Sả');
    assert.deepEqual(products[0].tags, ['best-seller']);

    const detailRes = await fetch(`${baseUrl}/api/products/tra-dao`);
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.slug, 'tra-dao');

    const notFoundRes = await fetch(`${baseUrl}/api/products/non-existent`);
    assert.equal(notFoundRes.status, 404);

    const categoriesRes = await fetch(`${baseUrl}/api/categories`);
    assert.equal(categoriesRes.status, 200);
    const categories = await categoriesRes.json();
    assert.equal(categories[0].name, 'Trà Trái Cây');

    const optionsRes = await fetch(`${baseUrl}/api/options/sizes`);
    assert.equal(optionsRes.status, 200);
    const options = await optionsRes.json();
    assert.equal(options[0].name, 'sizes-opt');

    const suggestRes = await fetch(`${baseUrl}/api/search/suggestions?q=tra`);
    assert.equal(suggestRes.status, 200);
    const suggestions = await suggestRes.json();
    assert.deepEqual(suggestions.products, ['Trà Đào']);
  });

  it('enforces RBAC on admin menu operations (super vs cashier)', async () => {
    adminCatalogRepository.createCategory = async (data) => ({ id: 10, ...data });

    // Cashier cannot create categories (requires super)
    const cashierCreate = await fetch(`${baseUrl}/admin/menu/categories`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cashierToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trà Sữa Mới', slug: 'tra-sua-moi' }),
    });
    assert.equal(cashierCreate.status, 403);

    // Super can create categories
    const superCreate = await fetch(`${baseUrl}/admin/menu/categories`, {
      method: 'POST',
      headers: { authorization: `Bearer ${superToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trà Sữa Mới', slug: 'tra-sua-moi' }),
    });
    assert.equal(superCreate.status, 201);
    const created = await superCreate.json();
    assert.equal(created.name, 'Trà Sữa Mới');
  });
});
