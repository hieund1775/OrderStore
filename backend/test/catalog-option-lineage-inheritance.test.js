import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogOptionScopesRepository } from '../repositories/postgres/catalog-option-scopes.js';

describe('Catalog Option Lineage Inheritance & Override Suite', () => {
  it('listCategoryAssignments inherits option assignment from parent category when child has no direct row', async () => {
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('WITH RECURSIVE cat_ancestors')) {
          // Category 2 ("Cà phê QA") has parent 1 ("Đồ uống QA")
          return [[
            { id: 1, parent_id: null, depth: 0, name: 'Đồ uống QA' },
            { id: 2, parent_id: 1, depth: 1, name: 'Cà phê QA' },
          ]];
        }
        if (sql.includes('FROM category_attribute_assignments caa')) {
          // Category 1 has "Mức Đá" (attr 10) enabled with inherit_to_descendants = true
          return [[
            {
              id: 101,
              category_id: 1,
              attribute_definition_id: 10,
              is_enabled: true,
              inherit_to_descendants: true,
              sort_order: 1,
              attribute_name: 'Mức Đá',
              attribute_code: 'muc_da',
              attribute_role: 'modifier',
              input_type: 'single_select',
              category_name: 'Đồ uống QA',
              category_depth: 0,
            },
          ]];
        }
        return [[]];
      },
    };

    const repo = createCatalogOptionScopesRepository(mockDb);
    const results = await repo.listCategoryAssignments(2);

    assert.equal(results.length, 1);
    const item = results[0];
    assert.equal(item.attribute_definition_id, 10);
    assert.equal(item.is_enabled, true);
    assert.equal(item.is_inherited, true);
    assert.equal(item.is_overridden, false);
    assert.equal(item.inherited_from_category_name, 'Đồ uống QA');
    assert.equal(item.target_category_id, 2);
  });

  it('listCategoryAssignments marks direct child row as overridden when child overrides parent setting', async () => {
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('WITH RECURSIVE cat_ancestors')) {
          return [[
            { id: 1, parent_id: null, depth: 0, name: 'Đồ uống QA' },
            { id: 2, parent_id: 1, depth: 1, name: 'Cà phê QA' },
          ]];
        }
        if (sql.includes('FROM category_attribute_assignments caa')) {
          // Both root (1) and child (2) have assignments for attr 10
          return [[
            {
              id: 101,
              category_id: 1,
              attribute_definition_id: 10,
              is_enabled: true,
              inherit_to_descendants: true,
              sort_order: 1,
              attribute_name: 'Mức Đá',
              attribute_code: 'muc_da',
              attribute_role: 'modifier',
              input_type: 'single_select',
              category_name: 'Đồ uống QA',
              category_depth: 0,
            },
            {
              id: 102,
              category_id: 2,
              attribute_definition_id: 10,
              is_enabled: false,
              inherit_to_descendants: true,
              sort_order: 1,
              attribute_name: 'Mức Đá',
              attribute_code: 'muc_da',
              attribute_role: 'modifier',
              input_type: 'single_select',
              category_name: 'Cà phê QA',
              category_depth: 1,
            },
          ]];
        }
        return [[]];
      },
    };

    const repo = createCatalogOptionScopesRepository(mockDb);
    const results = await repo.listCategoryAssignments(2);

    assert.equal(results.length, 1);
    const item = results[0];
    assert.equal(item.attribute_definition_id, 10);
    assert.equal(item.is_enabled, false);
    assert.equal(item.is_inherited, false);
    assert.equal(item.is_overridden, true);
    assert.equal(item.inherited_from_category_name, 'Đồ uống QA');
    assert.equal(item.target_category_id, 2);
  });
});
