import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogV2Repository } from '../repositories/postgres/catalog-v2.js';
import { createAdminCatalogV2Service } from '../services/catalog/admin-catalog-v2-service.js';

test('createCatalogV2Repository.updateCategoryOptionGroup updates name and synchronizes values in transaction', async () => {
  const executedStatements = [];
  const database = {
    async transaction(callback) {
      return await callback({
        async query(statement, params) {
          executedStatements.push({ statement, params });
          if (statement.includes('SELECT ad.*')) {
            return [[{ id: 42, name: 'Độ ngọt cũ', role: 'modifier', schema_id: 1 }]];
          }
          if (statement.includes('SELECT id') && statement.includes('LOWER(TRIM(name))')) {
            return [[]];
          }
          if (statement.includes('UPDATE attribute_definitions')) {
            return [[{ id: 42, name: params[0], role: 'modifier' }]];
          }
          if (statement.includes('SELECT * FROM attribute_values')) {
            return [[
              { id: 101, attribute_definition_id: 42, code: 'sugar_100', label: '100% đường', price_adjustment: 0 },
              { id: 102, attribute_definition_id: 42, code: 'sugar_old', label: 'Cũ cần xóa', price_adjustment: 0 },
            ]];
          }
          if (statement.includes('DELETE FROM product_modifier_values')) {
            return [[{ count: 1 }]];
          }
          if (statement.includes('DELETE FROM attribute_values')) {
            return [[{ count: 1 }]];
          }
          if (statement.includes('UPDATE attribute_values')) {
            return [[{ id: params[4], label: params[0], price_adjustment: params[1] }]];
          }
          if (statement.includes('INSERT INTO attribute_values')) {
            return [[{ id: 103, code: params[1], label: params[2], price_adjustment: params[5] }]];
          }
          throw new Error(`Unexpected SQL: ${statement}`);
        },
      });
    },
  };

  const repo = createCatalogV2Repository(database);
  const result = await repo.updateCategoryOptionGroup(5, 42, { name: 'Mức Ngọt Mới' }, [
    { id: 101, label: '100% đường cập nhật', price_adjustment: 0 },
    { label: '50% đường mới', price_adjustment: 0 },
  ]);

  assert.equal(result.attribute.name, 'Mức Ngọt Mới');
  assert.equal(result.values.length, 2);

  // Check that old value 102 was deleted
  const deleteCalls = executedStatements.filter((c) => c.statement.includes('DELETE FROM attribute_values'));
  assert.equal(deleteCalls.length, 1);
  assert.deepEqual(deleteCalls[0].params[0], [102]);
});

test('createCatalogV2Repository.deleteCategoryOptionGroup safely deletes modifier group and cascade references', async () => {
  const executedStatements = [];
  const database = {
    async transaction(callback) {
      return await callback({
        async query(statement, params) {
          executedStatements.push({ statement, params });
          if (statement.includes('SELECT id, name, role FROM attribute_definitions')) {
            return [[{ id: 42, name: 'Nhóm đá', role: 'modifier' }]];
          }
          if (statement.includes('DELETE FROM product_modifier_values')) {
            return [[{ count: 0 }]];
          }
          if (statement.includes('DELETE FROM attribute_definitions')) {
            return [[{ count: 1 }]];
          }
          throw new Error(`Unexpected SQL: ${statement}`);
        },
      });
    },
  };

  const repo = createCatalogV2Repository(database);
  const result = await repo.deleteCategoryOptionGroup(5, 42);

  assert.equal(result.success, true);
  assert.equal(result.id, 42);
  assert.equal(result.name, 'Nhóm đá');
  assert.equal(executedStatements.filter((c) => c.statement.includes('DELETE FROM attribute_definitions')).length, 1);
});

test('createAdminCatalogV2Service rejects deleting non-modifier or invalid ids', async () => {
  const service = createAdminCatalogV2Service({
    schemaRepository: {
      async deleteCategoryOptionGroup() {
        return { success: true };
      },
    },
  });

  await assert.rejects(
    () => service.deleteCategoryOptionGroup(5, 0),
    /Mã nhóm tùy chọn không hợp lệ/,
  );

  await assert.rejects(
    () => service.deleteCategoryOptionGroup(5, 'invalid'),
    /Mã nhóm tùy chọn không hợp lệ/,
  );
});
test('createAdminCatalogV2Service rejects creating group with duplicate choice labels', async () => {
  const service = createAdminCatalogV2Service();
  await assert.rejects(
    () => service.createCategoryOptionGroup(10, {
      schema_id: 1,
      code: 'color',
      name: 'Màu sắc',
      role: 'modifier',
      input_type: 'single_select',
      values: [
        { code: 'den_1', label: 'Đen' },
        { code: 'den_2', label: 'đen' },
      ],
    }),
    /Các lựa chọn trong cùng một nhóm không được trùng tên: "đen"/,
  );
});

test('createAdminCatalogV2Service rejects updating group with duplicate choice labels', async () => {
  const service = createAdminCatalogV2Service();
  await assert.rejects(
    () => service.updateCategoryOptionGroup(10, 42, {
      values: [
        { label: 'Size L' },
        { label: 'size l' },
      ],
    }),
    /Các lựa chọn trong cùng một nhóm không được trùng tên: "size l"/,
  );
});

test('createAdminCatalogV2Service rejects empty group name', async () => {
  const service = createAdminCatalogV2Service();
  await assert.rejects(
    () => service.createCategoryOptionGroup(10, {
      schema_id: 1,
      code: 'size',
      name: '   ',
      role: 'modifier',
      input_type: 'single_select',
      values: [{ code: 's', label: 'S' }],
    }),
    /Vui lòng nhập tên nhóm tùy chọn./,
  );

  await assert.rejects(
    () => service.updateCategoryOptionGroup(10, 42, {
      name: '',
    }),
    /Vui lòng nhập tên nhóm tùy chọn./,
  );
});

test('createCatalogV2Repository rejects creating group with duplicate group name in schema', async () => {
  const database = {
    async transaction(callback) {
      return await callback({
        async query(statement) {
          if (statement.includes('SELECT c.id AS category_id')) {
            return [[{ category_id: 10, category_product_type_id: 1, schema_id: 1, schema_product_type_id: 1, schema_status: 'active' }]];
          }
          if (statement.includes('SELECT id, name FROM attribute_definitions')) {
            return [[{ id: 99, name: 'Màu sắc' }]];
          }
          throw new Error(`Unexpected SQL: ${statement}`);
        },
      });
    },
  };
  const repo = createCatalogV2Repository(database);
  await assert.rejects(
    () => repo.createCategoryOptionGroup(10, 1, { code: 'color_2', name: 'Màu sắc' }, [{ code: 'red', label: 'Đỏ' }]),
    /Tên nhóm tùy chọn "Màu sắc" đã tồn tại trong danh mục/,
  );
});

test('createCatalogV2Repository rejects updating group with duplicate group name in schema', async () => {
  const database = {
    async transaction(callback) {
      return await callback({
        async query(statement) {
          if (statement.includes('SELECT ad.*')) {
            return [[{ id: 42, name: 'Màu', role: 'modifier', schema_id: 1 }]];
          }
          if (statement.includes('SELECT id FROM attribute_definitions') && statement.includes('LOWER(TRIM(name))')) {
            return [[{ id: 43 }]];
          }
          throw new Error(`Unexpected SQL: ${statement}`);
        },
      });
    },
  };
  const repo = createCatalogV2Repository(database);
  await assert.rejects(
    () => repo.updateCategoryOptionGroup(10, 42, { name: 'Màu sắc khác' }),
    /Tên nhóm tùy chọn "Màu sắc khác" đã tồn tại trong danh mục/,
  );
});
