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

    async findCategoryBySlug(slug) {
      if (!slug) return null;
      const [rows] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.sort_order, c.is_visible, c.archived_at
         FROM categories c
         WHERE c.slug = $1 AND c.is_visible = TRUE AND c.archived_at IS NULL
         LIMIT 1`,
        [slug],
      );
      return rows[0] || null;
    },

    async getGroupedSections({ storeId, limitPerRoot = 12 } = {}) {
      if (!storeId) return [];

      const normalizedStoreId = Number(storeId);
      const limit = Math.min(Math.max(1, Number(limitPerRoot) || 12), 12);

      // 1. Get all visible root categories
      const [roots] = await database.query(
        `SELECT c.id, c.name, c.slug, c.sort_order
         FROM categories c
         WHERE c.parent_id IS NULL AND c.depth = 0
           AND c.is_visible = TRUE AND c.archived_at IS NULL
         ORDER BY c.sort_order ASC, c.id ASC`,
      );

      if (roots.length === 0) return [];

      // 2. Get direct children for each root
      const rootIds = roots.map((r) => Number(r.id));
      const [children] = await database.query(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order
         FROM categories c
         WHERE c.parent_id = ANY($1::bigint[])
           AND c.is_visible = TRUE AND c.archived_at IS NULL
         ORDER BY c.sort_order ASC, c.id ASC`,
        [rootIds],
      );

      const childrenByRootId = new Map();
      for (const child of children) {
        const pId = Number(child.parent_id);
        if (!childrenByRootId.has(pId)) childrenByRootId.set(pId, []);
        childrenByRootId.get(pId).push(child);
      }

      // 3. Query top products and total_products per root using recursive subtree CTE & window functions
      const [productRows] = await database.query(
        `WITH RECURSIVE category_tree AS (
           -- Anchor: Root categories
           SELECT c.id AS category_id, c.id AS root_id
           FROM categories c
           WHERE c.parent_id IS NULL AND c.depth = 0
             AND c.is_visible = TRUE AND c.archived_at IS NULL
           UNION ALL
           -- Recursive: Subcategories
           SELECT c.id AS category_id, ct.root_id
           FROM categories c
           JOIN category_tree ct ON c.parent_id = ct.category_id
           WHERE c.is_visible = TRUE AND c.archived_at IS NULL
         ),
         scoped_products AS (
           SELECT p.id, p.name, p.slug, p.description, p.image_url, p.fulfillment_lane, p.stock_mode,
                  p.category_id, c.name AS category_name, c.slug AS category_slug,
                  ct.root_id,
                  branch_offer.price,
                  branch_offer.compare_at_price,
                  COALESCE(branch_offer.is_available, FALSE) AS is_available,
                  branch_offer.available_stock,
                  (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'active') AS variants_count,
                  COUNT(*) OVER (PARTITION BY ct.root_id) AS root_total_products,
                  ROW_NUMBER() OVER (PARTITION BY ct.root_id ORDER BY p.id ASC) AS rank_in_root
           FROM category_tree ct
           JOIN products p ON p.category_id = ct.category_id
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
             JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $1
             LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $1
             WHERE pv.product_id = p.id AND pv.status = 'active'
           ) branch_offer ON branch_offer.price IS NOT NULL
           WHERE p.status = 'active'
         )
         SELECT * FROM scoped_products
         WHERE rank_in_root <= $2
         ORDER BY root_id ASC, rank_in_root ASC`,
        [normalizedStoreId, limit],
      );

      // Group products by root_id
      const productsByRootId = new Map();
      const totalsByRootId = new Map();

      for (const p of productRows) {
        const rId = Number(p.root_id);
        if (!productsByRootId.has(rId)) productsByRootId.set(rId, []);
        productsByRootId.get(rId).push(p);
        totalsByRootId.set(rId, Number(p.root_total_products || 0));
      }

      // Build output sections
      const sections = [];
      for (const root of roots) {
        const rId = Number(root.id);
        const rootProducts = productsByRootId.get(rId) || [];
        const total = totalsByRootId.get(rId) || 0;

        if (total > 0 || rootProducts.length > 0) {
          sections.push({
            root_id: rId,
            root_name: root.name,
            root_slug: root.slug,
            total_products: total,
            children: childrenByRootId.get(rId) || [],
            products: rootProducts,
          });
        }
      }

      return sections;
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
            JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $${params.length}
            LEFT JOIN branch_variant_inventory bvi ON bvi.variant_id = pv.id AND bvi.store_id = $${params.length}
            WHERE pv.product_id = p.id AND pv.status = 'active'
          ) branch_offer ON branch_offer.price IS NOT NULL
        `;
        priceSelect = `
          branch_offer.price,
          branch_offer.compare_at_price,
          COALESCE(branch_offer.is_available, FALSE) AS is_available,
          branch_offer.available_stock
        `;
      }

      let categoryCte = '';
      let categoryJoin = 'JOIN categories c ON c.id = p.category_id';
      let where = "WHERE p.status = 'active' AND c.is_visible = TRUE AND c.archived_at IS NULL";

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
