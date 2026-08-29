import postgresDb from '../../config/db-postgres.js';

export const CATALOG_FULFILLMENT_BACKFILL_RUN_KEY = 'catalog-fulfillment-v1';

export async function runCatalogFulfillmentBackfill({ dryRun = false, database = postgresDb } = {}) {
  const summary = {
    dryRun,
    runKey: CATALOG_FULFILLMENT_BACKFILL_RUN_KEY,
    rootRenamed: false,
    rootId: null,
    aliasCreated: false,
    assignedCategoryAttributesCount: 0,
    categoriesDefaultLaneSet: 0,
    branchCapabilitiesSeeded: 0,
    alreadyApplied: false,
    errors: [],
  };

  const runKey = CATALOG_FULFILLMENT_BACKFILL_RUN_KEY;

  if (dryRun) {
    // 1. Check root category thuc-don vs nuoc-uong
    const [existingNuocUong] = await database.query(
      "SELECT id, name, slug FROM categories WHERE slug = 'nuoc-uong' AND depth = 0 LIMIT 1",
    );
    const [existingThucDon] = await database.query(
      "SELECT id, name, slug FROM categories WHERE slug = 'thuc-don' AND depth = 0 LIMIT 1",
    );

    if (existingThucDon[0]) {
      summary.rootRenamed = true;
      summary.rootId = existingThucDon[0].id;
      summary.aliasCreated = true;
    } else if (existingNuocUong[0]) {
      summary.rootId = existingNuocUong[0].id;
    } else {
      summary.errors.push("Không tìm thấy danh mục gốc 'thuc-don' hoặc 'nuoc-uong'");
    }

    // 2. Count categories that need default_fulfillment_lane
    const [catsNeedingLane] = await database.query(
      "SELECT COUNT(*)::int AS count FROM categories WHERE default_fulfillment_lane IS NULL AND archived_at IS NULL",
    );
    summary.categoriesDefaultLaneSet = catsNeedingLane[0]?.count || 0;

    // 3. Count stores needing capabilities
    const [storesNeedingCaps] = await database.query(
      `SELECT COUNT(*)::int AS count
       FROM stores s
       WHERE NOT EXISTS (
         SELECT 1 FROM branch_fulfillment_capabilities bfc
         WHERE bfc.store_id = s.id
       )`,
    );
    summary.branchCapabilitiesSeeded = (storesNeedingCaps[0]?.count || 0) * 2; // kitchen + packing

    return summary;
  }

  return await database.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [runKey]);

    // Check if already applied
    const [completedRuns] = await tx.query(
      'SELECT 1 FROM catalog_v2_backfill_runs WHERE name = $1 LIMIT 1',
      [runKey],
    );
    if (completedRuns[0]) {
      summary.alreadyApplied = true;
      return summary;
    }

    // 1. Rename 'Thực đơn' ('thuc-don') -> 'Nước uống' ('nuoc-uong') if exists
    const [thucDonRows] = await tx.query(
      "SELECT id FROM categories WHERE slug = 'thuc-don' AND depth = 0 LIMIT 1",
    );
    let rootId = null;

    if (thucDonRows[0]) {
      rootId = thucDonRows[0].id;
      await tx.query(
        "UPDATE categories SET name = 'Nước uống', slug = 'nuoc-uong', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [rootId],
      );
      summary.rootRenamed = true;
      summary.rootId = rootId;

      // Add alias in category_slug_aliases
      await tx.query(
        `INSERT INTO category_slug_aliases (alias_slug, category_id)
         VALUES ('thuc-don', $1)
         ON CONFLICT (alias_slug) DO NOTHING`,
        [rootId],
      );
      summary.aliasCreated = true;
    } else {
      const [nuocUongRows] = await tx.query(
        "SELECT id FROM categories WHERE slug = 'nuoc-uong' AND depth = 0 LIMIT 1",
      );
      if (nuocUongRows[0]) {
        rootId = nuocUongRows[0].id;
        summary.rootId = rootId;
        // Ensure alias exists
        await tx.query(
          `INSERT INTO category_slug_aliases (alias_slug, category_id)
           VALUES ('thuc-don', $1)
           ON CONFLICT (alias_slug) DO NOTHING`,
          [rootId],
        );
        summary.aliasCreated = true;
      }
    }

    // 2. Set default_fulfillment_lane for beverage categories to 'kitchen'
    if (rootId) {
      const [updatedKitchen] = await tx.query(
        `WITH RECURSIVE cat_tree AS (
           SELECT id FROM categories WHERE id = $1
           UNION ALL
           SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
         )
         UPDATE categories
         SET default_fulfillment_lane = 'kitchen'
         WHERE id IN (SELECT id FROM cat_tree)
           AND (default_fulfillment_lane IS NULL OR default_fulfillment_lane = '')
         RETURNING id`,
        [rootId],
      );
      summary.categoriesDefaultLaneSet += updatedKitchen.length;
    }

    // 3. Set default_fulfillment_lane for apparel categories to 'packing'
    const [apparelRootRows] = await tx.query(
      "SELECT id FROM categories WHERE slug = 'quan-ao' AND depth = 0 LIMIT 1",
    );
    if (apparelRootRows[0]) {
      const apparelRootId = apparelRootRows[0].id;
      const [updatedPacking] = await tx.query(
        `WITH RECURSIVE cat_tree AS (
           SELECT id FROM categories WHERE id = $1
           UNION ALL
           SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
         )
         UPDATE categories
         SET default_fulfillment_lane = 'packing'
         WHERE id IN (SELECT id FROM cat_tree)
           AND (default_fulfillment_lane IS NULL OR default_fulfillment_lane = '')
         RETURNING id`,
        [apparelRootId],
      );
      summary.categoriesDefaultLaneSet += updatedPacking.length;
    }

    // 4. Seed branch fulfillment capabilities for all active stores
    const [stores] = await tx.query('SELECT id FROM stores');
    for (const store of stores) {
      const [res1] = await tx.query(
        `INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled)
         VALUES ($1, 'kitchen', TRUE)
         ON CONFLICT (store_id, lane_code) DO NOTHING
         RETURNING id`,
        [store.id],
      );
      const [res2] = await tx.query(
        `INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled)
         VALUES ($1, 'packing', TRUE)
         ON CONFLICT (store_id, lane_code) DO NOTHING
         RETURNING id`,
        [store.id],
      );
      if (res1.length) summary.branchCapabilitiesSeeded += 1;
      if (res2.length) summary.branchCapabilitiesSeeded += 1;
    }

    // 5. Record run marker
    await tx.query(
      `INSERT INTO catalog_v2_backfill_runs (name, products_migrated, categories_migrated)
       VALUES ($1, $2, $3)`,
      [runKey, summary.categoriesDefaultLaneSet, summary.rootRenamed ? 1 : 0],
    );

    return summary;
  });
}
