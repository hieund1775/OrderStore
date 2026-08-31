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

  await t.test('product preset overrides category preset and marks attribute as locked', async () => {
    const categoryAssignments = [
      { category_id: 2, attribute_definition_id: 10, is_enabled: true, sort_order: 1 },
      { category_id: 2, attribute_definition_id: 11, is_enabled: true, sort_order: 2 },
    ];
    const categoryPresets = [
      { target_type: 'category', target_id: 2, attribute_definition_id: 10, attribute_value_ids: [101], is_locked: false },
    ];
    const productPresets = [
      { target_type: 'product', target_id: 105, attribute_definition_id: 10, attribute_value_ids: [102], is_locked: true },
    ];

    const resolved = resolveProductOptions({
      categoryAssignments,
      productOverrides: [],
      categoryPresets,
      productPresets,
    });

    assert.equal(resolved.length, 2);
    const attr10 = resolved.find((r) => r.attribute_definition_id === 10);
    assert.deepEqual(attr10.preset_value_ids, [102]);
    assert.equal(attr10.is_locked, true);
  });

  await t.test('resolveConfiguration rejects conflicting modifier value on locked attribute', async () => {
    const catalogRepository = {
      async getProductBySlug() {
        return configurableProduct([{
          id: 10,
          code: 'sugar',
          name: 'Đường',
          role: 'modifier',
          input_type: 'single_select',
          is_required: true,
          is_active: true,
          min_selections: 1,
          max_selections: 1,
          preset_value_ids: [101],
          is_locked: true,
          values: [
            { id: 101, code: '100_sugar', label: '100% Đường', is_active: true, price_adjustment: 0 },
            { id: 102, code: '50_sugar', label: '50% Đường', is_active: true, price_adjustment: 0 },
          ],
        }]);
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    // Client selects value 102, which conflicts with locked value 101
    await assert.rejects(
      () => service.resolveConfiguration({
        storeId: 1,
        productSlug: 'san-pham-thu-nghiem',
        selectedModifierValueIds: [102],
      }),
      (err) => err?.status === 400 && err?.message?.includes('đã bị khóa cố định'),
    );
  });

  await t.test('resolveConfiguration auto-injects locked modifier value if not supplied', async () => {
    const catalogRepository = {
      async getProductBySlug() {
        return configurableProduct([{
          id: 10,
          code: 'sugar',
          name: 'Đường',
          role: 'modifier',
          input_type: 'single_select',
          is_required: true,
          is_active: true,
          min_selections: 1,
          max_selections: 1,
          preset_value_ids: [101],
          is_locked: true,
          values: [
            { id: 101, code: '100_sugar', label: '100% Đường', is_active: true, price_adjustment: 0 },
            { id: 102, code: '50_sugar', label: '50% Đường', is_active: true, price_adjustment: 0 },
          ],
        }]);
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    // Client sends empty modifiers, server auto-injects locked preset [101]
    const result = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'san-pham-thu-nghiem',
      selectedModifierValueIds: [],
    });

    assert.equal(result.applied_modifiers.length, 1);
    assert.equal(result.applied_modifiers[0].attribute_value_id, 101);
  });

  await t.test('resolveConfiguration multi-select locked preset [A, B] handles empty, partial, exact, and foreign selections', async () => {
    const catalogRepository = {
      async getProductBySlug() {
        return configurableProduct([{
          id: 30,
          code: 'toppings',
          name: 'Topping Cố Định',
          role: 'modifier',
          input_type: 'multi_select',
          is_required: false,
          is_active: true,
          min_selections: 0,
          max_selections: 5,
          preset_value_ids: [301, 302],
          is_locked: true,
          values: [
            { id: 301, code: 'pearl', label: 'Trân Châu', is_active: true, price_adjustment: 5000 },
            { id: 302, code: 'pudding', label: 'Pudding', is_active: true, price_adjustment: 8000 },
            { id: 303, code: 'jelly', label: 'Thạch', is_active: true, price_adjustment: 3000 },
          ],
        }]);
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    // 1. Client sends [] -> auto-injects [301, 302] (Total 5000 + 8000 = 13000 + 30000 = 43000)
    const resEmpty = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'san-pham-thu-nghiem',
      selectedModifierValueIds: [],
    });
    assert.equal(resEmpty.applied_modifiers.length, 2);
    assert.deepEqual(resEmpty.applied_modifiers.map((m) => m.attribute_value_id).sort(), [301, 302]);
    assert.equal(resEmpty.unit_price, 43000);

    // 2. Client sends partial [301] -> auto-completes to [301, 302]
    const resPartial = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'san-pham-thu-nghiem',
      selectedModifierValueIds: [301],
    });
    assert.equal(resPartial.applied_modifiers.length, 2);
    assert.deepEqual(resPartial.applied_modifiers.map((m) => m.attribute_value_id).sort(), [301, 302]);
    assert.equal(resPartial.unit_price, 43000);

    // 3. Client sends exact [301, 302] -> resolves [301, 302]
    const resExact = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'san-pham-thu-nghiem',
      selectedModifierValueIds: [301, 302],
    });
    assert.equal(resExact.applied_modifiers.length, 2);
    assert.deepEqual(resExact.applied_modifiers.map((m) => m.attribute_value_id).sort(), [301, 302]);

    // 4. Client sends foreign [301, 303] -> throws 400 error (303 is not in locked preset)
    await assert.rejects(
      () => service.resolveConfiguration({
        storeId: 1,
        productSlug: 'san-pham-thu-nghiem',
        selectedModifierValueIds: [301, 303],
      }),
      (err) => err?.status === 400 && err?.message?.includes('đã bị khóa cố định'),
    );
  });

  await t.test('createProduct rejects root category assignment and requires valid subcategory', async () => {
    const schemaRepository = {
      async getCategoryById(id) {
        if (id === 1) return { id: 1, parent_id: null, depth: 0, archived_at: null }; // Root
        if (id === 10) return { id: 10, parent_id: 1, depth: 1, archived_at: null }; // Subcategory
        return null;
      },
    };
    const catalogRepository = {
      async createProduct(input) { return { id: 99, ...input }; },
    };
    const service = createAdminCatalogV2Service({ schemaRepository, catalogRepository });

    // Root category rejection
    await assert.rejects(
      () => service.createProduct({
        category_id: 1,
        name: 'Trà Sữa Thử',
        slug: 'tra-sua-thu',
        price: 30000,
      }),
      (err) => err?.status === 400 && err?.message?.includes('danh mục con'),
    );

    // Subcategory succeeds
    const prod = await service.createProduct({
      category_id: 10,
      name: 'Trà Sữa Thử',
      slug: 'tra-sua-thu',
      price: 30000,
    });
    assert.equal(prod.category_id, 10);
  });

  await t.test('fail-closed branch offer: product without offer in store is rejected in loadResolvedProduct', async () => {
    const catalogRepository = {
      async getProductBySlug(slug, { storeId }) {
        // Return null if no offer at branch
        if (storeId === 2) return null;
        return configurableProduct();
      },
    };
    const service = createPublicCatalogV2Service({ catalogRepository });

    const availableProd = await service.getProductBySlug('san-pham-thu-nghiem', { storeId: 1 });
    assert.ok(availableProd);

    const unavailableProd = await service.getProductBySlug('san-pham-thu-nghiem', { storeId: 2 });
    assert.equal(unavailableProd, null);
  });
});
