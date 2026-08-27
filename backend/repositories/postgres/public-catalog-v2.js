import postgresDb from '../../config/db-postgres.js';

export function createPublicCatalogV2Repository(database = postgresDb) {
  return {
    async getCategoryTree() {
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.sort_order,
                pt.code AS product_type_code, pt.name AS product_type_name
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         WHERE c.is_visible = TRUE AND c.archived_at IS NULL
         ORDER BY c.depth ASC, c.sort_order ASC, c.name ASC`,
      );
      return rows;
    },

    async listProducts({ storeId, categorySlug, search, limit = 50, offset = 0 } = {}) {
      const params = [];
      let storeJoin = '';
      let priceSelect = 'p.price AS price, TRUE AS is_available';

      if (storeId) {
        params.push(Number(storeId));
        storeJoin = `
          LEFT JOIN product_variants pv_main ON pv_main.product_id = p.id AND pv_main.variant_signature = 'default'
          LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv_main.id AND bvo.store_id = $${params.length}
          LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv_main.id AND bvi.store_id = $${params.length}
        `;
        priceSelect = `
          COALESCE(bvo.price, p.price) AS price,
          bvo.compare_at_price,
          COALESCE(bvo.is_available, p.is_available) AS is_available,
          COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) AS available_stock
        `;
      }

      let where = "WHERE p.status = 'active' AND c.is_visible = TRUE AND c.archived_at IS NULL";

      if (categorySlug) {
        params.push(categorySlug);
        where += ` AND (c.slug = $${params.length} OR parent_c.slug = $${params.length})`;
      }

      if (search) {
        params.push(`%${search}%`);
        where += ` AND (p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
      }

      params.push(limit);
      const limitParam = `$${params.length}`;
      params.push(offset);
      const offsetParam = `$${params.length}`;

      const [rows] = await database.query(
        `SELECT p.id, p.name, p.slug, p.description, p.image_url, p.fulfillment_lane, p.stock_mode,
                p.category_id, c.name AS category_name, c.slug AS category_slug,
                pt.code AS product_type_code, pt.name AS product_type_name,
                p.product_type_schema_id,
                ${priceSelect},
                (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'active') AS variants_count
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN categories parent_c ON parent_c.id = c.parent_id
         LEFT JOIN product_type_schemas pts ON pts.id = p.product_type_schema_id
         LEFT JOIN product_types pt ON pt.id = pts.product_type_id
         ${storeJoin}
         ${where}
         ORDER BY p.id ASC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params,
      );
      return rows;
    },

    async getProductBySlug(slug, { storeId } = {}) {
      const params = [slug];
      let storeJoin = '';
      let priceSelect = 'p.price AS price, p.is_available AS is_available';

      if (storeId) {
        params.push(Number(storeId));
        storeJoin = `
          LEFT JOIN product_variants pv_def ON pv_def.product_id = p.id AND pv_def.variant_signature = 'default'
          LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv_def.id AND bvo.store_id = $2
        `;
        priceSelect = 'COALESCE(bvo.price, p.price) AS price, COALESCE(bvo.is_available, p.is_available) AS is_available';
      }

      const [rows] = await database.query(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                pt.code AS product_type_code, pt.name AS product_type_name,
                ${priceSelect}
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN product_type_schemas pts ON pts.id = p.product_type_schema_id
         LEFT JOIN product_types pt ON pt.id = pts.product_type_id
         ${storeJoin}
         WHERE p.slug = $1 AND p.status = 'active'
         LIMIT 1`,
        params,
      );
      if (!rows[0]) return null;

      const product = rows[0];

      // Fetch Schema Attributes if product has schema
      let schemaAttributes = [];
      if (product.product_type_schema_id) {
        const [attrRows] = await database.query(
          `SELECT a.* FROM attribute_definitions a WHERE a.schema_id = $1 ORDER BY a.sort_order ASC, a.name ASC`,
          [product.product_type_schema_id],
        );
        const attrIds = attrRows.map((a) => a.id);
        let valRows = [];
        if (attrIds.length > 0) {
          const [v] = await database.query(
            `SELECT v.* FROM attribute_values v WHERE v.attribute_definition_id = ANY($1::bigint[]) AND v.is_active = TRUE ORDER BY v.sort_order ASC`,
            [attrIds],
          );
          valRows = v;
        }

        schemaAttributes = attrRows.map((a) => ({
          ...a,
          values: valRows.filter((v) => Number(v.attribute_definition_id) === Number(a.id)),
        }));
      }

      // Fetch Variants with Branch Offers if storeId provided
      let vParams = [product.id];
      let vOfferJoin = '';
      let vPriceSelect = 'pv.id, pv.sku, pv.variant_signature, pv.name_suffix';

      if (storeId) {
        vParams.push(Number(storeId));
        vOfferJoin = `
          LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $2
          LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $2
        `;
        vPriceSelect += `, COALESCE(bvo.price, ${product.price}) AS price, bvo.compare_at_price, COALESCE(bvo.is_available, TRUE) AS is_available, (COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0)) AS available_stock`;
      }

      const [variants] = await database.query(
        `SELECT ${vPriceSelect}
         FROM product_variants pv
         ${vOfferJoin}
         WHERE pv.product_id = $1 AND pv.status = 'active'
         ORDER BY pv.id ASC`,
        vParams,
      );

      // Fetch Media
      const [media] = await database.query(
        `SELECT id, image_url, alt_text, sort_order FROM product_media WHERE product_id = $1 ORDER BY sort_order ASC`,
        [product.id],
      );

      return {
        ...product,
        attributes: schemaAttributes,
        variants,
        media,
      };
    },
  };
}
