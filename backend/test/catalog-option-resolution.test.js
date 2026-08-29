import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCatalogV2Service } from '../services/catalog/admin-catalog-v2-service.js';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';

function configurableProduct(attributes) {
  return {
    id: 10,
    name: 'Sản phẩm thử nghiệm',
    slug: 'san-pham-thu-nghiem',
    fulfillment_lane: 'kitchen',
    stock_mode: 'made_to_order',
    attributes,
    variants: [{
      id: 50,
      sku: 'TEST-DEFAULT',
      variant_signature: 'default',
      price: 30000,
      is_available: true,
    }],
  };
}

test('Catalog Option Visibility & Lane Inheritance Contracts', async (t) => {
  await t.test('inactive option definitions do not remain required in public configuration', { todo: 'Enable in Checkpoint D' }, async () => {
    const catalogRepository = {
      async getProductBySlug() {
        return configurableProduct([{
          id: 10,
          code: 'sugar',
          name: 'Đường',
          role: 'modifier',
          input_type: 'single_select',
          is_required: true,
          is_active: false,
          min_selections: 1,
          max_selections: 1,
          values: [{ id: 101, code: 'normal', label: 'Bình thường', is_active: true, price_adjustment: 0 }],
        }]);
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    const result = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'san-pham-thu-nghiem',
      selectedModifierValueIds: [],
    });

    assert.equal(result.unit_price, 30000);
    assert.deepEqual(result.applied_modifiers, []);
  });

  await t.test('inactive option values cannot be selected or charged', { todo: 'Enable in Checkpoint D' }, async () => {
    const catalogRepository = {
      async getProductBySlug() {
        return configurableProduct([{
          id: 11,
          code: 'topping',
          name: 'Topping',
          role: 'modifier',
          input_type: 'multi_select',
          is_required: false,
          is_active: true,
          min_selections: 0,
          max_selections: 3,
          values: [{ id: 201, code: 'old', label: 'Đã ngừng bán', is_active: false, price_adjustment: 5000 }],
        }]);
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    await assert.rejects(
      () => service.resolveConfiguration({
        storeId: 1,
        productSlug: 'san-pham-thu-nghiem',
        selectedModifierValueIds: [201],
      }),
      (err) => err?.status === 400 && err?.code === 'OPTION_VALUE_INACTIVE',
    );
  });

  await t.test('creating a product without an explicit lane preserves null for category inheritance', { todo: 'Enable in Checkpoint D' }, async () => {
    let persistedInput = null;
    const catalogRepository = {
      async createProduct(input) {
        persistedInput = input;
        return {
          id: 99,
          ...input,
          created_at: null,
          updated_at: null,
        };
      },
    };
    const service = createAdminCatalogV2Service({
      catalogRepository,
      schemaRepository: {},
    });

    await service.createProduct({
      category_id: 2,
      name: 'Nước đóng chai',
      slug: 'nuoc-dong-chai',
      price: 15000,
    });

    assert.equal(persistedInput.fulfillment_lane, null);
  });

  await t.test('root assignment is inherited and child/product overrides win', { todo: true }, () => {});
  await t.test('nearest category lane is resolved when product override is null', { todo: true }, () => {});
});
