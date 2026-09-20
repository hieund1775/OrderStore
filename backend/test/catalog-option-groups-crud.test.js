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
