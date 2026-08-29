import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCatalogV2Service } from '../services/catalog/admin-catalog-v2-service.js';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';
import { resolveProductOptions } from '../services/catalog/catalog-option-resolver.js';
import { resolveFulfillmentLane } from '../services/catalog/fulfillment-lane-resolver.js';

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
  await t.test('inactive option definitions do not remain required in public configuration', async () => {
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

  await t.test('inactive option values cannot be selected or charged', async () => {
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

  await t.test('creating a product without an explicit lane preserves null for category inheritance', async () => {
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

  await t.test('root assignment is inherited and child/product overrides win', async () => {
    const categoryAssignments = [
      {
        category_id: 1,
        category_name: 'Nước uống',
        attribute_definition_id: 10,
        attribute_code: 'sugar',
        attribute_name: 'Đường',
        attribute_role: 'modifier',
        is_enabled: true,
        sort_order: 1,
      },
      {
        category_id: 2,
        category_name: 'Nước đóng chai',
        attribute_definition_id: 10,
        attribute_code: 'sugar',
        attribute_name: 'Đường',
        attribute_role: 'modifier',
        is_enabled: false, // Disabled at child category
        sort_order: 1,
      },
    ];

    const productOverrides = [
      {
        product_id: 105,
        attribute_definition_id: 10,
        is_enabled: true, // Re-enabled at product level
        sort_order: 2,
      },
    ];

    // Case 1: Category 2 product without override -> sugar is disabled
    const resolvedCat2 = resolveProductOptions({
      categoryAssignments,
      productOverrides: [],
    });
    assert.equal(resolvedCat2.length, 0);

    // Case 2: Product 105 with override -> sugar is enabled
    const resolvedProd = resolveProductOptions({
      categoryAssignments,
      productOverrides,
    });
    assert.equal(resolvedProd.length, 1);
    assert.equal(resolvedProd[0].is_enabled, true);
    assert.equal(resolvedProd[0].is_overridden, true);
  });

  await t.test('nearest category lane is resolved when product override is null', async () => {
    const lineage = [
      { id: 1, depth: 0, default_fulfillment_lane: 'kitchen' },
      { id: 2, depth: 1, default_fulfillment_lane: 'packing' },
    ];

    const prodNull = { id: 10, category_id: 2, fulfillment_lane: null };
    const prodOverride = { id: 11, category_id: 2, fulfillment_lane: 'kitchen' };

    // Null inherits nearest (packing from depth 1)
    assert.equal(resolveFulfillmentLane({ product: prodNull, lineage }), 'packing');
    // Explicit override wins
    assert.equal(resolveFulfillmentLane({ product: prodOverride, lineage }), 'kitchen');
  });
});
