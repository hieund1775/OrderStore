import postgresDb from '../../config/db-postgres.js';

export function createFulfillmentCapabilitiesRepository(database = postgresDb) {
  return {
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

    async upsertCapability({ storeId, laneCode, isEnabled = true, updatedBy = null }) {
      const [rows] = await database.query(
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

    async countActiveOffersByLane(storeId, laneCode) {
      const [rows] = await database.query(
        `SELECT COUNT(*)::int AS count
         FROM branch_variant_offers bvo
         JOIN product_variants pv ON pv.id = bvo.variant_id
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE bvo.store_id = $1
           AND bvo.is_available = TRUE
           AND COALESCE(p.fulfillment_lane, c.default_fulfillment_lane) = $2`,
        [Number(storeId), laneCode],
      );
      return rows[0]?.count || 0;
    },

    async countPendingTasksByLane(storeId, laneCode) {
      const [rows] = await database.query(
        `SELECT COUNT(*)::int AS count
         FROM fulfillment_tasks
         WHERE branch_id = $1
           AND lane = $2
           AND status IN ('pending', 'preparing', 'ready')`,
        [Number(storeId), laneCode],
      );
      return rows[0]?.count || 0;
    },
  };
}
