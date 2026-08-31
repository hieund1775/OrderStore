import postgresDb from '../../config/db-postgres.js';

export function createPublicCatalogV2Repository(database = postgresDb) {
  return {
    async getCategoryTree(storeId = null) {
      const params = [];
      let storeFilter = '';
      if (storeId) {
        params.push(Number(storeId));
        storeFilter = `
          AND (
            EXISTS (
              SELECT 1 FROM products p
              JOIN product_variants pv ON pv.product_id = p.id AND pv.status = 'active'
              JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $1
                AND bvo.is_available = TRUE AND bvo.price IS NOT NULL
              LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $1
              WHERE (p.category_id = c.id OR p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))
                AND p.status = 'active' AND p.is_available = TRUE
                AND (
                  p.stock_mode <> 'tracked'
                  OR bvi.on_hand IS NULL
                  OR COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) > 0
                )
            )
          )
        `;
      }
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.sort_order,
                pt.code AS product_type_code, pt.name AS product_type_name
         FROM categories c
         LEFT JOIN product_types pt ON pt.id = c.product_type_id
         WHERE c.is_visible = TRUE AND c.archived_at IS NULL
         ${storeFilter}
         ORDER BY c.depth ASC, c.sort_order ASC, c.name ASC`,
        params,
      );
      return rows;
    },

    async findCategoryBySlug(slug) {
      if (!slug) return null;
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.sort_order, c.is_visible, c.archived_at,
                c.slug AS canonical_slug,
                CASE WHEN c.slug <> $1 THEN TRUE ELSE FALSE END AS is_alias_resolved
         FROM categories c
         LEFT JOIN category_slug_aliases csa ON csa.category_id = c.id
         WHERE (c.slug = $1 OR csa.alias_slug = $1)
           AND c.is_visible = TRUE
           AND c.archived_at IS NULL
         ORDER BY (CASE WHEN c.slug = $1 THEN 0 ELSE 1 END) ASC
         LIMIT 1`,
        [slug],
      );
      return rows[0] || null;
    },

    async getGroupedSections({ storeId, limitPerRoot = 12 } = {}) {
      if (!storeId) return [];

      const normalizedStoreId = Number(storeId);
      const limit = Math.min(Math.max(1, Number(limitPerRoot) || 12), 12);

      const [rows] = await database.query(
        `WITH RECURSIVE category_tree AS (
           SELECT c.id AS category_id, c.id AS root_id
           FROM categories c
           WHERE c.parent_id IS NULL AND c.depth = 0
             AND c.is_visible = TRUE AND c.archived_at IS NULL
           UNION ALL
           SELECT child.id AS category_id, tree.root_id
           FROM categories child
           JOIN category_tree tree ON child.parent_id = tree.category_id
           WHERE child.is_visible = TRUE AND child.archived_at IS NULL
         ),
         roots AS (
           SELECT c.id, c.name, c.slug, c.sort_order
           FROM categories c
           WHERE c.parent_id IS NULL AND c.depth = 0
             AND c.is_visible = TRUE AND c.archived_at IS NULL
         ),
         direct_children AS (
           SELECT c.parent_id AS root_id,
                  JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                      'id', c.id,
                      'name', c.name,
                      'slug', c.slug,
                      'parent_id', c.parent_id,
                      'sort_order', c.sort_order
                    ) ORDER BY c.sort_order ASC, c.id ASC
                  ) AS children
           FROM categories c
           JOIN roots r ON r.id = c.parent_id
           WHERE c.is_visible = TRUE AND c.archived_at IS NULL
           GROUP BY c.parent_id
         ),
         scoped_products AS (
           SELECT p.id, p.name, p.slug, p.description, p.image_url, p.fulfillment_lane, p.stock_mode,
                  p.category_id, c.name AS category_name, c.slug AS category_slug,
                  tree.root_id,
                  COALESCE(branch_offer.price, p.price) AS price,
                  branch_offer.compare_at_price,
                  COALESCE(branch_offer.is_available, p.is_available, TRUE) AS is_available,
                  branch_offer.available_stock,
                  (SELECT COUNT(*)::int
                   FROM product_variants pv
                   WHERE pv.product_id = p.id AND pv.status = 'active') AS variants_count
           FROM category_tree tree
           JOIN products p ON p.category_id = tree.category_id
           JOIN categories c ON c.id = p.category_id
           JOIN LATERAL (
             SELECT MIN(bvo.price) AS price,
                    MIN(bvo.compare_at_price) AS compare_at_price,
                    BOOL_OR(
                      bvo.is_available = TRUE
                      AND (p.stock_mode <> 'tracked' OR COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) > 0)
                    ) AS is_available,
                    MAX(COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0)) AS available_stock
             FROM product_variants pv
             LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $1
             LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $1
             WHERE pv.product_id = p.id
               AND pv.status = 'active'
               AND (
                 p.stock_mode <> 'tracked'
                 OR bvi.on_hand IS NULL
                 OR COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) > 0
               )
           ) branch_offer ON branch_offer.price IS NOT NULL AND branch_offer.is_available = TRUE
           WHERE p.status = 'active' AND p.is_available = TRUE
         ),
         ranked_products AS (
           SELECT scoped_products.*,
                  COUNT(*) OVER (PARTITION BY root_id)::int AS root_total_products,
                  ROW_NUMBER() OVER (PARTITION BY root_id ORDER BY id ASC) AS rank_in_root
           FROM scoped_products
         ),
         product_sections AS (
           SELECT root_id,
                  MAX(root_total_products)::int AS total_products,
                  JSONB_AGG(
                    TO_JSONB(ranked_products)
                      - 'root_id' - 'root_total_products' - 'rank_in_root'
                    ORDER BY rank_in_root ASC
                  ) FILTER (WHERE rank_in_root <= $2) AS products
           FROM ranked_products
           GROUP BY root_id
         )
         SELECT r.id AS root_id,
                r.name AS root_name,
                r.slug AS root_slug,
                COALESCE(ps.total_products, 0)::int AS total_products,
                COALESCE(dc.children, '[]'::jsonb) AS children,
                COALESCE(ps.products, '[]'::jsonb) AS products
         FROM roots r
         LEFT JOIN direct_children dc ON dc.root_id = r.id
         LEFT JOIN product_sections ps ON ps.root_id = r.id
         ORDER BY r.sort_order ASC, r.id ASC`,
        [normalizedStoreId, limit],
      );

      return rows.map((row) => ({
        ...row,
        root_id: Number(row.root_id),
        total_products: Number(row.total_products || 0),
        children: Array.isArray(row.children) ? row.children : [],
        products: Array.isArray(row.products) ? row.products : [],
      }));
    },

    async listProducts({ storeId, categorySlug, categoryId, search, limit = 50, offset = 0 } = {}) {
      const params = [];
      let storeJoin = '';
      let priceSelect = 'p.price AS price, TRUE AS is_available';

      if (storeId) {
        params.push(Number(storeId));
        storeJoin = `
          JOIN LATERAL (
            SELECT MIN(bvo.price) AS price,
                   MIN(bvo.compare_at_price) AS compare_at_price,
                   BOOL_OR(
                     bvo.is_available = TRUE
                     AND (p.stock_mode <> 'tracked' OR COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) > 0)
                   ) AS is_available,
                   MAX(COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0)) AS available_stock
            FROM product_variants pv
            JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $${params.length} AND bvo.is_available = TRUE
            LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $${params.length}
            WHERE pv.product_id = p.id
              AND pv.status = 'active'
              AND (
                p.stock_mode <> 'tracked'
                OR bvi.on_hand IS NULL
                OR COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0) > 0
              )
          ) branch_offer ON branch_offer.price IS NOT NULL AND branch_offer.is_available = TRUE
        `;
        priceSelect = `
          branch_offer.price AS price,
          branch_offer.compare_at_price,
          branch_offer.is_available,
          branch_offer.available_stock
        `;
      }

      let categoryCte = '';
      let categoryJoin = 'JOIN categories c ON c.id = p.category_id';
      let where = "WHERE p.status = 'active' AND p.is_available = TRUE AND c.is_visible = TRUE AND c.archived_at IS NULL";

      if (categoryId) {
        params.push(Number(categoryId));
        categoryCte = `
          WITH RECURSIVE cat_tree AS (
            SELECT id FROM categories WHERE id = $${params.length} AND is_visible = TRUE AND archived_at IS NULL
            UNION ALL
            SELECT child.id FROM categories child
            JOIN cat_tree ct ON child.parent_id = ct.id
            WHERE child.is_visible = TRUE AND child.archived_at IS NULL
          )
        `;
        where += ` AND p.category_id IN (SELECT id FROM cat_tree)`;
      } else if (categorySlug) {
        params.push(categorySlug);
        categoryCte = `
          WITH RECURSIVE cat_tree AS (
            SELECT id FROM categories WHERE slug = $${params.length} AND is_visible = TRUE AND archived_at IS NULL
            UNION ALL
            SELECT child.id FROM categories child
            JOIN cat_tree ct ON child.parent_id = ct.id
            WHERE child.is_visible = TRUE AND child.archived_at IS NULL
          )
        `;
        where += ` AND p.category_id IN (SELECT id FROM cat_tree)`;
      }

      if (search) {
        params.push(`%${search}%`);
        where += ` AND (p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
      }

      params.push(limit);
      const limitParam = `$${params.length}`;
      params.push(offset);
      const offsetParam = `$${params.length}`;

      const countSql = `${categoryCte}
        SELECT COUNT(DISTINCT p.id)::int AS total
        FROM products p
        ${categoryJoin}
        ${storeJoin}
        ${where}`;

      const [countRows] = await database.query(countSql, params.slice(0, params.length - 2));
      const total = countRows[0]?.total || 0;

      const dataSql = `${categoryCte}
        SELECT p.id, p.name, p.slug, p.description, p.image_url, p.fulfillment_lane, p.stock_mode,
               p.category_id, c.name AS category_name, c.slug AS category_slug,
               pt.code AS product_type_code, pt.name AS product_type_name,
               p.product_type_schema_id,
               ${priceSelect},
               (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'active') AS variants_count
        FROM products p
        ${categoryJoin}
        LEFT JOIN product_type_schemas pts ON pts.id = p.product_type_schema_id
        LEFT JOIN product_types pt ON pt.id = pts.product_type_id
        ${storeJoin}
        ${where}
        ORDER BY p.id ASC
        LIMIT ${limitParam} OFFSET ${offsetParam}`;

      const [rows] = await database.query(dataSql, params);
      return { products: rows, total };
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
        priceSelect = 'bvo.price AS price, COALESCE(bvo.is_available, FALSE) AS is_available';
      }

      const [rows] = await database.query(
        `SELECT p.id, p.name, p.slug, p.description, p.image_url, p.fulfillment_lane, p.stock_mode,
                p.category_id, c.name AS category_name, c.slug AS category_slug,
                pt.code AS product_type_code, pt.name AS product_type_name,
                p.product_type_schema_id,
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

      // Fetch Attributes
      if (product.product_type_schema_id) {
        const [attrRows] = await database.query(
          `SELECT a.id, a.code, a.name, a.role, a.input_type, a.is_required, a.min_selections, a.max_selections,
                  v.id AS value_id, v.code AS value_code, v.label AS value_label, v.price_adjustment, v.sort_order AS value_sort_order
           FROM attribute_definitions a
           JOIN attribute_values v ON v.attribute_definition_id = a.id AND v.is_active = TRUE
           WHERE a.schema_id = $1
           ORDER BY a.sort_order ASC, v.sort_order ASC`,
          [product.product_type_schema_id],
        );

        const attrMap = new Map();
        for (const row of attrRows) {
          if (!attrMap.has(row.id)) {
            attrMap.set(row.id, {
              id: row.id,
              code: row.code,
              name: row.name,
              role: row.role,
              input_type: row.input_type,
              is_required: row.is_required,
              min_selections: row.min_selections,
              max_selections: row.max_selections,
              values: [],
            });
          }
          attrMap.get(row.id).values.push({
            id: row.value_id,
            code: row.value_code,
            label: row.value_label,
            price_adjustment: Number(row.price_adjustment || 0),
          });
        }
        product.attributes = Array.from(attrMap.values());
      } else {
        product.attributes = [];
      }

      // Fetch Active Variants & Branch Offers
      let variantOffersJoin = '';
      const variantParams = [product.id];
      if (storeId) {
        variantParams.push(Number(storeId));
        variantOffersJoin = `
          LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $2
          LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $2
        `;
      }

      const [variants] = await database.query(
        `SELECT pv.id, pv.sku, pv.variant_signature, pv.name_suffix, pv.barcode, pv.status,
                ${storeId ? 'bvo.price, bvo.compare_at_price, COALESCE(bvo.is_available, FALSE) AS is_available, (COALESCE(bvi.on_hand, 0) - COALESCE(bvi.reserved, 0)) AS available_stock' : 'NULL AS price, NULL AS compare_at_price, TRUE AS is_available, NULL AS available_stock'}
         FROM product_variants pv
         ${variantOffersJoin}
         WHERE pv.product_id = $1 AND pv.status = 'active'
         ORDER BY pv.id ASC`,
        variantParams,
      );
      product.variants = variants;

      return product;
    },
  };
}

export default createPublicCatalogV2Repository();
