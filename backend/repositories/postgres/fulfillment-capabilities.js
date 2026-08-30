import postgresDb from '../../config/db-postgres.js';

export function createFulfillmentCapabilitiesRepository(database = postgresDb) {
  const repository = {
    async storeExists(storeId, client = database) {
      const [rows] = await client.query('SELECT 1 FROM stores WHERE id = $1', [Number(storeId)]);
      return Boolean(rows[0]);
    },

    async laneExistsAndActive(laneCode, client = database) {
      const [rows] = await client.query(
        'SELECT 1 FROM fulfillment_lane_registry WHERE code = $1 AND is_active = TRUE',
        [laneCode],
      );
      return Boolean(rows[0]);
    },

    async listLanesRegistry() {
      const [rows] = await database.query(
        `SELECT code, display_name, handler_type, is_active, is_system, created_at, updated_at
         FROM fulfillment_lane_registry
         ORDER BY code ASC`,
      );
      return rows;
    },

    async listCapabilities(storeId) {
      const [rows] = await database.query(
        `SELECT flr.code AS lane_code, flr.display_name, flr.handler_type, flr.is_active,
                COALESCE(bfc.is_enabled, FALSE) AS is_enabled,
                bfc.updated_by, bfc.updated_at
         FROM fulfillment_lane_registry flr
         LEFT JOIN branch_fulfillment_capabilities bfc
           ON bfc.lane_code = flr.code AND bfc.store_id = $1
         WHERE flr.is_active = TRUE
         ORDER BY flr.code ASC`,
        [Number(storeId)],
      );
      return rows;
    },

    async getStoreCapabilities(storeId) {
      const [rows] = await database.query(
        `SELECT lane_code
         FROM branch_fulfillment_capabilities
         WHERE store_id = $1 AND is_enabled = TRUE`,
        [Number(storeId)],
      );
      return rows.map((r) => r.lane_code);
    },

    async upsertCapability({ storeId, laneCode, isEnabled = true, updatedBy = null }, client = database) {
      const [rows] = await client.query(
        `INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (store_id, lane_code)
         DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [Number(storeId), laneCode, Boolean(isEnabled), updatedBy ? Number(updatedBy) : null],
      );
      return rows[0];
    },

    async countActiveOffersByLane(storeId, laneCode, client = database) {
      const [rows] = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM branch_variant_offers bvo
         JOIN product_variants pv ON pv.id = bvo.variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE bvo.store_id = $1
           AND bvo.is_available = TRUE
           AND COALESCE(
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
           ) = $2`,
        [Number(storeId), laneCode],
      );
      return rows[0]?.count || 0;
    },

    async countPendingTasksByLane(storeId, laneCode, client = database) {
      const [rows] = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM fulfillment_tasks
         WHERE branch_id = $1
           AND lane = $2
           AND status IN ('pending', 'preparing', 'ready')`,
        [Number(storeId), laneCode],
      );
      return rows[0]?.count || 0;
    },

    async setCapabilitySafely({ storeId, laneCode, isEnabled, updatedBy = null }) {
      return database.transaction(async (tx) => {
        const [stores] = await tx.query('SELECT id FROM stores WHERE id = $1 FOR UPDATE', [Number(storeId)]);
        if (!stores[0]) return { notFound: 'store' };
        if (!await repository.laneExistsAndActive(laneCode, tx)) return { notFound: 'lane' };

        if (!isEnabled) {
          const activeOffers = await repository.countActiveOffersByLane(storeId, laneCode, tx);
          const pendingTasks = await repository.countPendingTasksByLane(storeId, laneCode, tx);
          if (activeOffers > 0 || pendingTasks > 0) {
            return { blocked: true, activeOffers, pendingTasks };
          }
        }

        const capability = await repository.upsertCapability({
          storeId,
          laneCode,
          isEnabled,
          updatedBy,
        }, tx);
        return { capability };
      });
    },
  };

  return repository;
}
