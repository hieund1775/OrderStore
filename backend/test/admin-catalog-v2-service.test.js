import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCatalogV2Service } from '../services/catalog/admin-catalog-v2-service.js';

test('Admin Catalog V2 Service: previewVariantCombinations generates correct Cartesian combinations', () => {
  const service = createAdminCatalogV2Service();

  // Test case 1: No variant attributes -> Default SKU
  const defaultPreviews = service.previewVariantCombinations([], 'tra-dao');
  assert.equal(defaultPreviews.length, 1);
  assert.equal(defaultPreviews[0].sku, 'TRA-DAO-DEF');
  assert.equal(defaultPreviews[0].variant_signature, 'default');

  // Test case 2: Size (M, L) x Color (Red, Blue) = 4 combinations
  const schemaAttrs = [
    {
      id: 1,
      code: 'size',
      name: 'Kích cỡ',
      role: 'variant',
      values: [
        { id: 10, code: 'm', label: 'Size M' },
        { id: 11, code: 'l', label: 'Size L' },
      ],
    },
    {
      id: 2,
      code: 'color',
      name: 'Màu sắc',
      role: 'variant',
      values: [
        { id: 20, code: 'red', label: 'Đỏ' },
        { id: 21, code: 'blue', label: 'Xanh' },
      ],
    },
    {
      id: 3,
      code: 'topping',
      name: 'Topping',
      role: 'modifier', // Should be ignored in variant Cartesian product
      values: [{ id: 30, code: 'pearl', label: 'Trân châu' }],
    },
  ];

  const combinations = service.previewVariantCombinations(schemaAttrs, 'ao-thun');
  assert.equal(combinations.length, 4);

  const skus = combinations.map((c) => c.sku);
  assert.ok(skus.includes('AO-THUN-M-RED'));
  assert.ok(skus.includes('AO-THUN-M-BLUE'));
  assert.ok(skus.includes('AO-THUN-L-RED'));
  assert.ok(skus.includes('AO-THUN-L-BLUE'));

  const signatures = combinations.map((c) => c.variant_signature);
  assert.ok(signatures.includes('1:10__2:20'));
  assert.ok(signatures.includes('1:10__2:21'));
  assert.ok(signatures.includes('1:11__2:20'));
  assert.ok(signatures.includes('1:11__2:21'));
});

test('Admin Catalog V2 Service: createProduct validates input constraints', async () => {
  const service = createAdminCatalogV2Service({
    catalogRepository: {
      async createProduct(data) {
        return { id: 99, ...data };
      },
    },
  });

  // Rejects invalid slug
  await assert.rejects(
    () => service.createProduct({ name: 'Áo Thun', slug: 'ao thun nam', category_id: 1 }),
    /kebab-case/,
  );

  // Rejects missing category
  await assert.rejects(
    () => service.createProduct({ name: 'Áo Thun', slug: 'ao-thun', category_id: 0 }),
    /chọn danh mục hợp lệ/,
  );

  // Valid creation returns DTO
  const created = await service.createProduct({
    name: 'Áo Thun Cotton',
    slug: 'ao-thun-cotton',
    category_id: 5,
    price: 150000,
    fulfillment_lane: 'packing',
    stock_mode: 'tracked',
  });

  assert.equal(created.id, 99);
  assert.equal(created.name, 'Áo Thun Cotton');
  assert.equal(created.fulfillment_lane, 'packing');
  assert.equal(created.stock_mode, 'tracked');
});

test('Admin Catalog V2 Service: creates the next schema version and rejects invalid product type ids', async () => {
  const calls = [];
  const service = createAdminCatalogV2Service({
    schemaRepository: {
      async createNextSchemaVersion(productTypeId, context) {
        calls.push({ productTypeId, context });
        return { id: 12, product_type_id: productTypeId, version: 2, status: 'draft' };
      },
    },
  });

  const created = await service.createNextSchemaVersion('7', { createdBy: 42 });
  assert.deepEqual(calls, [{ productTypeId: 7, context: { createdBy: 42 } }]);
  assert.equal(created.status, 'draft');
  assert.equal(created.version, 2);

  await assert.rejects(
    () => service.createNextSchemaVersion('invalid'),
    (error) => error.status === 400,
  );
});
