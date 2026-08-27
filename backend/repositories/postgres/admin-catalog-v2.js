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
        where += ` AND p.category_id = $${params.length}`;
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
        let fulfillmentLane = data.fulfillment_lane || 'kitchen';
        let stockMode = data.stock_mode || 'made_to_order';

        if (!schemaId && category.product_type_id) {
          const [pubSchemaRows] = await tx.query(
            "SELECT * FROM product_type_schemas WHERE product_type_id = $1 AND status = 'published' ORDER BY version DESC LIMIT 1",
            [category.product_type_id],
          );
          if (pubSchemaRows[0]) {
            schemaId = pubSchemaRows[0].id;
          }
        }

        if (schemaId) {
          const [sRows] = await tx.query(
            `SELECT s.*, pt.default_fulfillment_lane, pt.default_stock_mode
             FROM product_type_schemas s
             JOIN product_types pt ON pt.id = s.product_type_id
             WHERE s.id = $1`,
            [schemaId],
          );
          if (sRows[0]) {
            fulfillmentLane = data.fulfillment_lane || sRows[0].default_fulfillment_lane;
            stockMode = data.stock_mode || sRows[0].default_stock_mode;
          }
        }

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
          await tx.query(
            `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
             VALUES ($1, $2, 'default', 'Tiêu chuẩn', 'active')`,
            [product.id, defaultSku],
          );
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
      const [rows] = await database.query(
        `UPDATE products
         SET name = COALESCE($1, name),
             slug = COALESCE($2, slug),
             category_id = COALESCE($3, category_id),
             description = COALESCE($4, description),
             price = COALESCE($5, price),
             image_url = COALESCE($6, image_url),
             status = COALESCE($7, status),
             fulfillment_lane = COALESCE($8, fulfillment_lane),
             stock_mode = COALESCE($9, stock_mode),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [
          data.name,
          data.slug,
          data.category_id,
          data.description,
          data.price,
          data.image_url,
          data.status,
          data.fulfillment_lane,
          data.stock_mode,
          id,
        ],
      );
      if (!rows[0]) {
        throw new CatalogV2Error('Sản phẩm không tồn tại', 404);
      }
      return rows[0];
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
        if (!pRows[0]) throw new CatalogV2Error('Sản phẩm không tồn tại', 404);

        const signature = generateCanonicalVariantSignature(variantData.attribute_values || []);

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

        if (Array.isArray(variantData.attribute_values) && variantData.attribute_values.length > 0) {
          for (const av of variantData.attribute_values) {
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
