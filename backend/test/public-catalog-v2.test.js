import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';

test('Public Catalog V2 Service: builds 3-level nested category tree', async () => {
  const fakeRepo = {
    async getCategoryTree() {
      return [
        { id: 1, name: 'Đồ Uống', slug: 'do-uong', parent_id: null, depth: 0 },
        { id: 2, name: 'Trà Trái Cây', slug: 'tra-trai-cay', parent_id: 1, depth: 1 },
        { id: 3, name: 'Trà Đào Series', slug: 'tra-dao-series', parent_id: 2, depth: 2 },
      ];
    },
  };

  const service = createPublicCatalogV2Service({ catalogRepository: fakeRepo });
  const tree = await service.getCategoryTree();

  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, 'Đồ Uống');
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].name, 'Trà Trái Cây');
  assert.equal(tree[0].children[0].children.length, 1);
  assert.equal(tree[0].children[0].children[0].name, 'Trà Đào Series');
});

test('Public Catalog V2 Service: resolves configuration and sums modifier price extras', async () => {
  const fakeRepo = {
    async getProductBySlug(slug) {
      return {
        id: 10,
        name: 'Trà Sữa Oolong',
        slug: 'tra-sua-oolong',
        price: 35000,
        stock_mode: 'made_to_order',
        fulfillment_lane: 'kitchen',
        attributes: [
          {
            id: 1,
            code: 'size',
            name: 'Kích cỡ',
            role: 'modifier',
            values: [
              { id: 101, code: 'm', label: 'Size M', price_adjustment: 0 },
              { id: 102, code: 'l', label: 'Size L', price_adjustment: 8000 },
            ],
          },
          {
            id: 2,
            code: 'toppings',
            name: 'Topping',
            role: 'modifier',
            values: [
              { id: 201, code: 'tran-chau', label: 'Trân Châu', price_adjustment: 5000 },
            ],
          },
        ],
        variants: [
          { id: 50, sku: 'SKU-10-DEF', variant_signature: 'default', price: 35000, is_available: true },
        ],
      };
    },
  };

  const service = createPublicCatalogV2Service({ catalogRepository: fakeRepo });
  const resolved = await service.resolveConfiguration({
    productSlug: 'tra-sua-oolong',
    selectedVariantValueIds: [],
    selectedModifierValueIds: [102, 201], // Size L (+8000) + Trân Châu (+5000)
  });

  assert.equal(resolved.base_price, 35000);
  assert.equal(resolved.modifier_extra, 13000);
  assert.equal(resolved.unit_price, 48000);
  assert.equal(resolved.applied_modifiers.length, 2);
});
