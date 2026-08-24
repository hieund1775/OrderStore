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
  if (endDate && endDate < today) return 'Đã kết thúc';
  if (startDate && startDate > today) return 'Sắp diễn ra';
  return 'Đang diễn ra';
}

export function createAdminPromotionsRepository(database = postgresDb) {
  return {
    async listPromotions({ scopedStoreId } = {}) {
      const params = [];
      let where = 'WHERE p.deleted_at IS NULL';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND (
          NOT EXISTS (SELECT 1 FROM promotion_stores ps2 WHERE ps2.promotion_id = p.id)
          OR EXISTS (SELECT 1 FROM promotion_stores ps2 WHERE ps2.promotion_id = p.id AND ps2.store_id = $${params.length})
        )`;
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
      status, audience, scope, voucher_type = 'shared', usage_limit, store_ids = [],
    }) {
      const normalizedVoucherType = voucher_type;
      const finalUsageLimit = normalizedVoucherType === 'single_use' ? null : (usage_limit != null ? Number(usage_limit) : null);
      if (!['single_use', 'shared'].includes(normalizedVoucherType)) {
        throw new AdminPromotionError('Loại voucher phải là single_use hoặc shared');
      }
      if (!start_date) {
        throw new AdminPromotionError('Ngày bắt đầu không được để trống');
      }
      if (end_date != null && String(end_date).slice(0, 10) < String(start_date).slice(0, 10)) {
        throw new AdminPromotionError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
      }
      if (finalUsageLimit != null && (!Number.isInteger(finalUsageLimit) || finalUsageLimit <= 0)) {
        throw new AdminPromotionError('Giới hạn lượt dùng phải là số nguyên dương');
      }
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
            normalizedVoucherType,
            finalUsageLimit,
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
        const [existing] = await tx.query(
          `SELECT id, voucher_type, usage_limit, used_count, start_date, end_date
           FROM promotions
           WHERE id = $1 AND deleted_at IS NULL
           FOR UPDATE`,
          [id],
        );
        if (!existing[0]) return null;

        const current = existing[0];
        const normalizedFields = { ...fields };
        const nextVoucherType = normalizedFields.voucher_type ?? current.voucher_type;
        if (!['single_use', 'shared'].includes(nextVoucherType)) {
          throw new AdminPromotionError('Loại voucher phải là single_use hoặc shared');
        }
        if (nextVoucherType === 'single_use') {
          normalizedFields.usage_limit = null;
        }

        const nextUsageLimit = normalizedFields.usage_limit !== undefined
          ? normalizedFields.usage_limit
          : current.usage_limit;
        if (nextUsageLimit != null) {
          const numericLimit = Number(nextUsageLimit);
          if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
            throw new AdminPromotionError('Giới hạn lượt dùng phải là số nguyên dương');
          }
          if (Number(current.used_count) > numericLimit) {
            throw new AdminPromotionError('Giới hạn lượt dùng không được nhỏ hơn số lượt đã sử dụng');
          }
          normalizedFields.usage_limit = numericLimit;
        }

        const dateKey = (value) => value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value).slice(0, 10);
        const nextStartDate = normalizedFields.start_date ?? current.start_date;
        const nextEndDate = normalizedFields.end_date !== undefined
          ? normalizedFields.end_date
          : current.end_date;
        if (nextEndDate != null && dateKey(nextEndDate) < dateKey(nextStartDate)) {
          throw new AdminPromotionError('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
        }
        if (
          normalizedFields.status === undefined
          && (normalizedFields.start_date !== undefined || normalizedFields.end_date !== undefined)
        ) {
          normalizedFields.status = calculatePromotionStatus(dateKey(nextStartDate), nextEndDate == null ? null : dateKey(nextEndDate));
        }

        const sets = [];
        const params = [];
        const allowed = [
          'title', 'type', 'code', 'description', 'rule', 'emoji', 'discount_value',
          'discount_type', 'max_discount', 'min_order', 'start_date', 'end_date',
          'status', 'audience', 'scope', 'voucher_type', 'usage_limit', 'is_active',
        ];

        for (const k of allowed) {
          if (normalizedFields[k] !== undefined) {
            params.push(normalizedFields[k]);
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

        if (Array.isArray(normalizedFields.store_ids)) {
          await tx.query('DELETE FROM promotion_stores WHERE promotion_id = $1', [id]);
          for (const sId of normalizedFields.store_ids) {
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
