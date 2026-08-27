import postgresDb from '../../config/db-postgres.js';

export class CatalogV2Error extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createCatalogV2Repository(database = postgresDb) {
  return {
    // -------------------------------------------------------------
    // CATEGORIES TREE
    // -------------------------------------------------------------
    async listCategories({ includeArchived = false } = {}) {
      const where = includeArchived ? '' : 'WHERE c.archived_at IS NULL';
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.product_type_id,
                c.sort_order, c.is_visible, c.archived_at, c.created_at,
                pt.name AS product_type_name, pt.code AS product_type_code,
                (SELECT COUNT(*)::int FROM categories sub WHERE sub.parent_id = c.id AND sub.archived_at IS NULL) AS children_count,
                (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status <> 'archived') AS products_count
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         ${where}
         ORDER BY c.depth ASC, c.sort_order ASC, c.name ASC`,
      );
      return rows;
    },

    async getCategoryById(id) {
      const [rows] = await database.query(
        `SELECT c.*, pt.name AS product_type_name, pt.code AS product_type_code
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         WHERE c.id = $1`,
        [id],
      );
      return rows[0] || null;
    },

    async createCategory(data) {
      let depth = 0;
      if (data.parent_id) {
        const parent = await this.getCategoryById(data.parent_id);
        if (!parent) {
          throw new CatalogV2Error('Danh mục cha không tồn tại', 404);
        }
        if (parent.depth >= 2) {
          throw new CatalogV2Error('Cây danh mục tối đa 3 cấp (depth 0, 1, 2)', 400);
        }
        depth = parent.depth + 1;
      }

      const [rows] = await database.query(
        `INSERT INTO categories (name, slug, parent_id, depth, product_type_id, sort_order, is_visible)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.name,
          data.slug,
          data.parent_id || null,
          depth,
          data.product_type_id || null,
          data.sort_order || 0,
          data.is_visible ?? true,
        ],
      );
      return rows[0];
    },

    async updateCategory(id, data) {
      const current = await this.getCategoryById(id);
      if (!current) {
        throw new CatalogV2Error('Danh mục không tồn tại', 404);
      }

      let depth = current.depth;
      if (data.parent_id !== undefined && data.parent_id !== current.parent_id) {
        if (data.parent_id === id) {
          throw new CatalogV2Error('Danh mục không thể tự làm cha của chính mình', 400);
        }
        if (data.parent_id) {
          const parent = await this.getCategoryById(data.parent_id);
          if (!parent) {
            throw new CatalogV2Error('Danh mục cha không tồn tại', 404);
          }
          if (parent.depth >= 2) {
            throw new CatalogV2Error('Cây danh mục tối đa 3 cấp', 400);
          }
          depth = parent.depth + 1;
        } else {
          depth = 0;
        }
      }

      const [rows] = await database.query(
        `UPDATE categories
         SET name = COALESCE($1, name),
             slug = COALESCE($2, slug),
             parent_id = $3,
             depth = $4,
             product_type_id = $5,
             sort_order = COALESCE($6, sort_order),
             is_visible = COALESCE($7, is_visible)
         WHERE id = $8
         RETURNING *`,
        [
          data.name,
          data.slug,
          data.parent_id !== undefined ? data.parent_id : current.parent_id,
          depth,
          data.product_type_id !== undefined ? data.product_type_id : current.product_type_id,
          data.sort_order,
          data.is_visible,
          id,
        ],
      );
      return rows[0];
    },

    async archiveCategory(id) {
      const [rows] = await database.query(
        `UPDATE categories
         SET archived_at = CURRENT_TIMESTAMP, is_visible = FALSE
         WHERE id = $1 AND archived_at IS NULL
         RETURNING *`,
        [id],
      );
      if (!rows[0]) {
        throw new CatalogV2Error('Danh mục không tồn tại hoặc đã được lưu trữ', 404);
      }
      return rows[0];
    },

    // -------------------------------------------------------------
    // PRODUCT TYPES & SCHEMAS
    // -------------------------------------------------------------
    async listProductTypes() {
      const [rows] = await database.query(
        `SELECT pt.*,
                (SELECT s.version FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'published' ORDER BY s.version DESC LIMIT 1) AS published_version,
                (SELECT s.id FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'published' ORDER BY s.version DESC LIMIT 1) AS published_schema_id,
                (SELECT COUNT(*)::int FROM products p JOIN product_type_schemas s ON s.id = p.product_type_schema_id WHERE s.product_type_id = pt.id AND p.status <> 'archived') AS products_count
         FROM product_types pt
         WHERE pt.archived_at IS NULL
         ORDER BY pt.name ASC`,
      );
      return rows;
    },

    async getProductTypeById(id) {
      const [rows] = await database.query(
        `SELECT pt.*
         FROM product_types pt
         WHERE pt.id = $1`,
        [id],
      );
      return rows[0] || null;
    },

    async createProductType(data, { createdBy = null } = {}) {
      return await database.transaction(async (tx) => {
        const [typeRows] = await tx.query(
          `INSERT INTO product_types (code, name, description, default_stock_mode, default_fulfillment_lane)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            data.code,
            data.name,
            data.description || null,
            data.default_stock_mode || 'made_to_order',
            data.default_fulfillment_lane || 'kitchen',
          ],
        );
        const productType = typeRows[0];

        // Create initial draft schema version 1
        const [schemaRows] = await tx.query(
          `INSERT INTO product_type_schemas (product_type_id, version, status, created_by)
           VALUES ($1, 1, 'draft', $2)
           RETURNING *`,
          [productType.id, createdBy],
        );
        const schema = schemaRows[0];

        return { productType, schema };
      });
    },

    async getSchemaDetails(schemaId) {
      const [schemaRows] = await database.query(
        `SELECT s.*, pt.code AS product_type_code, pt.name AS product_type_name
         FROM product_type_schemas s
         JOIN product_types pt ON pt.id = s.product_type_id
         WHERE s.id = $1`,
        [schemaId],
      );
      if (!schemaRows[0]) return null;

      const schema = schemaRows[0];

      const [attrRows] = await database.query(
        `SELECT a.*
         FROM attribute_definitions a
         WHERE a.schema_id = $1
         ORDER BY a.role DESC, a.sort_order ASC, a.name ASC`,
        [schemaId],
      );

      const attrIds = attrRows.map((a) => a.id);
      let values = [];
      if (attrIds.length > 0) {
        const [valRows] = await database.query(
          `SELECT v.*
           FROM attribute_values v
           WHERE v.attribute_definition_id = ANY($1::bigint[])
           ORDER BY v.sort_order ASC, v.label ASC`,
          [attrIds],
        );
        values = valRows;
      }

      const attributes = attrRows.map((attr) => ({
        ...attr,
        values: values.filter((v) => Number(v.attribute_definition_id) === Number(attr.id)),
      }));

      return {
        ...schema,
        attributes,
      };
    },

    async publishSchema(schemaId) {
      return await database.transaction(async (tx) => {
        const [sRows] = await tx.query('SELECT * FROM product_type_schemas WHERE id = $1', [schemaId]);
        const schema = sRows[0];
        if (!schema) {
          throw new CatalogV2Error('Schema không tồn tại', 404);
        }
        if (schema.status === 'published') {
          return schema;
        }

        // Retire any currently published schema for this product_type
        await tx.query(
          `UPDATE product_type_schemas
           SET status = 'retired', updated_at = CURRENT_TIMESTAMP
           WHERE product_type_id = $1 AND status = 'published'`,
          [schema.product_type_id],
        );

        const [pubRows] = await tx.query(
          `UPDATE product_type_schemas
           SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [schemaId],
        );
        return pubRows[0];
      });
    },

    async addAttributeToSchema(schemaId, attrData) {
      const [schemaRows] = await database.query('SELECT * FROM product_type_schemas WHERE id = $1', [schemaId]);
      const schema = schemaRows[0];
      if (!schema) {
        throw new CatalogV2Error('Schema không tồn tại', 404);
      }
      if (schema.status === 'published') {
        throw new CatalogV2Error('Schema đã xuất bản (published) là bất biến. Vui lòng tạo phiên bản mới.', 400);
      }

      const [rows] = await database.query(
        `INSERT INTO attribute_definitions (
           schema_id, code, name, role, input_type, is_required, is_filterable, sort_order, min_selections, max_selections, validation_rules
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          schemaId,
          attrData.code,
          attrData.name,
          attrData.role,
          attrData.input_type,
          attrData.is_required,
          attrData.is_filterable,
          attrData.sort_order,
          attrData.min_selections,
          attrData.max_selections,
          JSON.stringify(attrData.validation_rules || {}),
        ],
      );
      return rows[0];
    },

    async addAttributeValue(attrDefId, valData) {
      const [rows] = await database.query(
        `INSERT INTO attribute_values (
           attribute_definition_id, code, label, sort_order, is_active, price_adjustment
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          attrDefId,
          valData.code,
          valData.label,
          valData.sort_order || 0,
          valData.is_active ?? true,
          valData.price_adjustment || 0,
        ],
      );
      return rows[0];
    },
  };
}
