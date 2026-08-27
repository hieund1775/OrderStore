import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCategoryInput,
  validateProductTypeInput,
  validateAttributeDefinitionInput,
  validateAttributeValueInput,
  generateCanonicalVariantSignature,
} from '../validation/catalog-v2-schemas.js';
import { createProductTypeSchemaService } from '../services/catalog/product-type-schema-service.js';

test('Catalog V2 Validation: categories strictly enforces tree constraints and slugs', () => {
  // Valid category
  const valid = validateCategoryInput({
    name: 'Áo Thun Nam',
    slug: 'ao-thun-nam',
    parent_id: 10,
    sort_order: 1,
    is_visible: true,
  });
  assert.equal(valid.name, 'Áo Thun Nam');
  assert.equal(valid.slug, 'ao-thun-nam');
  assert.equal(valid.parent_id, 10);

  // Rejects invalid slug
  assert.throws(
    () => validateCategoryInput({ name: 'Áo Thun', slug: 'Ao Thun Nam!' }),
    /kebab-case/,
  );

  // Rejects short name
  assert.throws(
    () => validateCategoryInput({ name: 'A', slug: 'ao' }),
    /between 2 and 150 characters/,
  );
});

test('Catalog V2 Validation: product types enforces stock mode and fulfillment lane defaults', () => {
  const fashion = validateProductTypeInput({
    code: 'fashion_apparel',
    name: 'Thời Trang & Quần Áo',
    default_stock_mode: 'tracked',
    default_fulfillment_lane: 'packing',
  });

  assert.equal(fashion.code, 'fashion_apparel');
  assert.equal(fashion.default_stock_mode, 'tracked');
  assert.equal(fashion.default_fulfillment_lane, 'packing');

  // Rejects invalid stock mode
  assert.throws(
    () => validateProductTypeInput({ code: 'test', name: 'Test', default_stock_mode: 'unlimited' }),
    /default_stock_mode must be "tracked" or "made_to_order"/,
  );
});

test('Catalog V2 Validation: attribute definitions enforces role-specific rules', () => {
  // Variant attribute must be single_select
  const variantAttr = validateAttributeDefinitionInput({
    code: 'size',
    name: 'Kích cỡ',
    role: 'variant',
    input_type: 'single_select',
    is_required: true,
  });
  assert.equal(variantAttr.role, 'variant');
  assert.equal(variantAttr.input_type, 'single_select');

  // Variant attribute with multi_select must be rejected
  assert.throws(
    () =>
      validateAttributeDefinitionInput({
        code: 'size',
        name: 'Kích cỡ',
        role: 'variant',
        input_type: 'multi_select',
      }),
    /Variant attributes must have input_type = "single_select"/,
  );

  // Modifier attribute can be multi_select
  const modifierAttr = validateAttributeDefinitionInput({
    code: 'topping',
    name: 'Topping đi kèm',
    role: 'modifier',
    input_type: 'multi_select',
    min_selections: 0,
    max_selections: 5,
  });
  assert.equal(modifierAttr.role, 'modifier');
  assert.equal(modifierAttr.input_type, 'multi_select');
  assert.equal(modifierAttr.max_selections, 5);
});

test('Catalog V2: canonical variant signature is deterministic and sorted by attribute id', () => {
  assert.equal(generateCanonicalVariantSignature([]), 'default');

  const valuesUnsorted = [
    { attribute_definition_id: 5, attribute_value_id: 20 }, // e.g. Color = Red
    { attribute_definition_id: 2, attribute_value_id: 8 },  // e.g. Size = L
  ];

  const sig = generateCanonicalVariantSignature(valuesUnsorted);
  assert.equal(sig, '2:8__5:20');
});

test('Catalog V2 Service: delegates schema management to repository with validation', async () => {
  const fakeRepo = {
    async createProductType(data, context) {
      return { id: 1, ...data, context };
    },
    async publishSchema(id) {
      return { id, status: 'published' };
    },
  };

  const service = createProductTypeSchemaService(fakeRepo);
  const result = await service.createProductType(
    {
      code: 'beverage',
      name: 'Nước Uống & Trà',
      default_stock_mode: 'made_to_order',
      default_fulfillment_lane: 'kitchen',
    },
    { createdBy: 1 },
  );

  assert.equal(result.id, 1);
  assert.equal(result.code, 'beverage');

  const pubResult = await service.publishSchema(10);
  assert.equal(pubResult.status, 'published');
});
