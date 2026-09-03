import postgresDb from '../../config/db-postgres.js';

export async function runRootCategoryReparentBackfill({ dryRun = false, database = postgresDb } = {}) {
  const summary = {
    dryRun,
    runKey: 'legacy-root-category-navigation-v1',
    rootCategoryCreated: false,
    rootCategoryId: null,
    categoriesToReparent: 0,
    categoriesReparented: 0,
    alreadyApplied: false,
    errors: [],
  };

  const runKey = 'legacy-root-category-navigation-v1';

  if (dryRun) {
    // 1. Find beverage product type
    const [ptRows] = await database.query(
      "SELECT id FROM product_types WHERE code = 'beverage' LIMIT 1",
    );
    const beverageTypeId = ptRows[0]?.id;
    if (!beverageTypeId) {
      summary.errors.push("Product type 'beverage' does not exist; no categories were reparented");
      return summary;
    }

    // 2. Find depth=0 categories that belong to beverage or need reparenting
    const [categoriesToMove] = await database.query(
      `SELECT c.id, c.name, c.slug, c.depth, c.parent_id
       FROM categories c
       WHERE c.parent_id IS NULL
         AND c.depth = 0
         AND c.slug != 'thuc-don'
         AND c.product_type_id = $1
         AND c.archived_at IS NULL`,
      [beverageTypeId],
    );

    summary.categoriesToReparent = categoriesToMove.length;

    // Check if 'thuc-don' already exists
    const [existingRootRows] = await database.query(
      "SELECT id, depth, parent_id FROM categories WHERE slug = 'thuc-don' LIMIT 1",
    );
    if (existingRootRows[0]) {
      const existing = existingRootRows[0];
      if (existing.parent_id !== null || existing.depth !== 0) {
        summary.errors.push("Slug 'thuc-don' exists but is not a valid root category (depth != 0 or parent_id != null)");
      }
      summary.rootCategoryId = existing.id;
    } else {
      summary.rootCategoryCreated = categoriesToMove.length > 0;
    }

    return summary;
  }

  return await database.transaction(async (tx) => {
    await tx.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [runKey],
    );

    // Check if already applied
    const [completedRuns] = await tx.query(
      'SELECT 1 FROM catalog_v2_backfill_runs WHERE name = $1 LIMIT 1',
      [runKey],
    );
    if (completedRuns[0]) {
      summary.alreadyApplied = true;
      return summary;
    }

    // 1. Find beverage product type
    const [ptRows] = await tx.query(
      "SELECT id FROM product_types WHERE code = 'beverage' LIMIT 1",
    );
    const beverageTypeId = ptRows[0]?.id;
    if (!beverageTypeId) {
      throw new Error("Cannot reparent legacy categories because product type 'beverage' does not exist");
    }

    // 2. Find categories at depth = 0 that need reparenting
    const [categoriesToMove] = await tx.query(
      `SELECT c.id, c.name, c.slug, c.depth, c.parent_id
       FROM categories c
       WHERE c.parent_id IS NULL
         AND c.depth = 0
         AND c.slug != 'thuc-don'
         AND c.product_type_id = $1
         AND c.archived_at IS NULL
       ORDER BY c.sort_order ASC, c.id ASC`,
      [beverageTypeId],
    );

    summary.categoriesToReparent = categoriesToMove.length;

    if (categoriesToMove.length === 0) {
      // Nothing to move, mark complete
      await tx.query(
        `INSERT INTO catalog_v2_backfill_runs (name, summary)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (name) DO NOTHING`,
        [runKey, JSON.stringify(summary)],
      );
      return summary;
    }

    // 3. Find or create root category 'thuc-don'
    let rootCategoryId = null;
    let rootWasCreated = false;

    const [existingRootRows] = await tx.query(
      "SELECT id, depth, parent_id FROM categories WHERE slug = 'thuc-don' LIMIT 1",
    );

    if (existingRootRows[0]) {
      const existing = existingRootRows[0];
      if (existing.parent_id !== null || existing.depth !== 0) {
        throw new Error("Conflict: Slug 'thuc-don' exists but is not a valid root category (depth != 0 or parent_id != null)");
      }
      rootCategoryId = existing.id;
    } else {
      const [newRootRows] = await tx.query(
        `INSERT INTO categories (name, slug, description, depth, parent_id, product_type_id, sort_order, is_visible)
         VALUES ('Thực đơn', 'thuc-don', 'Toàn bộ thực đơn đồ uống và món ăn của quán', 0, NULL, NULL, 1, TRUE)
         RETURNING id`,
      );
      rootCategoryId = newRootRows[0].id;
      rootWasCreated = true;
      summary.rootCategoryCreated = true;
    }

    summary.rootCategoryId = rootCategoryId;

    // 4. Reparent categories and log to audit table
    for (const cat of categoriesToMove) {
      // Insert into audit table
      await tx.query(
        `INSERT INTO catalog_category_reparent_history (
           run_key, root_category_id, category_id, old_parent_id, old_depth, root_was_created
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (run_key, category_id) DO NOTHING`,
        [runKey, rootCategoryId, cat.id, cat.parent_id, cat.depth, rootWasCreated],
      );

      // Move category under root and set depth = 1
      await tx.query(
        `UPDATE categories
         SET parent_id = $1, depth = 1
         WHERE id = $2`,
        [rootCategoryId, cat.id],
      );

      summary.categoriesReparented++;
    }

    // 5. Record completed backfill run
    await tx.query(
      `INSERT INTO catalog_v2_backfill_runs (name, summary)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (name) DO NOTHING`,
      [runKey, JSON.stringify(summary)],
    );

    return summary;
  });
}

export async function runCatalogV2Backfill({ dryRun = false, database = postgresDb } = {}) {
  const summary = {
    dryRun,
    productTypeCreated: false,
    schemaCreated: false,
    categoriesUpdated: 0,
    productsMigrated: 0,
    variantsCreated: 0,
    offersCreated: 0,
    modifierMappingsCreated: 0,
    alreadyApplied: false,
    reparentSummary: null,
  };

  if (dryRun) {
    const [pRows] = await database.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE product_type_schema_id IS NULL',
    );
    summary.productsMigrated = pRows[0]?.count || 0;
    summary.reparentSummary = await runRootCategoryReparentBackfill({ dryRun: true, database });
    return summary;
  }

  const backfillName = 'legacy-beverage-catalog-v2-v1';
  const [completedRuns] = await database.query(
    'SELECT 1 FROM catalog_v2_backfill_runs WHERE name = $1 LIMIT 1',
    [backfillName],
  );
  if (completedRuns[0]) {
    summary.alreadyApplied = true;
    summary.reparentSummary = await runRootCategoryReparentBackfill({ dryRun: false, database });
    return summary;
  }

  return await database.transaction(async (tx) => {
    // 1. Ensure 'beverage' product_type
    let [ptRows] = await tx.query("SELECT * FROM product_types WHERE code = 'beverage' LIMIT 1");
    let beverageType = ptRows[0];

    if (!beverageType) {
      const [newTypeRows] = await tx.query(
        `INSERT INTO product_types (code, name, description, default_stock_mode, default_fulfillment_lane)
         VALUES ('beverage', 'Nước Uống & Trà Pha Chế', 'Thức uống pha chế trực tiếp theo đơn tại quầy bar/bếp', 'made_to_order', 'kitchen')
         RETURNING *`,
      );
      beverageType = newTypeRows[0];
      summary.productTypeCreated = true;
    }

    // 2. Ensure Published Schema v1
    let [sRows] = await tx.query(
      "SELECT * FROM product_type_schemas WHERE product_type_id = $1 AND version = 1 LIMIT 1",
      [beverageType.id],
    );
    let schema = sRows[0];

    if (!schema) {
      const [newSchemaRows] = await tx.query(
        `INSERT INTO product_type_schemas (product_type_id, version, status, published_at)
         VALUES ($1, 1, 'published', CURRENT_TIMESTAMP)
         RETURNING *`,
        [beverageType.id],
      );
      schema = newSchemaRows[0];
      summary.schemaCreated = true;

      // Seed Standard Beverage Modifiers
      // Size
      const [sizeDef] = await tx.query(
        `INSERT INTO attribute_definitions (schema_id, code, name, role, input_type, is_required, sort_order)
         VALUES ($1, 'size', 'Kích cỡ ly', 'modifier', 'single_select', true, 1) RETURNING id`,
        [schema.id],
      );
      await tx.query(
        `INSERT INTO attribute_values (attribute_definition_id, code, label, sort_order, price_adjustment)
         VALUES ($1, 'm', 'Size M (Tiêu chuẩn)', 1, 0), ($1, 'l', 'Size L (Lớn)', 2, 8000)`,
        [sizeDef[0].id],
      );

      // Sugar
      const [sugarDef] = await tx.query(
        `INSERT INTO attribute_definitions (schema_id, code, name, role, input_type, is_required, sort_order)
         VALUES ($1, 'sugar', 'Độ ngọt (Đường)', 'modifier', 'single_select', true, 2) RETURNING id`,
        [schema.id],
      );
      await tx.query(
        `INSERT INTO attribute_values (attribute_definition_id, code, label, sort_order)
         VALUES ($1, '100', '100% Đường', 1), ($1, '70', '70% Đường', 2), ($1, '50', '50% Đường', 3), ($1, '30', '30% Đường', 4), ($1, '0', '0% Đường', 5)`,
        [sugarDef[0].id],
      );

      // Ice
      const [iceDef] = await tx.query(
        `INSERT INTO attribute_definitions (schema_id, code, name, role, input_type, is_required, sort_order)
         VALUES ($1, 'ice', 'Lượng đá', 'modifier', 'single_select', true, 3) RETURNING id`,
        [schema.id],
      );
      await tx.query(
        `INSERT INTO attribute_values (attribute_definition_id, code, label, sort_order)
         VALUES ($1, '100', '100% Đá', 1), ($1, '70', '70% Đá', 2), ($1, '50', '50% Đá', 3), ($1, '30', '30% Đá', 4), ($1, '0', 'Không đá', 5), ($1, 'separate', 'Đá riêng', 6)`,
        [iceDef[0].id],
      );

      // Toppings
      const [toppingDef] = await tx.query(
        `INSERT INTO attribute_definitions (schema_id, code, name, role, input_type, is_required, sort_order)
         VALUES ($1, 'toppings', 'Topping thêm', 'modifier', 'multi_select', false, 4) RETURNING id`,
        [schema.id],
      );
      await tx.query(
        `INSERT INTO attribute_values (attribute_definition_id, code, label, sort_order, price_adjustment)
         VALUES ($1, 'tran-chau-den', 'Trân châu đen dẻo', 1, 5000),
                ($1, 'tran-chau-hoang-kim', 'Trân châu hoàng kim', 2, 7000),
                ($1, 'nha-dam', 'Thạch nha đam tươi', 3, 6000),
                ($1, 'macchiato', 'Kem Macchiato Phô Mai', 4, 12000)`,
        [toppingDef[0].id],
      );
    }

    // 3. Link categories without product_type_id
    const [catUpdate] = await tx.query(
      `UPDATE categories
       SET product_type_id = $1
       WHERE product_type_id IS NULL AND archived_at IS NULL
       RETURNING id`,
      [beverageType.id],
    );
    summary.categoriesUpdated = catUpdate.length;

    // 4. Migrate legacy products
    const [productsToMigrate] = await tx.query(
      `SELECT *
       FROM products
       WHERE product_type_schema_id IS NULL OR product_type_schema_id = $1`,
      [schema.id],
    );

    const [activeStores] = await tx.query('SELECT id FROM stores WHERE is_active = TRUE');
    const [modifierValues] = await tx.query(
      `SELECT a.id AS attribute_definition_id, v.id AS attribute_value_id
       FROM attribute_definitions a
       JOIN attribute_values v ON v.attribute_definition_id = a.id
       WHERE a.schema_id = $1 AND a.role = 'modifier' AND v.is_active = TRUE`,
      [schema.id],
    );

    for (const p of productsToMigrate) {
      if (p.product_type_schema_id == null) {
        await tx.query(
          `UPDATE products
           SET product_type_schema_id = $1, fulfillment_lane = 'kitchen', stock_mode = 'made_to_order'
           WHERE id = $2`,
          [schema.id, p.id],
        );
        summary.productsMigrated++;
      }

      // Ensure default variant
      const defaultSku = `SKU-${p.id}-DEF`;
      const [vRows] = await tx.query(
        `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
         VALUES ($1, $2, 'default', 'Tiêu chuẩn', 'active')
         ON CONFLICT (product_id, variant_signature) DO NOTHING
         RETURNING id`,
        [p.id, defaultSku],
      );
      let variant = vRows[0];
      if (variant) {
        summary.variantsCreated++;
      } else {
        const [existingVariantRows] = await tx.query(
          `SELECT id FROM product_variants
           WHERE product_id = $1 AND variant_signature = 'default'`,
          [p.id],
        );
        variant = existingVariantRows[0];
      }

      for (const modifier of modifierValues) {
        const [mappingRows] = await tx.query(
          `INSERT INTO product_modifier_values (
             product_id, attribute_definition_id, attribute_value_id
           ) VALUES ($1, $2, $3)
           ON CONFLICT (product_id, attribute_definition_id, attribute_value_id) DO NOTHING
           RETURNING id`,
          [p.id, modifier.attribute_definition_id, modifier.attribute_value_id],
        );
        summary.modifierMappingsCreated += mappingRows.length;
      }

      // Ensure branch offers across all active stores
      for (const store of activeStores) {
        const [offerRows] = await tx.query(
          `INSERT INTO branch_variant_offers (store_id, variant_id, price, is_available, version)
           VALUES ($1, $2, $3, $4, 1)
           ON CONFLICT (store_id, variant_id) DO NOTHING
           RETURNING id`,
          [store.id, variant.id, p.price || 0, p.is_available ?? true],
        );
        summary.offersCreated += offerRows.length;
      }
    }

    await tx.query(
      `INSERT INTO catalog_v2_backfill_runs (name, summary)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (name) DO NOTHING`,
      [backfillName, JSON.stringify(summary)],
    );

    // 5. Also run root category reparenting backfill
    summary.reparentSummary = await runRootCategoryReparentBackfill({ dryRun: false, database: { transaction: (cb) => cb(tx), query: (...args) => tx.query(...args) } });

    return summary;
  });
}
