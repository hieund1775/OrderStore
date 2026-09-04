import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogOptionScopesRepository } from '../repositories/postgres/catalog-option-scopes.js';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';

function createSchemaAccurateDatabase(queryHandler) {
  const queries = [];
  const database = {
    async query(sql, params = []) {
      queries.push({ sql, params });

      if (/\bad\.is_system\b/.test(sql)) {
        throw new Error('column ad.is_system does not exist');
      }
      if (/FROM\s+attribute_definitions\b/i.test(sql) && /\bis_active\b/.test(sql)) {
        throw new Error('column attribute_definitions.is_active does not exist');
      }

      return await queryHandler(sql, params);
    },
    async transaction(callback) {
      return await callback(database);
    },
  };

  return { database, queries };
}

test('public product detail resolves option scopes without nonexistent attribute definition columns', async () => {
  const { database, queries } = createSchemaAccurateDatabase(async (sql) => {
    if (/FROM products p\s+LEFT JOIN categories c/i.test(sql)) {
      return [[{
        id: 101,
        category_id: 10,
        product_lane: 'kitchen',
        category_lane: 'kitchen',
      }]];
    }
    if (/WITH RECURSIVE cat_ancestors/i.test(sql)) {
      return [[{
        id: 10,
        parent_id: null,
        depth: 0,
        name: 'Nước uống',
        default_fulfillment_lane: 'kitchen',
      }]];
    }
    return [[]];
  });
  const service = createPublicCatalogV2Service({
    catalogRepository: {
      async getProductBySlug() {
        return {
          id: 101,
          name: 'Trái cây tô đậm sữa',
          slug: 'trai-cay-to-dam-sua',
          fulfillment_lane: 'kitchen',
          attributes: [],
          variants: [],
        };
      },
    },
    optionScopesRepository: createCatalogOptionScopesRepository(database),
  });

  const product = await service.getProductBySlug('trai-cay-to-dam-sua', { storeId: 1 });

  assert.equal(product.id, 101);
  assert.equal(product.fulfillment_lane, 'kitchen');
  assert.ok(queries.some(({ sql }) => /category_attribute_assignments/.test(sql)));
  assert.ok(queries.some(({ sql }) => /product_attribute_overrides/.test(sql)));
});

test('admin product preset validates an attribute definition without is_active', async () => {
  const { database, queries } = createSchemaAccurateDatabase(async (sql) => {
    if (/FROM products WHERE id = \$1 AND status <> 'archived'/i.test(sql)) {
      return [[{ id: 101, category_id: 10, status: 'active' }]];
    }
    if (/SELECT 1 FROM products p/i.test(sql)) {
      return [[{ exists: 1 }]];
    }
    if (/FROM attribute_definitions WHERE id = \$1/i.test(sql)) {
      return [[{ id: 21, input_type: 'single_select' }]];
    }
    if (/INSERT INTO catalog_option_presets/i.test(sql)) {
      return [[{ id: 55, target_type: 'product', target_id: 101, attribute_definition_id: 21 }]];
    }
    if (/DELETE FROM catalog_option_preset_values/i.test(sql)) {
      return [[]];
    }
    throw new Error(`Unexpected query in preset regression test: ${sql}`);
  });
  const repository = createCatalogOptionScopesRepository(database);

  const preset = await repository.upsertPreset({
    targetType: 'product',
    targetId: 101,
    attributeDefinitionId: 21,
    valueIds: [],
    isLocked: true,
    userId: 7,
  });

  assert.equal(preset.id, 55);
  const definitionQuery = queries.find(({ sql }) => /FROM attribute_definitions WHERE id = \$1/i.test(sql));
  assert.ok(definitionQuery);
  assert.doesNotMatch(definitionQuery.sql, /\bis_active\b/);
});
