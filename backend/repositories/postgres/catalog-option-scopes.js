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
                ad.role AS attribute_role, ad.input_type, ad.is_system
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
                  ad.role AS attribute_role, ad.input_type, ad.is_system,
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
                ad.role AS attribute_role, ad.input_type, ad.is_system
         FROM product_attribute_overrides pao
         JOIN attribute_definitions ad ON ad.id = pao.attribute_definition_id
         WHERE pao.product_id = $1`,
        [Number(productId)],
      );

      return {
        product: prodRows[0],
        lineage,
        categoryAssignments,
        productOverrides: overrides,
      };
    },
  };
}
