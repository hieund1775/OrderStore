import postgresDb from '../../config/db-postgres.js';

export function createCatalogOptionScopesRepository(database = postgresDb) {
  return {
    async getCategoryAssignmentContext(categoryId, attributeDefinitionId) {
      const [rows] = await database.query(
        `SELECT c.id AS category_id, c.product_type_id AS category_product_type_id,
                ad.id AS attribute_definition_id, pts.product_type_id AS attribute_product_type_id
         FROM categories c
         CROSS JOIN attribute_definitions ad
         JOIN product_type_schemas pts ON pts.id = ad.schema_id
         WHERE c.id = $1 AND ad.id = $2 AND c.archived_at IS NULL`,
        [Number(categoryId), Number(attributeDefinitionId)],
      );
      return rows[0] || null;
    },

    async getProductOverrideContext(productId, attributeDefinitionId) {
      const [rows] = await database.query(
        `SELECT p.id AS product_id, p.product_type_schema_id,
                ad.id AS attribute_definition_id, ad.schema_id AS attribute_schema_id
         FROM products p
         CROSS JOIN attribute_definitions ad
         WHERE p.id = $1 AND ad.id = $2 AND p.status <> 'archived'`,
        [Number(productId), Number(attributeDefinitionId)],
      );
      return rows[0] || null;
    },

    async listCategoryAssignments(categoryId) {
      const [rows] = await database.query(
        `SELECT caa.*, ad.name AS attribute_name, ad.code AS attribute_code,
                ad.role AS attribute_role, ad.input_type
         FROM category_attribute_assignments caa
         JOIN attribute_definitions ad ON ad.id = caa.attribute_definition_id
         WHERE caa.category_id = $1
         ORDER BY caa.sort_order ASC, ad.name ASC`,
        [Number(categoryId)],
      );
      return rows;
    },

    async upsertCategoryAssignment({
      categoryId,
      attributeDefinitionId,
      isEnabled = true,
      inheritToDescendants = true,
      sortOrder = 0,
      isRequired = null,
      minSelected = null,
      maxSelected = null,
    }) {
      const [rows] = await database.query(
        `INSERT INTO category_attribute_assignments
           (category_id, attribute_definition_id, is_enabled, inherit_to_descendants, sort_order, is_required, min_selected, max_selected, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (category_id, attribute_definition_id)
         DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           inherit_to_descendants = EXCLUDED.inherit_to_descendants,
           sort_order = EXCLUDED.sort_order,
           is_required = EXCLUDED.is_required,
           min_selected = EXCLUDED.min_selected,
           max_selected = EXCLUDED.max_selected,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          Number(categoryId),
          Number(attributeDefinitionId),
          Boolean(isEnabled),
          Boolean(inheritToDescendants),
          Number(sortOrder) || 0,
          isRequired !== null ? Boolean(isRequired) : null,
          minSelected !== null ? Number(minSelected) : null,
          maxSelected !== null ? Number(maxSelected) : null,
        ],
      );
      return rows[0];
    },

    async deleteCategoryAssignment(categoryId, attributeDefinitionId) {
      const [rows] = await database.query(
        `DELETE FROM category_attribute_assignments
         WHERE category_id = $1 AND attribute_definition_id = $2
         RETURNING id`,
        [Number(categoryId), Number(attributeDefinitionId)],
      );
      return rows.length > 0;
    },

    async listProductOverrides(productId) {
      const [rows] = await database.query(
        `SELECT pao.*, ad.name AS attribute_name, ad.code AS attribute_code,
                ad.role AS attribute_role, ad.input_type
         FROM product_attribute_overrides pao
         JOIN attribute_definitions ad ON ad.id = pao.attribute_definition_id
         WHERE pao.product_id = $1
         ORDER BY COALESCE(pao.sort_order, 0) ASC, ad.name ASC`,
        [Number(productId)],
      );
      return rows;
    },

    async upsertProductOverride({
      productId,
      attributeDefinitionId,
      isEnabled = true,
      sortOrder = null,
      isRequired = null,
      minSelected = null,
      maxSelected = null,
    }) {
      const [rows] = await database.query(
        `INSERT INTO product_attribute_overrides
           (product_id, attribute_definition_id, is_enabled, sort_order, is_required, min_selected, max_selected, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (product_id, attribute_definition_id)
         DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           sort_order = EXCLUDED.sort_order,
           is_required = EXCLUDED.is_required,
           min_selected = EXCLUDED.min_selected,
           max_selected = EXCLUDED.max_selected,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          Number(productId),
          Number(attributeDefinitionId),
          Boolean(isEnabled),
          sortOrder !== null ? Number(sortOrder) : null,
          isRequired !== null ? Boolean(isRequired) : null,
          minSelected !== null ? Number(minSelected) : null,
          maxSelected !== null ? Number(maxSelected) : null,
        ],
      );
      return rows[0];
    },

    async deleteProductOverride(productId, attributeDefinitionId) {
      const [rows] = await database.query(
        `DELETE FROM product_attribute_overrides
         WHERE product_id = $1 AND attribute_definition_id = $2
         RETURNING id`,
        [Number(productId), Number(attributeDefinitionId)],
      );
      return rows.length > 0;
    },

    async getOptionScopesForProduct(productId) {
      // 1. Get product category & lineage
      const [prodRows] = await database.query(
        `SELECT p.id, p.category_id, p.fulfillment_lane AS product_lane,
                c.default_fulfillment_lane AS category_lane
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = $1`,
        [Number(productId)],
      );
      if (!prodRows[0]) return null;

      const categoryId = prodRows[0].category_id;

      // 2. Fetch category lineage from root to leaf
      let lineage = [];
      if (categoryId) {
        const [ancestors] = await database.query(
          `WITH RECURSIVE cat_ancestors AS (
             SELECT id, parent_id, depth, name, default_fulfillment_lane
             FROM categories WHERE id = $1
             UNION ALL
             SELECT c.id, c.parent_id, c.depth, c.name, c.default_fulfillment_lane
             FROM categories c
             JOIN cat_ancestors ca ON ca.parent_id = c.id
           )
           SELECT * FROM cat_ancestors ORDER BY depth ASC`,
          [categoryId],
        );
        lineage = ancestors;
      }

      const ancestorIds = lineage.map((a) => a.id);

      // 3. Fetch all category assignments along lineage
      let categoryAssignments = [];
      if (ancestorIds.length > 0) {
        const [assignRows] = await database.query(
          `SELECT caa.*, ad.code AS attribute_code, ad.name AS attribute_name,
                  ad.role AS attribute_role, ad.input_type,
                  c.name AS category_name, c.depth AS category_depth
           FROM category_attribute_assignments caa
           JOIN categories c ON c.id = caa.category_id
           JOIN attribute_definitions ad ON ad.id = caa.attribute_definition_id
           WHERE caa.category_id = ANY($1::bigint[])
             AND (caa.category_id = $2 OR caa.inherit_to_descendants = TRUE)
           ORDER BY c.depth ASC, caa.sort_order ASC`,
          [ancestorIds, categoryId],
        );
        categoryAssignments = assignRows;
      }

      // 4. Fetch product overrides
      const [overrides] = await database.query(
        `SELECT pao.*, ad.code AS attribute_code, ad.name AS attribute_name,
                ad.role AS attribute_role, ad.input_type
         FROM product_attribute_overrides pao
         JOIN attribute_definitions ad ON ad.id = pao.attribute_definition_id
         WHERE pao.product_id = $1`,
        [Number(productId)],
      );

      // 5. Fetch presets for product and its lineage
      let categoryPresets = [];
      if (ancestorIds.length > 0) {
        const [catPresetRows] = await database.query(
          `SELECT cop.*,
                  COALESCE(JSONB_AGG(copv.attribute_value_id) FILTER (WHERE copv.attribute_value_id IS NOT NULL), '[]'::jsonb) AS attribute_value_ids
           FROM catalog_option_presets cop
           LEFT JOIN catalog_option_preset_values copv ON copv.preset_id = cop.id
           WHERE cop.target_type = 'category' AND cop.target_id = ANY($1::bigint[])
           GROUP BY cop.id`,
          [ancestorIds],
        );
        categoryPresets = catPresetRows;
      }

      const [prodPresetRows] = await database.query(
        `SELECT cop.*,
                COALESCE(JSONB_AGG(copv.attribute_value_id) FILTER (WHERE copv.attribute_value_id IS NOT NULL), '[]'::jsonb) AS attribute_value_ids
         FROM catalog_option_presets cop
         LEFT JOIN catalog_option_preset_values copv ON copv.preset_id = cop.id
         WHERE cop.target_type = 'product' AND cop.target_id = $1
         GROUP BY cop.id`,
        [Number(productId)],
      );

      return {
        product: prodRows[0],
        lineage,
        categoryAssignments,
        productOverrides: overrides,
        categoryPresets,
        productPresets: prodPresetRows,
      };
    },

    async listPresets({ targetType, targetId }) {
      const [rows] = await database.query(
        `SELECT cop.*, ad.name AS attribute_name, ad.code AS attribute_code,
                COALESCE(JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'id', av.id,
                    'code', av.code,
                    'label', av.label,
                    'price_adjustment', av.price_adjustment
                  )
                ) FILTER (WHERE av.id IS NOT NULL), '[]'::jsonb) AS values,
                COALESCE(JSONB_AGG(copv.attribute_value_id) FILTER (WHERE copv.attribute_value_id IS NOT NULL), '[]'::jsonb) AS attribute_value_ids
         FROM catalog_option_presets cop
         JOIN attribute_definitions ad ON ad.id = cop.attribute_definition_id
         LEFT JOIN catalog_option_preset_values copv ON copv.preset_id = cop.id
         LEFT JOIN attribute_values av ON av.id = copv.attribute_value_id
         WHERE cop.target_type = $1 AND cop.target_id = $2
         GROUP BY cop.id, ad.id
         ORDER BY ad.sort_order ASC, ad.name ASC`,
        [targetType, Number(targetId)],
      );
      return rows;
    },

    async upsertPreset({ targetType, targetId, attributeDefinitionId, valueIds = [], isLocked = false, userId = null }) {
      return await database.transaction(async (tx) => {
        // 1. Verify target existence & depth
        if (targetType === 'category') {
          const [catRows] = await tx.query(
            `SELECT id, parent_id, depth FROM categories WHERE id = $1 AND archived_at IS NULL`,
            [Number(targetId)],
          );
          if (!catRows[0]) {
            throw new CatalogOptionScopeError('Danh mục không tồn tại hoặc đã bị lưu trữ', 404);
          }
          if (catRows[0].parent_id == null || Number(catRows[0].depth) !== 1) {
            throw new CatalogOptionScopeError('Preset chỉ được gán vào danh mục con trực tiếp (depth 1)', 400);
          }

          // Verify attribute is assigned directly or inherited on this category
          const [assignRows] = await tx.query(
            `SELECT 1 FROM category_attribute_assignments caa
             WHERE (caa.category_id = $1 OR (caa.category_id = $2 AND caa.inherit_to_descendants = TRUE))
               AND caa.attribute_definition_id = $3
               AND caa.is_enabled = TRUE`,
            [Number(targetId), catRows[0].parent_id, Number(attributeDefinitionId)],
          );
          if (!assignRows[0]) {
            throw new CatalogOptionScopeError('Tùy chọn chưa được bật áp dụng trên danh mục này', 400);
          }
        } else if (targetType === 'product') {
          const [prodRows] = await tx.query(
            `SELECT id, category_id, status FROM products WHERE id = $1 AND status <> 'archived'`,
            [Number(targetId)],
          );
          if (!prodRows[0]) {
            throw new CatalogOptionScopeError('Sản phẩm không tồn tại hoặc đã bị lưu trữ', 404);
          }

          // Verify attribute is assigned on product category lineage or overridden on product
          const [assignRows] = await tx.query(
            `SELECT 1 FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN category_attribute_assignments caa ON (caa.category_id = c.id OR (caa.category_id = c.parent_id AND caa.inherit_to_descendants = TRUE))
             LEFT JOIN product_attribute_overrides pao ON pao.product_id = p.id AND pao.attribute_definition_id = $2
             WHERE p.id = $1
               AND (
                 (caa.attribute_definition_id = $2 AND caa.is_enabled = TRUE)
                 OR (pao.attribute_definition_id = $2 AND pao.is_enabled = TRUE)
               )`,
            [Number(targetId), Number(attributeDefinitionId)],
          );
          if (!assignRows[0]) {
            throw new CatalogOptionScopeError('Tùy chọn chưa được gán hoặc bật áp dụng cho sản phẩm này', 400);
          }
        }

        // 2. Verify attribute definition
        const [attrRows] = await tx.query(
          `SELECT id, input_type FROM attribute_definitions WHERE id = $1`,
          [Number(attributeDefinitionId)],
        );
        if (!attrRows[0]) {
          throw new CatalogOptionScopeError('Tùy chọn không tồn tại', 404);
        }

        // 3. Verify values match attribute definition and are active
        if (Array.isArray(valueIds) && valueIds.length > 0) {
          if (attrRows[0].input_type === 'single_select' && valueIds.length > 1) {
            throw new CatalogOptionScopeError('Tùy chọn đơn chỉ được có tối đa 1 giá trị mặc định', 400);
          }

          const [valRows] = await tx.query(
            `SELECT id FROM attribute_values
             WHERE id = ANY($1::bigint[])
               AND attribute_definition_id = $2
               AND is_active = TRUE`,
            [valueIds.map(Number), Number(attributeDefinitionId)],
          );
          if (valRows.length !== valueIds.length) {
            throw new CatalogOptionScopeError('Một hoặc nhiều giá trị tùy chọn không hợp lệ hoặc đã tạm ngừng', 400);
          }
        }

        const [pRows] = await tx.query(
          `INSERT INTO catalog_option_presets
             (target_type, target_id, attribute_definition_id, is_locked, created_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (target_type, target_id, attribute_definition_id)
           DO UPDATE SET
             is_locked = EXCLUDED.is_locked,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [targetType, Number(targetId), Number(attributeDefinitionId), Boolean(isLocked), userId],
        );
        const preset = pRows[0];

        await tx.query('DELETE FROM catalog_option_preset_values WHERE preset_id = $1', [preset.id]);

        if (Array.isArray(valueIds) && valueIds.length > 0) {
          for (const valId of valueIds) {
            await tx.query(
              `INSERT INTO catalog_option_preset_values (preset_id, attribute_value_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [preset.id, Number(valId)],
            );
          }
        }

        return preset;
      });
    },

    async deletePreset({ targetType, targetId, attributeDefinitionId }) {
      const [rows] = await database.query(
        `DELETE FROM catalog_option_presets
         WHERE target_type = $1 AND target_id = $2 AND attribute_definition_id = $3
         RETURNING id`,
        [targetType, Number(targetId), Number(attributeDefinitionId)],
      );
      return rows.length > 0;
    },
  };
}
