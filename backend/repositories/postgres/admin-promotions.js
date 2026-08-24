import postgresDb from '../../config/db-postgres.js';

export class AdminPromotionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function calculatePromotionStatus(startDate, endDate) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (endDate < today) return 'Đã kết thúc';
  if (startDate > today) return 'Sắp diễn ra';
  return 'Đang diễn ra';
}

export function createAdminPromotionsRepository(database = postgresDb) {
  return {
    async listPromotions({ scopedStoreId } = {}) {
      const params = [];
      let where = 'WHERE p.deleted_at IS NULL';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND (ps.store_id = $${params.length} OR p.scope = 'all')`;
      }
      const [rows] = await database.query(
        `SELECT p.*,
                COALESCE(
                  json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL),
                  '[]'
                ) AS stores
         FROM promotions p
         LEFT JOIN promotion_stores ps ON ps.promotion_id = p.id
         LEFT JOIN stores s ON ps.store_id = s.id
         ${where}
         GROUP BY p.id
         ORDER BY p.id DESC`,
        params,
      );
      return rows;
    },

    async createPromotion({
      title, type, code, description, rule, emoji, discount_value,
      discount_type, max_discount, min_order, start_date, end_date,
      status, audience, scope, voucher_type = 'time_bounded', usage_limit, store_ids = [],
    }) {
      const computedStatus = status || calculatePromotionStatus(start_date, end_date);
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `INSERT INTO promotions (
             title, type, code, description, rule, emoji, discount_value,
             discount_type, max_discount, min_order, start_date, end_date,
             status, audience, scope, voucher_type, usage_limit, is_active
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE)
           RETURNING *`,
          [
            title.trim(),
            type || 'discount',
            code ? code.trim() : null,
            description || null,
            rule || null,
            emoji || null,
            discount_value != null ? Number(discount_value) : null,
            discount_type || null,
            max_discount != null ? Number(max_discount) : null,
            min_order != null ? Number(min_order) : null,
            start_date,
            end_date,
            computedStatus,
            audience || null,
            scope || null,
            voucher_type,
            usage_limit != null ? Number(usage_limit) : null,
          ],
        );
        const promotion = rows[0];

        if (Array.isArray(store_ids) && store_ids.length > 0) {
          for (const sId of store_ids) {
            await tx.query(
              `INSERT INTO promotion_stores (promotion_id, store_id)
               VALUES ($1, $2)
               ON CONFLICT (promotion_id, store_id) DO NOTHING`,
              [promotion.id, sId],
            );
          }
        }

        return promotion;
      });
    },

    async updatePromotion(id, fields) {
      return database.transaction(async (tx) => {
        const sets = [];
        const params = [];
        const allowed = [
          'title', 'type', 'code', 'description', 'rule', 'emoji', 'discount_value',
          'discount_type', 'max_discount', 'min_order', 'start_date', 'end_date',
          'status', 'audience', 'scope', 'voucher_type', 'usage_limit', 'is_active',
        ];

        for (const k of allowed) {
          if (fields[k] !== undefined) {
            params.push(fields[k]);
            sets.push(`${k} = $${params.length}`);
          }
        }

        if (sets.length > 0) {
          params.push(id);
          const [, affected] = await tx.query(
            `UPDATE promotions SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL`,
            params,
          );
          if (!affected) return null;
        }

        if (Array.isArray(fields.store_ids)) {
          await tx.query('DELETE FROM promotion_stores WHERE promotion_id = $1', [id]);
          for (const sId of fields.store_ids) {
            await tx.query(
              `INSERT INTO promotion_stores (promotion_id, store_id)
               VALUES ($1, $2)
               ON CONFLICT (promotion_id, store_id) DO NOTHING`,
              [id, sId],
            );
          }
        }

        const [rows] = await tx.query('SELECT * FROM promotions WHERE id = $1 AND deleted_at IS NULL', [id]);
        return rows[0] || null;
      });
    },

    async deletePromotion(id) {
      const [rows] = await database.query(
        `UPDATE promotions
         SET deleted_at = NOW(), is_active = FALSE
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, code, title`,
        [id],
      );
      return rows.length > 0;
    },
  };
}

export const adminPromotionsRepository = createAdminPromotionsRepository();
export default adminPromotionsRepository;
