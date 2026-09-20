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
    async listCategories({ includeArchived = false, lane = null } = {}) {
      const filters = [];
      const params = [];
      if (!includeArchived) filters.push('c.archived_at IS NULL');
      if (lane) {
        params.push(lane);
        filters.push(`COALESCE(c.default_fulfillment_lane, pt.default_fulfillment_lane, parent.default_fulfillment_lane, parent_pt.default_fulfillment_lane) = $${params.length}`);
      }
      const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.product_type_id,
                COALESCE(c.default_fulfillment_lane, pt.default_fulfillment_lane, parent.default_fulfillment_lane, parent_pt.default_fulfillment_lane) AS default_fulfillment_lane,
                c.sort_order, c.is_visible, c.archived_at, c.created_at,
                COALESCE(pt.name, parent_pt.name) AS product_type_name,
                COALESCE(pt.code, parent_pt.code) AS product_type_code,
                COALESCE(pt.default_fulfillment_lane, parent_pt.default_fulfillment_lane) AS product_type_default_fulfillment_lane,
                (SELECT COUNT(*)::int FROM categories sub WHERE sub.parent_id = c.id AND sub.archived_at IS NULL) AS children_count,
                (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status <> 'archived') AS products_count
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         LEFT JOIN categories parent ON parent.id = c.parent_id
         LEFT JOIN product_types parent_pt ON parent_pt.id = parent.product_type_id
         ${where}
         ORDER BY c.depth ASC, c.sort_order ASC, c.name ASC`,
        params,
      );
      return rows;
    },

    async getCategoryById(id) {
      const [rows] = await database.query(
        `SELECT c.*, pt.name AS product_type_name, pt.code AS product_type_code,
                pt.default_fulfillment_lane AS product_type_default_fulfillment_lane
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         WHERE c.id = $1`,
        [id],
      );
      return rows[0] || null;
    },

    async createCategory(data) {
      let depth = 0;
      let productTypeId = data.product_type_id || null;
      let defaultFulfillmentLane = data.default_fulfillment_lane ?? null;
      if (data.parent_id) {
        const parent = await this.getCategoryById(data.parent_id);
        if (!parent) {
          throw new CatalogV2Error('Danh mục cha không tồn tại', 404);
        }
        if (parent.depth >= 1) {
          throw new CatalogV2Error('Cây danh mục chuẩn 2 tầng (chỉ gồm Danh mục Gốc và Danh mục Con trực tiếp)', 400);
        }
        depth = parent.depth + 1;
        if (!parent.product_type_id) {
          throw new CatalogV2Error('Danh mục gốc phải thuộc một ngành hàng trước khi tạo danh mục con', 400);
        }
        const parentLane = parent.default_fulfillment_lane || parent.product_type_default_fulfillment_lane;
        if (!defaultFulfillmentLane && parentLane) {
          defaultFulfillmentLane = parentLane;
        }
        if (!['kitchen', 'packing'].includes(defaultFulfillmentLane)) {
          throw new CatalogV2Error('Danh mục con phải chọn khu vực Bếp hoặc Đóng gói', 400);
        }
        if (productTypeId && Number(productTypeId) !== Number(parent.product_type_id)) {
          throw new CatalogV2Error('Danh mục con phải kế thừa đúng ngành hàng của danh mục gốc', 400);
        }
        if (parentLane && parentLane !== defaultFulfillmentLane) {
          throw new CatalogV2Error('Danh mục con phải thuộc đúng khu vực của ngành hàng', 400);
        }
        productTypeId = parent.product_type_id;
      } else if (!['kitchen', 'packing'].includes(defaultFulfillmentLane)) {
        throw new CatalogV2Error('Ngành hàng không thuộc riêng khu vực Bếp hoặc Đóng gói', 400);
      }

      try {
        const [rows] = await database.query(
          `INSERT INTO categories (
             name, slug, parent_id, depth, product_type_id, default_fulfillment_lane, sort_order, is_visible
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            data.name,
            data.slug,
            data.parent_id || null,
            depth,
            productTypeId,
            defaultFulfillmentLane,
            data.sort_order || 0,
            data.is_visible ?? true,
          ],
        );
        return rows[0];
      } catch (err) {
        if (err?.code === '23505') {
          throw new CatalogV2Error(
            depth === 0
              ? 'Tên hoặc slug ngành hàng gốc đã tồn tại'
              : 'Tên hoặc slug danh mục đã tồn tại',
            409,
          );
        }
        throw err;
      }
    },

    async updateCategory(id, data) {
      const current = await this.getCategoryById(id);
      if (!current) {
        throw new CatalogV2Error('Danh mục không tồn tại', 404);
      }

      if (data.default_fulfillment_lane !== undefined && data.default_fulfillment_lane !== null && data.default_fulfillment_lane !== current.default_fulfillment_lane) {
        throw new CatalogV2Error('Không thể chuyển ngành hàng hoặc danh mục sang khu vực khác', 400);
      }

      let depth = current.depth;
      if (data.parent_id !== undefined && data.parent_id !== current.parent_id) {
        if (data.parent_id === id) {
          throw new CatalogV2Error('Danh mục không thể tự làm cha của chính mình', 400);
        }
        if (data.parent_id) {
          const [descendantRows] = await database.query(
            `WITH RECURSIVE descendants AS (
               SELECT id FROM categories WHERE parent_id = $1
               UNION ALL
               SELECT c.id
               FROM categories c
               JOIN descendants d ON c.parent_id = d.id
             )
             SELECT 1 FROM descendants WHERE id = $2 LIMIT 1`,
            [id, data.parent_id],
          );
          if (descendantRows[0]) {
            throw new CatalogV2Error('Không thể chuyển danh mục vào bên trong cây con của chính nó', 400);
          }
          const parent = await this.getCategoryById(data.parent_id);
          if (!parent) {
            throw new CatalogV2Error('Danh mục cha không tồn tại', 404);
          }
          if (parent.depth >= 1) {
            throw new CatalogV2Error('Cây danh mục chuẩn 2 tầng (chỉ gồm Danh mục Gốc và Danh mục Con trực tiếp)', 400);
          }
          depth = parent.depth + 1;
        } else {
          depth = 0;
        }

        const [subtreeRows] = await database.query(
          `WITH RECURSIVE subtree AS (
             SELECT id, 0 AS relative_depth FROM categories WHERE id = $1
             UNION ALL
             SELECT c.id, s.relative_depth + 1
             FROM categories c
             JOIN subtree s ON c.parent_id = s.id
           )
           SELECT COALESCE(MAX(relative_depth), 0)::int AS max_relative_depth FROM subtree`,
          [id],
        );
        if (depth + Number(subtreeRows[0]?.max_relative_depth || 0) > 1) {
          throw new CatalogV2Error('Thao tác này làm cây danh mục vượt quá 2 cấp', 400);
        }
      }

      try {
        return await database.transaction(async (tx) => {
          const [rows] = await tx.query(
            `UPDATE categories
             SET name = COALESCE($1, name),
                 slug = COALESCE($2, slug),
                 parent_id = $3,
                 depth = $4,
                 product_type_id = $5,
                 default_fulfillment_lane = $6,
                 sort_order = COALESCE($7, sort_order),
                 is_visible = COALESCE($8, is_visible)
             WHERE id = $9
             RETURNING *`,
            [
              data.name,
              data.slug,
              data.parent_id !== undefined ? data.parent_id : current.parent_id,
              depth,
              data.product_type_id !== undefined ? data.product_type_id : current.product_type_id,
              current.default_fulfillment_lane,
              data.sort_order,
              data.is_visible,
              id,
            ],
          );

          if (depth !== current.depth) {
            const depthDelta = depth - current.depth;
            await tx.query(
              `WITH RECURSIVE descendants AS (
                 SELECT id FROM categories WHERE parent_id = $1
                 UNION ALL
                 SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id
               )
               UPDATE categories
               SET depth = depth + $2
               WHERE id IN (SELECT id FROM descendants)`,
              [id, depthDelta],
            );
          }
          return rows[0];
        });
      } catch (err) {
        if (err?.code === '23505') {
          throw new CatalogV2Error(
            depth === 0
              ? 'Tên hoặc slug ngành hàng gốc đã tồn tại'
              : 'Tên hoặc slug danh mục đã tồn tại',
            409,
          );
        }
        throw err;
      }
    },

    async archiveCategory(id) {
      return await database.transaction(async (tx) => {
        const [categoryRows] = await tx.query(
          'SELECT * FROM categories WHERE id = $1 AND archived_at IS NULL FOR UPDATE',
          [id],
        );
        if (!categoryRows[0]) {
          throw new CatalogV2Error('Danh mục không tồn tại hoặc đã được lưu trữ', 404);
        }
        const category = categoryRows[0];
        const [dependencyRows] = await tx.query(
          `SELECT
             EXISTS(SELECT 1 FROM categories WHERE parent_id = $1 AND archived_at IS NULL) AS has_children,
             EXISTS(SELECT 1 FROM products WHERE category_id = $1 AND status <> 'archived') AS has_products`,
          [id],
        );
        if (dependencyRows[0]?.has_children || dependencyRows[0]?.has_products) {
          throw new CatalogV2Error('Chỉ được lưu trữ danh mục không còn danh mục con hoặc sản phẩm đang dùng', 409);
        }
        const [rows] = await tx.query(
          `UPDATE categories
           SET archived_at = CURRENT_TIMESTAMP,
               is_visible = FALSE,
               -- The legacy schema makes both identifiers globally unique.
               -- Retiring them lets an administrator recreate a deleted test
               -- category without an archived record blocking the new row.
               name = LEFT(name, 120) || ' [archived-' || id::text || ']',
               slug = LEFT(slug, 120) || '--archived-' || id::text
           WHERE id = $1
           RETURNING *`,
          [id],
        );

        // Nếu danh mục lưu trữ là ngành hàng gốc có liên kết product_type_id,
        // và không còn danh mục đang hoạt động nào khác hay sản phẩm đang hoạt động nào dùng nó,
        // ta cũng lưu trữ và retire mã product_type để giải phóng code cho phép tạo lại sau này.
        if (category.product_type_id) {
          const [activeTypeUsage] = await tx.query(
            `SELECT
               EXISTS(SELECT 1 FROM categories WHERE product_type_id = $1 AND id <> $2 AND archived_at IS NULL) AS has_categories,
               EXISTS(
                 SELECT 1 FROM products p
                 JOIN product_type_schemas s ON s.id = p.product_type_schema_id
                 WHERE s.product_type_id = $1 AND p.status <> 'archived'
               ) AS has_products`,
            [category.product_type_id, id],
          );
          if (!activeTypeUsage[0]?.has_categories && !activeTypeUsage[0]?.has_products) {
            await tx.query(
              `UPDATE product_types
               SET archived_at = CURRENT_TIMESTAMP,
                   code = LEFT(code, 60) || '_archived_' || id::text || '_' || EXTRACT(EPOCH FROM NOW())::bigint::text,
                   name = LEFT(name, 160) || ' [archived-' || id::text || ']'
               WHERE id = $1 AND archived_at IS NULL`,
              [category.product_type_id],
            );
          }
        }

        return rows[0];
      });
    },

    // -------------------------------------------------------------
    // PRODUCT TYPES & SCHEMAS
    // -------------------------------------------------------------
    async listProductTypes() {
      const [rows] = await database.query(
        `SELECT pt.*,
                (SELECT s.version FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'published' ORDER BY s.version DESC LIMIT 1) AS published_version,
                (SELECT s.id FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'published' ORDER BY s.version DESC LIMIT 1) AS published_schema_id,
                (SELECT s.version FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'draft' ORDER BY s.version DESC LIMIT 1) AS draft_version,
                (SELECT s.id FROM product_type_schemas s WHERE s.product_type_id = pt.id AND s.status = 'draft' ORDER BY s.version DESC LIMIT 1) AS draft_schema_id,
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

    async getPublishedSchemaByProductType(productTypeId) {
      const [rows] = await database.query(
        `SELECT * FROM product_type_schemas
         WHERE product_type_id = $1 AND status = 'published'
         ORDER BY version DESC LIMIT 1`,
        [Number(productTypeId)],
      );
      return rows[0] || null;
    },

    async createNextSchemaVersion(productTypeId, { createdBy = null } = {}) {
      return await database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock($1)', [Number(productTypeId)]);
        const [typeRows] = await tx.query(
          'SELECT * FROM product_types WHERE id = $1 AND archived_at IS NULL',
          [productTypeId],
        );
        if (!typeRows[0]) {
          throw new CatalogV2Error('Loại sản phẩm không tồn tại', 404);
        }

        const [draftRows] = await tx.query(
          "SELECT * FROM product_type_schemas WHERE product_type_id = $1 AND status = 'draft' LIMIT 1",
          [productTypeId],
        );
        if (draftRows[0]) {
          throw new CatalogV2Error('Loại sản phẩm này đã có một schema nháp đang chỉnh sửa', 409);
        }

        const [latestRows] = await tx.query(
          `SELECT * FROM product_type_schemas
           WHERE product_type_id = $1
           ORDER BY version DESC
           LIMIT 1`,
          [productTypeId],
        );
        const latestSchema = latestRows[0];
        const nextVersion = Number(latestSchema?.version || 0) + 1;
        const [newSchemaRows] = await tx.query(
          `INSERT INTO product_type_schemas (product_type_id, version, status, created_by)
           VALUES ($1, $2, 'draft', $3)
           RETURNING *`,
          [productTypeId, nextVersion, createdBy],
        );
        const newSchema = newSchemaRows[0];

        if (latestSchema) {
          const [attributeRows] = await tx.query(
            'SELECT * FROM attribute_definitions WHERE schema_id = $1 ORDER BY id ASC',
            [latestSchema.id],
          );
          for (const attribute of attributeRows) {
            const [newAttributeRows] = await tx.query(
              `INSERT INTO attribute_definitions (
                 schema_id, code, name, role, input_type, is_required, is_filterable,
                 sort_order, min_selections, max_selections, validation_rules
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               RETURNING id`,
              [
                newSchema.id,
                attribute.code,
                attribute.name,
                attribute.role,
                attribute.input_type,
                attribute.is_required,
                attribute.is_filterable,
                attribute.sort_order,
                attribute.min_selections,
                attribute.max_selections,
                JSON.stringify(attribute.validation_rules || {}),
              ],
            );
            const newAttributeId = newAttributeRows[0].id;
            await tx.query(
              `INSERT INTO attribute_values (
                 attribute_definition_id, code, label, sort_order, is_active, price_adjustment
               )
               SELECT $1, code, label, sort_order, is_active, price_adjustment
               FROM attribute_values
               WHERE attribute_definition_id = $2`,
              [newAttributeId, attribute.id],
            );
          }
        }

        return newSchema;
      });
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

    async createIndustry(data, { createdBy = null } = {}) {
      return await database.transaction(async (tx) => {
        // Kiểm tra xem mã code loại sản phẩm / ngành hàng này đã từng tồn tại chưa
        const [existingTypes] = await tx.query(
          'SELECT id, code, name, archived_at FROM product_types WHERE code = $1 FOR UPDATE',
          [data.code],
        );
        if (existingTypes[0]) {
          const existing = existingTypes[0];
          // Kiểm tra xem có danh mục hoặc sản phẩm nào đang hoạt động sử dụng product_type này không
          const [usageRows] = await tx.query(
            `SELECT
               EXISTS(SELECT 1 FROM categories WHERE product_type_id = $1 AND archived_at IS NULL) AS has_active_categories,
               EXISTS(
                 SELECT 1 FROM products p
                 JOIN product_type_schemas s ON s.id = p.product_type_schema_id
                 WHERE s.product_type_id = $1 AND p.status <> 'archived'
               ) AS has_active_products`,
            [existing.id],
          );
          if (usageRows[0]?.has_active_categories || usageRows[0]?.has_active_products) {
            throw new CatalogV2Error('Mã, slug, SKU hoặc tổ hợp biến thể đã tồn tại', 409);
          }
          // Nếu không còn danh mục hoặc sản phẩm nào đang hoạt động (đã bị xóa/mồ côi trước đó),
          // retire bản ghi cũ để giải phóng mã code cho ngành hàng mới tạo
          await tx.query(
            `UPDATE product_types
             SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
                 code = LEFT(code, 60) || '_archived_' || id::text || '_' || EXTRACT(EPOCH FROM NOW())::bigint::text,
                 name = LEFT(name, 160) || ' [archived-' || id::text || ']'
             WHERE id = $1`,
            [existing.id],
          );
        }

        // Tương tự, nếu trong categories có bản ghi cũ cùng slug/name nhưng đã archived_at IS NOT NULL
        // mà chưa được đổi slug (phòng trường hợp legacy), ta retire slug cũ
        const targetSlug = data.code.replace(/_/g, '-');
        await tx.query(
          `UPDATE categories
           SET slug = LEFT(slug, 110) || '--archived-' || id::text || '-' || EXTRACT(EPOCH FROM NOW())::bigint::text,
               name = LEFT(name, 110) || ' [archived-' || id::text || ']'
           WHERE (slug = $1 OR name = $2) AND archived_at IS NOT NULL`,
          [targetSlug, data.name],
        );

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
        const [schemaRows] = await tx.query(
          `INSERT INTO product_type_schemas (product_type_id, version, status, created_by)
           VALUES ($1, 1, 'draft', $2)
           RETURNING *`,
          [productType.id, createdBy],
        );
        const [rootRows] = await tx.query(
          `INSERT INTO categories (
             name, slug, parent_id, depth, product_type_id, default_fulfillment_lane, sort_order, is_visible
           ) VALUES ($1, $2, NULL, 0, $3, $4, 0, TRUE)
           RETURNING *`,
          [data.name, targetSlug, productType.id, data.default_fulfillment_lane || 'kitchen'],
        );
        return { productType, schema: schemaRows[0], rootCategory: rootRows[0] };
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
        if (schema.status !== 'draft') {
          throw new CatalogV2Error('Chỉ schema nháp mới có thể được xuất bản', 400);
        }

        await tx.query('SELECT pg_advisory_xact_lock($1)', [Number(schema.product_type_id)]);

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
      if (schema.status === 'retired') {
        throw new CatalogV2Error('Không thể thêm thuộc tính vào schema đã ngừng sử dụng', 400);
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
      const [attributeRows] = await database.query(
        `SELECT a.id, s.status
         FROM attribute_definitions a
         JOIN product_type_schemas s ON s.id = a.schema_id
         WHERE a.id = $1`,
        [attrDefId],
      );
      if (!attributeRows[0]) {
        throw new CatalogV2Error('Thuộc tính không tồn tại', 404);
      }
      if (attributeRows[0].status === 'retired') {
        throw new CatalogV2Error('Không thể sửa giá trị của schema đã ngừng sử dụng', 400);
      }
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

    async createCategoryOptionGroup(categoryId, schemaId, attributeData, values, assignmentData = {}) {
      return await database.transaction(async (tx) => {
        const [contextRows] = await tx.query(
          `SELECT c.id AS category_id, c.product_type_id AS category_product_type_id,
                  pts.id AS schema_id, pts.product_type_id AS schema_product_type_id, pts.status AS schema_status
           FROM categories c
           JOIN product_type_schemas pts ON pts.id = $2
           WHERE c.id = $1 AND c.archived_at IS NULL
           FOR UPDATE OF c, pts`,
          [Number(categoryId), Number(schemaId)],
        );
        const context = contextRows[0];
        if (!context) {
          throw new CatalogV2Error('Danh mục hoặc schema không tồn tại', 404);
        }
        if (context.schema_status === 'retired') {
          throw new CatalogV2Error('Không thể thêm tùy chọn vào schema đã ngừng sử dụng', 400);
        }
        if (Number(context.category_product_type_id) !== Number(context.schema_product_type_id)) {
          throw new CatalogV2Error('Tùy chọn không thuộc loại sản phẩm của danh mục', 409);
        }

        // Attribute, values, and assignment are intentionally written in this
        // one transaction so a failed assignment cannot leave hidden data that
        // makes a retry fail with a duplicate-code error.
        const [attributeRows] = await tx.query(
          `INSERT INTO attribute_definitions (
             schema_id, code, name, role, input_type, is_required, is_filterable,
             sort_order, min_selections, max_selections, validation_rules
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            Number(schemaId),
            attributeData.code,
            attributeData.name,
            attributeData.role,
            attributeData.input_type,
            attributeData.is_required,
            attributeData.is_filterable,
            attributeData.sort_order,
            attributeData.min_selections,
            attributeData.max_selections,
            JSON.stringify(attributeData.validation_rules || {}),
          ],
        );
        const attribute = attributeRows[0];

        const createdValues = [];
        for (const valueData of values) {
          const [valueRows] = await tx.query(
            `INSERT INTO attribute_values (
               attribute_definition_id, code, label, sort_order, is_active, price_adjustment
             ) VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
              attribute.id,
              valueData.code,
              valueData.label,
              valueData.sort_order,
              valueData.is_active,
              valueData.price_adjustment,
            ],
          );
          createdValues.push(valueRows[0]);
        }

        const [assignmentRows] = await tx.query(
          `INSERT INTO category_attribute_assignments
             (category_id, attribute_definition_id, is_enabled, inherit_to_descendants,
              sort_order, is_required, min_selected, max_selected, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            Number(categoryId),
            attribute.id,
            assignmentData.isEnabled ?? true,
            assignmentData.inheritToDescendants ?? true,
            assignmentData.sortOrder ?? attributeData.sort_order,
            assignmentData.isRequired ?? attributeData.is_required,
            assignmentData.minSelected ?? attributeData.min_selections,
            assignmentData.maxSelected ?? attributeData.max_selections,
          ],
        );

        return { attribute, values: createdValues, assignment: assignmentRows[0] };
      });
    },

    async updateCategoryOptionGroup(categoryId, attributeId, attributeData, values = []) {
      return await database.transaction(async (tx) => {
        const [attrRows] = await tx.query(
          `SELECT ad.*
           FROM attribute_definitions ad
           WHERE ad.id = $1 AND ad.role = 'modifier'
           FOR UPDATE OF ad`,
          [Number(attributeId)],
        );
        const attribute = attrRows[0];
        if (!attribute) {
          throw new CatalogV2Error('Nhóm tùy chọn không tồn tại hoặc không thể chỉnh sửa', 404);
        }

        let updatedAttr = attribute;
        if (attributeData.name) {
          const [updatedRows] = await tx.query(
            `UPDATE attribute_definitions
             SET name = $1
             WHERE id = $2
             RETURNING *`,
            [attributeData.name.trim(), Number(attributeId)],
          );
          updatedAttr = updatedRows[0] || attribute;
        }

        const updatedValues = [];
        if (Array.isArray(values)) {
          const [currentValRows] = await tx.query(
            `SELECT * FROM attribute_values WHERE attribute_definition_id = $1`,
            [Number(attributeId)],
          );
          const currentValIds = new Set(currentValRows.map((v) => Number(v.id)));
          const incomingValIds = new Set(
            values
              .filter((v) => v.id != null)
              .map((v) => Number(v.id))
          );

          // Delete values that were removed
          const toDeleteIds = [...currentValIds].filter((id) => !incomingValIds.has(id));
          if (toDeleteIds.length > 0) {
            await tx.query(
              `DELETE FROM product_modifier_values WHERE attribute_value_id = ANY($1::bigint[])`,
              [toDeleteIds],
            );
            await tx.query(
              `DELETE FROM attribute_values WHERE id = ANY($1::bigint[]) AND attribute_definition_id = $2`,
              [toDeleteIds, Number(attributeId)],
            );
          }

          // Update existing or insert new
          for (let i = 0; i < values.length; i++) {
            const val = values[i];
            const sortOrder = val.sort_order ?? (i + 1);
            const priceAdj = Number(val.price_adjustment) || 0;
            const isActive = val.is_active !== false;

            if (val.id && currentValIds.has(Number(val.id))) {
              const [valUpdateRows] = await tx.query(
                `UPDATE attribute_values
                 SET label = $1, price_adjustment = $2, sort_order = $3, is_active = $4
                 WHERE id = $5 AND attribute_definition_id = $6
                 RETURNING *`,
                [val.label.trim(), priceAdj, sortOrder, isActive, Number(val.id), Number(attributeId)],
              );
              updatedValues.push(valUpdateRows[0]);
            } else {
              const [valInsertRows] = await tx.query(
                `INSERT INTO attribute_values (
                   attribute_definition_id, code, label, sort_order, is_active, price_adjustment
                 ) VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [
                  Number(attributeId),
                  val.code || `opt_${Date.now()}_${i}`,
                  val.label.trim(),
                  sortOrder,
                  isActive,
                  priceAdj,
                ],
              );
              updatedValues.push(valInsertRows[0]);
            }
          }
        }

        return { attribute: updatedAttr, values: updatedValues };
      });
    },

    async deleteCategoryOptionGroup(categoryId, attributeId) {
      return await database.transaction(async (tx) => {
        const [attrRows] = await tx.query(
          `SELECT id, name, role FROM attribute_definitions WHERE id = $1`,
          [Number(attributeId)],
        );
        const attribute = attrRows[0];
        if (!attribute) {
          throw new CatalogV2Error('Nhóm tùy chọn không tồn tại', 404);
        }
        if (attribute.role !== 'modifier') {
          throw new CatalogV2Error('Chỉ có thể xóa nhóm tùy chọn, không thể xóa biến thể', 400);
        }

        await tx.query(
          `DELETE FROM product_modifier_values WHERE attribute_definition_id = $1`,
          [Number(attributeId)],
        );

        await tx.query(
          `DELETE FROM attribute_definitions WHERE id = $1`,
          [Number(attributeId)],
        );

        return { success: true, id: Number(attributeId), name: attribute.name };
      });
    },
  };
}
