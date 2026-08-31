import postgresDb from '../../config/db-postgres.js';
import { CatalogV2Error } from './catalog-v2.js';
import { generateCanonicalVariantSignature } from '../../validation/catalog-v2-schemas.js';

export function createAdminCatalogV2Repository(database = postgresDb) {
  return {
    async listProducts({ categoryId, status, search, limit = 50, offset = 0 } = {}) {
      const params = [];
      let where = "WHERE p.status <> 'archived'";

      if (categoryId) {
        params.push(Number(categoryId));
        where += ` AND p.category_id IN (
          WITH RECURSIVE cat_tree AS (
            SELECT id FROM categories WHERE id = $${params.length} AND archived_at IS NULL
            UNION ALL
            SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
            WHERE c.archived_at IS NULL
          )
          SELECT id FROM cat_tree
        )`;
      }
      if (status) {
        params.push(status);
        where += ` AND p.status = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`;
      }

      params.push(limit);
      const limitParam = `$${params.length}`;
      params.push(offset);
      const offsetParam = `$${params.length}`;

      const [rows] = await database.query(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                pt.name AS product_type_name, pt.code AS product_type_code,
                (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id AND pv.status <> 'archived') AS variants_count
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN product_type_schemas pts ON pts.id = p.product_type_schema_id
         LEFT JOIN product_types pt ON pt.id = pts.product_type_id
         ${where}
         ORDER BY p.id DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params,
      );
      return rows;
    },

    async getProductDetails(id) {
      const [pRows] = await database.query(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                pt.name AS product_type_name, pt.code AS product_type_code, pt.id AS product_type_id
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN product_type_schemas pts ON pts.id = p.product_type_schema_id
         LEFT JOIN product_types pt ON pt.id = pts.product_type_id
         WHERE p.id = $1`,
        [id],
      );
      if (!pRows[0]) return null;

      const product = pRows[0];

      // Fetch variants
      const [vRows] = await database.query(
        `SELECT pv.*,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'attribute_definition_id', pvv.attribute_definition_id,
                      'attribute_value_id', pvv.attribute_value_id,
                      'attribute_code', ad.code,
                      'attribute_name', ad.name,
                      'value_code', av.code,
                      'value_label', av.label
                    )
                  ) FILTER (WHERE pvv.variant_id IS NOT NULL), '[]'
                ) AS attribute_values
         FROM product_variants pv
         LEFT JOIN product_variant_values pvv ON pvv.variant_id = pv.id
         LEFT JOIN attribute_definitions ad ON ad.id = pvv.attribute_definition_id
         LEFT JOIN attribute_values av ON av.id = pvv.attribute_value_id
         WHERE pv.product_id = $1 AND pv.status <> 'archived'
         GROUP BY pv.id
         ORDER BY pv.id ASC`,
        [id],
      );

      // Fetch media
      const [mRows] = await database.query(
        `SELECT * FROM product_media WHERE product_id = $1 ORDER BY sort_order ASC, id ASC`,
        [id],
      );

      return {
        ...product,
        variants: vRows,
        media: mRows,
      };
    },

    async createProduct(data, { createdBy = null } = {}) {
      return await database.transaction(async (tx) => {
        // Validate category exists and is a leaf category (no sub-categories)
        const [cRows] = await tx.query('SELECT * FROM categories WHERE id = $1', [data.category_id]);
        const category = cRows[0];
        if (!category) {
          throw new CatalogV2Error('Danh mục không tồn tại', 404);
        }
        if (category.archived_at) {
          throw new CatalogV2Error('Không thể tạo sản phẩm trong danh mục đã lưu trữ', 400);
        }

        const [subCatRows] = await tx.query(
          'SELECT 1 FROM categories WHERE parent_id = $1 AND archived_at IS NULL LIMIT 1',
          [category.id],
        );
        if (subCatRows[0]) {
          throw new CatalogV2Error('Không thể gắn sản phẩm trực tiếp vào danh mục cha có danh mục con', 400);
        }

        let schemaId = data.product_type_schema_id || null;
        let fulfillmentLane;
        let stockMode;

        if (!schemaId && category.product_type_id) {
          const [pubSchemaRows] = await tx.query(
            "SELECT id FROM product_type_schemas WHERE product_type_id = $1 AND status = 'published' ORDER BY version DESC LIMIT 1",
            [category.product_type_id],
          );
          if (pubSchemaRows[0]) {
            schemaId = pubSchemaRows[0].id;
          }
        }

        if (!schemaId) {
          const [ancestorSchemaRows] = await tx.query(
            `WITH RECURSIVE ancestors AS (
               SELECT c.id, c.parent_id, c.product_type_id FROM categories c WHERE c.id = $1
               UNION ALL
               SELECT p.id, p.parent_id, p.product_type_id
               FROM categories p JOIN ancestors a ON a.parent_id = p.id
             )
             SELECT s.id FROM ancestors a
             JOIN product_type_schemas s ON s.product_type_id = a.product_type_id AND s.status = 'published'
             WHERE a.product_type_id IS NOT NULL
             ORDER BY s.version DESC LIMIT 1`,
            [category.id],
          );
          if (ancestorSchemaRows[0]) {
            schemaId = ancestorSchemaRows[0].id;
          }
        }

        if (!schemaId) {
          const [fallbackRows] = await tx.query(
            `SELECT s.id FROM product_type_schemas s
             JOIN product_types pt ON pt.id = s.product_type_id
             WHERE s.status = 'published'
             ORDER BY CASE WHEN pt.code = 'beverage' THEN 0 ELSE 1 END, s.version DESC LIMIT 1`,
          );
          if (fallbackRows[0]) {
            schemaId = fallbackRows[0].id;
          }
        }

        if (schemaId) {
          const [sRows] = await tx.query(
            `SELECT s.*, pt.default_fulfillment_lane, pt.default_stock_mode
             FROM product_type_schemas s
             JOIN product_types pt ON pt.id = s.product_type_id
             WHERE s.id = $1 AND s.status = 'published'`,
            [schemaId],
          );
          if (sRows[0]) {
            fulfillmentLane = data.fulfillment_lane || sRows[0].default_fulfillment_lane;
            stockMode = data.stock_mode || sRows[0].default_stock_mode;
          }
        }

        if (!fulfillmentLane) fulfillmentLane = data.fulfillment_lane || 'kitchen';
        if (!stockMode) stockMode = data.stock_mode || 'made_to_order';

        const [pRows] = await tx.query(
          `INSERT INTO products (
             category_id, name, slug, base_tea, description, price, image_url,
             product_type_schema_id, status, fulfillment_lane, stock_mode
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            data.category_id,
            data.name,
            data.slug,
            data.base_tea || 'Mặc định',
            data.description || null,
            data.price || 0,
            data.image_url || null,
            schemaId,
            data.status || 'active',
            fulfillmentLane,
            stockMode,
          ],
        );
        const product = pRows[0];

        // If no custom variants provided, generate a default variant
        const [varAttrs] = schemaId
          ? await tx.query(
              "SELECT * FROM attribute_definitions WHERE schema_id = $1 AND role = 'variant'",
              [schemaId],
            )
          : [[]];

        if (varAttrs.length === 0) {
          const defaultSku = `SKU-${product.id}-DEF`;
          const [pvRows] = await tx.query(
            `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
             VALUES ($1, $2, 'default', 'Tiêu chuẩn', 'active')
             RETURNING id`,
            [product.id, defaultSku],
          );
          if (pvRows[0]) {
            await tx.query(
              `INSERT INTO branch_variant_offers (store_id, variant_id, price, compare_at_price, is_available)
               SELECT s.id, $1, $2, NULL, TRUE
               FROM stores s
               WHERE s.is_active = TRUE
               ON CONFLICT (store_id, variant_id) DO UPDATE SET price = EXCLUDED.price, is_available = EXCLUDED.is_available`,
              [pvRows[0].id, Number(product.price) || 0],
            );
          }
        }

        // Insert media if provided
        if (Array.isArray(data.media) && data.media.length > 0) {
          for (let i = 0; i < data.media.length; i++) {
            const m = data.media[i];
            await tx.query(
              `INSERT INTO product_media (product_id, image_url, alt_text, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [product.id, m.image_url, m.alt_text || product.name, i],
            );
          }
        }

        return product;
      });
    },

    async updateProduct(id, data) {
      return await database.transaction(async (tx) => {
        const [currentRows] = await tx.query(
          `SELECT p.*, s.product_type_id
           FROM products p
           LEFT JOIN product_type_schemas s ON s.id = p.product_type_schema_id
           WHERE p.id = $1`,
          [id],
        );
        const current = currentRows[0];
        if (!current) {
          throw new CatalogV2Error('Sản phẩm không tồn tại', 404);
        }

        const targetCategoryId = data.category_id ?? current.category_id;
        const [categoryRows] = await tx.query(
          `SELECT c.*,
                  EXISTS(
                    SELECT 1 FROM categories child
                    WHERE child.parent_id = c.id AND child.archived_at IS NULL
                  ) AS has_children
           FROM categories c
           WHERE c.id = $1`,
          [targetCategoryId],
        );
        const category = categoryRows[0];
        if (!category || category.archived_at) {
          throw new CatalogV2Error('Danh mục không tồn tại hoặc đã được lưu trữ', 400);
        }
        if (category.has_children) {
          throw new CatalogV2Error('Không thể gắn sản phẩm trực tiếp vào danh mục cha', 400);
        }
        if (
          category.product_type_id
          && current.product_type_id
          && Number(category.product_type_id) !== Number(current.product_type_id)
        ) {
          throw new CatalogV2Error('Danh mục mới không cùng loại sản phẩm với schema hiện tại', 400);
        }

        const [rows] = await tx.query(
        `UPDATE products
         SET name = COALESCE($1, name),
             slug = COALESCE($2, slug),
             category_id = COALESCE($3, category_id),
             description = COALESCE($4, description),
             price = COALESCE($5, price),
             image_url = COALESCE($6, image_url),
             status = COALESCE($7, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
          [
          data.name,
          data.slug,
          data.category_id,
          data.description,
          data.price,
          data.image_url,
          data.status,
          id,
          ],
        );
        return rows[0];
      });
    },

    async archiveProduct(id) {
      const [rows] = await database.query(
        `UPDATE products
         SET status = 'archived', is_available = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      if (!rows[0]) {
        throw new CatalogV2Error('Sản phẩm không tồn tại', 404);
      }
      return rows[0];
    },

    async createVariant(productId, variantData) {
      return await database.transaction(async (tx) => {
        const [pRows] = await tx.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = pRows[0];
        if (!product) throw new CatalogV2Error('Sản phẩm không tồn tại', 404);
        if (product.status === 'archived') throw new CatalogV2Error('Sản phẩm đã được lưu trữ', 400);

        const providedValues = Array.isArray(variantData.attribute_values)
          ? variantData.attribute_values
          : [];
        const [allowedRows] = product.product_type_schema_id
          ? await tx.query(
              `SELECT a.id AS attribute_definition_id, v.id AS attribute_value_id
               FROM attribute_definitions a
               JOIN attribute_values v ON v.attribute_definition_id = a.id AND v.is_active = TRUE
               WHERE a.schema_id = $1 AND a.role = 'variant'`,
              [product.product_type_schema_id],
            )
          : [[]];
        const definitionIds = new Set(allowedRows.map((row) => Number(row.attribute_definition_id)));
        const providedDefinitionIds = providedValues.map((value) => Number(value.attribute_definition_id));
        if (
          providedValues.length !== definitionIds.size
          || new Set(providedDefinitionIds).size !== providedDefinitionIds.length
        ) {
          throw new CatalogV2Error('Biến thể phải chọn đúng một giá trị cho mỗi thuộc tính biến thể', 400);
        }
        const allowedPairs = new Set(
          allowedRows.map((row) => `${row.attribute_definition_id}:${row.attribute_value_id}`),
        );
        if (
          providedValues.some(
            (value) => !allowedPairs.has(`${Number(value.attribute_definition_id)}:${Number(value.attribute_value_id)}`),
          )
        ) {
          throw new CatalogV2Error('Giá trị biến thể không thuộc schema của sản phẩm', 400);
        }

        const signature = generateCanonicalVariantSignature(providedValues);

        const [vRows] = await tx.query(
          `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, barcode, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            productId,
            variantData.sku,
            signature,
            variantData.name_suffix || null,
            variantData.barcode || null,
            variantData.status || 'active',
          ],
        );
        const variant = vRows[0];

        if (providedValues.length > 0) {
          for (const av of providedValues) {
            await tx.query(
              `INSERT INTO product_variant_values (variant_id, attribute_definition_id, attribute_value_id)
               VALUES ($1, $2, $3)`,
              [variant.id, av.attribute_definition_id, av.attribute_value_id],
            );
          }
        }

        return variant;
      });
    },
  };
}
