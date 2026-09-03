import postgresDb from '../../config/db-postgres.js';

export const CATALOG_FULFILLMENT_BACKFILL_RUN_KEY = 'catalog-fulfillment-v2';

const EFFECTIVE_PRODUCT_LANE_SQL = `COALESCE(
  p.fulfillment_lane,
  (
    WITH RECURSIVE ancestors AS (
      SELECT c.id, c.parent_id, c.depth, c.default_fulfillment_lane
      FROM categories c WHERE c.id = p.category_id
      UNION ALL
      SELECT parent.id, parent.parent_id, parent.depth, parent.default_fulfillment_lane
      FROM categories parent
      JOIN ancestors child ON child.parent_id = parent.id
    )
    SELECT default_fulfillment_lane
    FROM ancestors
    WHERE default_fulfillment_lane IS NOT NULL
    ORDER BY depth DESC LIMIT 1
  )
)`;

function emptySummary(dryRun) {
  return {
    dryRun,
    runKey: CATALOG_FULFILLMENT_BACKFILL_RUN_KEY,
    alreadyApplied: false,
    rootRenamed: false,
    rootId: null,
    aliasCreated: false,
    assignedCategoryAttributesCount: 0,
    categoriesDefaultLaneSet: 0,
    branchCapabilitiesSeeded: 0,
    orderItemsSnapshotted: 0,
    tasksCreated: 0,
    taskItemsCreated: 0,
    unresolvedProducts: 0,
    unresolvedOrderItems: 0,
    categoryCycles: 0,
    orphanCategories: 0,
    errors: [],
  };
}

async function inspect(database, summary) {
  const [roots] = await database.query(
    `SELECT id, name, slug
     FROM categories
     WHERE depth = 0 AND parent_id IS NULL AND slug IN ('thuc-don', 'nuoc-uong')
     ORDER BY id`,
  );
  const legacyRoot = roots.find((row) => row.slug === 'thuc-don');
  const canonicalRoot = roots.find((row) => row.slug === 'nuoc-uong');
  if (legacyRoot && canonicalRoot && Number(legacyRoot.id) !== Number(canonicalRoot.id)) {
    summary.errors.push('Tồn tại đồng thời hai root thuc-don và nuoc-uong khác ID');
  }
  const root = canonicalRoot || legacyRoot;
  if (!root) summary.errors.push('Không tìm thấy root thuc-don hoặc nuoc-uong hợp lệ');
  if (root) {
    summary.rootId = Number(root.id);
    summary.rootRenamed = Boolean(legacyRoot && !canonicalRoot);
    summary.aliasCreated = true;

    const [optionRows] = await database.query(
      `SELECT COUNT(*)::int AS count
       FROM attribute_definitions ad
       JOIN product_type_schemas pts ON pts.id = ad.schema_id
       JOIN product_types pt ON pt.id = pts.product_type_id
       WHERE pt.code = 'beverage' AND pts.status = 'published'
         AND NOT EXISTS (
           SELECT 1 FROM category_attribute_assignments caa
           WHERE caa.category_id = $1 AND caa.attribute_definition_id = ad.id
         )`,
      [root.id],
    );
    summary.assignedCategoryAttributesCount = optionRows[0]?.count || 0;
  }

  const [integrityRows] = await database.query(
    `WITH RECURSIVE walk AS (
       SELECT id AS origin_id, id, parent_id, ARRAY[id]::bigint[] AS path, FALSE AS cycle
       FROM categories
       UNION ALL
       SELECT walk.origin_id, parent.id, parent.parent_id,
              walk.path || parent.id, parent.id = ANY(walk.path)
       FROM walk
       JOIN categories parent ON parent.id = walk.parent_id
       WHERE NOT walk.cycle
     )
     SELECT
       (SELECT COUNT(*)::int FROM walk WHERE cycle) AS cycle_count,
       (SELECT COUNT(*)::int
        FROM categories child
        LEFT JOIN categories parent ON parent.id = child.parent_id
        WHERE child.parent_id IS NOT NULL AND parent.id IS NULL) AS orphan_count`,
  );
  summary.categoryCycles = integrityRows[0]?.cycle_count || 0;
  summary.orphanCategories = integrityRows[0]?.orphan_count || 0;
  if (summary.categoryCycles) summary.errors.push(`Phát hiện ${summary.categoryCycles} chu kỳ category`);
  if (summary.orphanCategories) summary.errors.push(`Phát hiện ${summary.orphanCategories} category mồ côi`);

  const [unresolvedProducts] = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM products p
     WHERE p.status = 'active' AND ${EFFECTIVE_PRODUCT_LANE_SQL} IS NULL`,
  );
  summary.unresolvedProducts = unresolvedProducts[0]?.count || 0;
  if (summary.unresolvedProducts) {
    summary.errors.push(`${summary.unresolvedProducts} sản phẩm active chưa resolve được fulfillment lane`);
  }

  const [capabilityRows] = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM (
       SELECT DISTINCT bvo.store_id, ${EFFECTIVE_PRODUCT_LANE_SQL} AS lane_code
       FROM branch_variant_offers bvo
       JOIN product_variants pv ON pv.id = bvo.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN stores s ON s.id = bvo.store_id AND s.is_active = TRUE
       WHERE bvo.is_available = TRUE
     ) required
     WHERE required.lane_code IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM branch_fulfillment_capabilities bfc
         WHERE bfc.store_id = required.store_id
           AND bfc.lane_code = required.lane_code
           AND bfc.is_enabled = TRUE
       )`,
  );
  summary.branchCapabilitiesSeeded = capabilityRows[0]?.count || 0;

  const [orderItemRows] = await database.query(
    `SELECT
       COUNT(*) FILTER (WHERE oi.fulfillment_lane IS NULL AND ${EFFECTIVE_PRODUCT_LANE_SQL} IS NOT NULL)::int AS resolvable,
       COUNT(*) FILTER (WHERE oi.fulfillment_lane IS NULL AND ${EFFECTIVE_PRODUCT_LANE_SQL} IS NULL)::int AS unresolved
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id`,
  );
  summary.orderItemsSnapshotted = orderItemRows[0]?.resolvable || 0;
  summary.unresolvedOrderItems = orderItemRows[0]?.unresolved || 0;
  if (summary.unresolvedOrderItems) {
    summary.errors.push(`${summary.unresolvedOrderItems} order item chưa resolve được fulfillment lane`);
  }

  return summary;
}

export async function runCatalogFulfillmentBackfill({ dryRun = false, database = postgresDb } = {}) {
  const summary = emptySummary(dryRun);
  if (dryRun) return inspect(database, summary);

  return database.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [CATALOG_FULFILLMENT_BACKFILL_RUN_KEY]);
    const [completedRuns] = await tx.query(
      'SELECT 1 FROM catalog_v2_backfill_runs WHERE name = $1 LIMIT 1',
      [CATALOG_FULFILLMENT_BACKFILL_RUN_KEY],
    );
    if (completedRuns[0]) {
      summary.alreadyApplied = true;
      return summary;
    }

    await inspect(tx, summary);
    const structuralErrors = summary.errors.filter((message) =>
      message.includes('root') || message.includes('chu kỳ') || message.includes('mồ côi'));
    if (structuralErrors.length > 0) {
      const err = new Error(`Backfill bị chặn: ${structuralErrors.join('; ')}`);
      err.code = 'CATALOG_FULFILLMENT_BACKFILL_BLOCKED';
      err.summary = summary;
      throw err;
    }

    const [legacyRoots] = await tx.query(
      `SELECT id FROM categories
       WHERE slug = 'thuc-don' AND depth = 0 AND parent_id IS NULL
       FOR UPDATE`,
    );
    let rootId = summary.rootId;
    if (legacyRoots[0]) {
      rootId = Number(legacyRoots[0].id);
      await tx.query(
        `UPDATE categories
         SET name = 'Nước uống', slug = 'nuoc-uong'
         WHERE id = $1`,
        [rootId],
      );
      summary.rootRenamed = true;
    }
    await tx.query(
      `INSERT INTO category_slug_aliases (alias_slug, category_id)
       VALUES ('thuc-don', $1)
       ON CONFLICT (alias_slug) DO UPDATE SET category_id = EXCLUDED.category_id`,
      [rootId],
    );
    summary.aliasCreated = true;
    summary.rootId = rootId;

    const [beverageDefaults] = await tx.query(
      `UPDATE categories
       SET default_fulfillment_lane = 'kitchen'
       WHERE id = $1 AND default_fulfillment_lane IS NULL
       RETURNING id`,
      [rootId],
    );
    summary.categoriesDefaultLaneSet = beverageDefaults.length;
    const [apparelDefaults] = await tx.query(
      `UPDATE categories
       SET default_fulfillment_lane = 'packing'
       WHERE slug = 'quan-ao' AND depth = 0 AND parent_id IS NULL
         AND default_fulfillment_lane IS NULL
       RETURNING id`,
    );
    summary.categoriesDefaultLaneSet += apparelDefaults.length;

    const validationSummary = await inspect(tx, emptySummary(false));
    if (validationSummary.errors.length > 0) {
      const err = new Error(`Backfill bị chặn: ${validationSummary.errors.join('; ')}`);
      err.code = 'CATALOG_FULFILLMENT_BACKFILL_BLOCKED';
      err.summary = validationSummary;
      throw err;
    }
    summary.unresolvedProducts = validationSummary.unresolvedProducts;
    summary.unresolvedOrderItems = validationSummary.unresolvedOrderItems;
    summary.categoryCycles = validationSummary.categoryCycles;
    summary.orphanCategories = validationSummary.orphanCategories;
    summary.errors = [];

    const [assignments] = await tx.query(
      `INSERT INTO category_attribute_assignments (
         category_id, attribute_definition_id, is_enabled, inherit_to_descendants,
         sort_order, is_required, min_selected, max_selected
       )
       SELECT $1, ad.id, TRUE, TRUE, ad.sort_order,
              ad.is_required, ad.min_selections, ad.max_selections
       FROM attribute_definitions ad
       JOIN product_type_schemas pts ON pts.id = ad.schema_id
       JOIN product_types pt ON pt.id = pts.product_type_id
       WHERE pt.code = 'beverage' AND pts.status = 'published'
       ON CONFLICT (category_id, attribute_definition_id) DO NOTHING
       RETURNING id`,
      [rootId],
    );
    summary.assignedCategoryAttributesCount = assignments.length;

    const [capabilities] = await tx.query(
      `INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled)
       SELECT DISTINCT bvo.store_id, ${EFFECTIVE_PRODUCT_LANE_SQL}, TRUE
       FROM branch_variant_offers bvo
       JOIN product_variants pv ON pv.id = bvo.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN stores s ON s.id = bvo.store_id AND s.is_active = TRUE
       WHERE bvo.is_available = TRUE AND ${EFFECTIVE_PRODUCT_LANE_SQL} IS NOT NULL
       ON CONFLICT (store_id, lane_code) DO NOTHING
       RETURNING id`,
    );
    summary.branchCapabilitiesSeeded = capabilities.length;

    const [snapshots] = await tx.query(
      `UPDATE order_items oi
       SET fulfillment_lane = ${EFFECTIVE_PRODUCT_LANE_SQL}
       FROM products p
       WHERE p.id = oi.product_id
         AND oi.fulfillment_lane IS NULL
         AND ${EFFECTIVE_PRODUCT_LANE_SQL} IS NOT NULL
       RETURNING oi.id`,
    );
    summary.orderItemsSnapshotted = snapshots.length;

    const [tasks] = await tx.query(
      `INSERT INTO fulfillment_tasks (order_id, branch_id, lane, status)
       SELECT DISTINCT oi.order_id, o.store_id, oi.fulfillment_lane, 'pending'
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN LATERAL (
         SELECT status FROM order_status_history osh
         WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1
       ) latest ON TRUE
       WHERE oi.fulfillment_lane IS NOT NULL
         AND COALESCE(latest.status, 'Chờ xác nhận') NOT IN ('Hoàn thành', 'Đã hủy')
       ON CONFLICT (order_id, lane) DO NOTHING
       RETURNING id`,
    );
    summary.tasksCreated = tasks.length;

    const [taskItems] = await tx.query(
      `INSERT INTO fulfillment_task_items (
         task_id, order_item_id, product_id, product_name, quantity,
         modifiers_snapshot, item_notes
       )
       SELECT task.id, oi.id, oi.product_id, oi.product_name, oi.qty,
              jsonb_build_object(
                'size', oi.size_label,
                'base', oi.base_tea,
                'sugar', oi.sugar_level,
                'ice', oi.ice_level
              ),
              oi.note
       FROM order_items oi
       JOIN fulfillment_tasks task
         ON task.order_id = oi.order_id AND task.lane = oi.fulfillment_lane
       WHERE oi.fulfillment_lane IS NOT NULL
       ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO NOTHING
       RETURNING id`,
    );
    summary.taskItemsCreated = taskItems.length;

    await tx.query(
      `INSERT INTO catalog_v2_backfill_runs (name, summary)
       VALUES ($1, $2::jsonb)`,
      [CATALOG_FULFILLMENT_BACKFILL_RUN_KEY, JSON.stringify(summary)],
    );
    return summary;
  });
}
