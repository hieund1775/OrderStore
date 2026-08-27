import postgresDb from '../../config/db-postgres.js';

export async function runCatalogV2Backfill({ dryRun = false, database = postgresDb } = {}) {
  const summary = {
    dryRun,
    productTypeCreated: false,
    schemaCreated: false,
    categoriesUpdated: 0,
    productsMigrated: 0,
    variantsCreated: 0,
    offersCreated: 0,
  };

  if (dryRun) {
    const [pRows] = await database.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE product_type_schema_id IS NULL',
    );
    summary.productsMigrated = pRows[0]?.count || 0;
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
      `SELECT * FROM products WHERE product_type_schema_id IS NULL`,
    );

    const [activeStores] = await tx.query('SELECT id FROM stores WHERE is_active = TRUE');

    for (const p of productsToMigrate) {
      await tx.query(
        `UPDATE products
         SET product_type_schema_id = $1, fulfillment_lane = 'kitchen', stock_mode = 'made_to_order'
         WHERE id = $2`,
        [schema.id, p.id],
      );
      summary.productsMigrated++;

      // Ensure default variant
      const defaultSku = `SKU-${p.id}-DEF`;
      const [vRows] = await tx.query(
        `INSERT INTO product_variants (product_id, sku, variant_signature, name_suffix, status)
         VALUES ($1, $2, 'default', 'Tiêu chuẩn', 'active')
         ON CONFLICT (product_id, variant_signature) DO UPDATE SET sku = EXCLUDED.sku
         RETURNING id`,
        [p.id, defaultSku],
      );
      const variant = vRows[0];
      summary.variantsCreated++;

      // Ensure branch offers across all active stores
      for (const store of activeStores) {
        await tx.query(
          `INSERT INTO branch_variant_offers (store_id, variant_id, price, is_available, version)
           VALUES ($1, $2, $3, $4, 1)
           ON CONFLICT (store_id, variant_id) DO NOTHING`,
          [store.id, variant.id, p.price || 0, p.is_available ?? true],
        );
        summary.offersCreated++;
      }
    }

    return summary;
  });
}
