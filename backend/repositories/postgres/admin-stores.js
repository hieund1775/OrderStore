import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';

export class AdminStoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function extractTableNumber(name) {
  const match = String(name || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function createAdminStoresRepository(database = postgresDb) {
  return {
    async listBranches({ scopedStoreId } = {}) {
      const params = [];
      let where = 'WHERE TRUE';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND s.id = $${params.length}`;
      }
      const [rows] = await database.query(
        `SELECT s.*,
                COUNT(o.id)::int AS total_orders,
                COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0)::bigint AS revenue
         FROM stores s
         LEFT JOIN orders o ON o.store_id = s.id
         ${where}
         GROUP BY s.id
         ORDER BY s.id`,
        params,
      );
      return rows;
    },

    async createBranch({ name, city, district, address, lat, lng, hours, phone, amenities, is_active = true }) {
      const [rows] = await database.query(
        `INSERT INTO stores (name, city, district, address, lat, lng, hours, phone, amenities, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name.trim(),
          city.trim(),
          district.trim(),
          address.trim(),
          lat != null ? Number(lat) : null,
          lng != null ? Number(lng) : null,
          hours || '07:00 - 22:30',
          phone.trim(),
          amenities || null,
          is_active !== false,
        ],
      );
      return rows[0];
    },

    async updateBranch(id, fields) {
      const sets = [];
      const params = [];
      const allowed = ['name', 'city', 'district', 'address', 'lat', 'lng', 'hours', 'phone', 'amenities', 'is_active'];
      for (const k of allowed) {
        if (fields[k] !== undefined) {
          params.push(fields[k]);
          sets.push(`${k} = $${params.length}`);
        }
      }
      if (sets.length === 0) return null;
      params.push(id);
      const [rows] = await database.query(
        `UPDATE stores SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return rows[0] || null;
    },

    async deleteBranch(id) {
      const [exists] = await database.query('SELECT id, name FROM stores WHERE id = $1', [id]);
      if (!exists[0]) throw new AdminStoreError('Không tìm thấy chi nhánh', 404);
      const [cnt] = await database.query('SELECT COUNT(*)::int AS c FROM orders WHERE store_id = $1', [id]);
      if (Number(cnt[0]?.c) > 0) {
        throw new AdminStoreError(`Không thể xóa chi nhánh "${exists[0].name}" vì đã có ${cnt[0].c} đơn hàng. Hãy dùng chức năng "Tạm ngưng" thay vì xóa.`);
      }
      return database.transaction(async (tx) => {
        await tx.query('DELETE FROM promotion_stores WHERE store_id = $1', [id]);
        await tx.query('DELETE FROM job_stores WHERE store_id = $1', [id]);
        await tx.query('UPDATE job_applications SET store_id = NULL WHERE store_id = $1', [id]);
        await tx.query('UPDATE users SET admin_branch_id = NULL WHERE admin_branch_id = $1', [id]);
        await tx.query('DELETE FROM ingredients WHERE store_id = $1', [id]);
        await tx.query('DELETE FROM tables WHERE store_id = $1', [id]);
        const [, affected] = await tx.query('DELETE FROM stores WHERE id = $1', [id]);
        return affected > 0;
      });
    },

    async listTables({ scopedStoreId } = {}) {
      const params = [];
      let where = 'WHERE TRUE';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND t.store_id = $${params.length}`;
      }
      const [rows] = await database.query(
        `SELECT t.id, t.store_id, s.name AS store_name, t.name, t.qr_code_token, t.is_active
         FROM tables t
         JOIN stores s ON s.id = t.store_id
         ${where}
         ORDER BY t.store_id, t.id`,
        params,
      );
      return rows;
    },

    async createTable({ store_id, name }) {
      if (!name) throw new AdminStoreError('Thiếu name');
      if (!store_id) throw new AdminStoreError('Vui lòng chỉ định store_id');
      const num = extractTableNumber(name);

      return database.transaction(async (tx) => {
        if (num > 0) {
          const [existing] = await tx.query('SELECT name FROM tables WHERE store_id = $1', [store_id]);
          const dup = existing.find((t) => extractTableNumber(t.name) === num);
          if (dup) throw new AdminStoreError('Số bàn này đã tồn tại trong chi nhánh');
        }
        const token = crypto.randomBytes(16).toString('hex');
        const [rows] = await tx.query(
          `INSERT INTO tables (store_id, name, qr_code_token, is_active)
           VALUES ($1, $2, $3, TRUE)
           RETURNING *`,
          [store_id, name.trim(), token],
        );
        return rows[0];
      });
    },

    async updateTable(id, { name, is_active, scopedStoreId }) {
      return database.transaction(async (tx) => {
        const [cur] = await tx.query('SELECT id, store_id, name FROM tables WHERE id = $1', [id]);
        if (!cur[0]) throw new AdminStoreError('Không tìm thấy bàn', 404);
        if (scopedStoreId && Number(cur[0].store_id) !== Number(scopedStoreId)) {
          throw new AdminStoreError('Không có quyền thao tác bàn của chi nhánh khác', 403);
        }

        if (name) {
          const num = extractTableNumber(name);
          if (num > 0) {
            const [existing] = await tx.query('SELECT id, name FROM tables WHERE store_id = $1', [cur[0].store_id]);
            const dup = existing.find((t) => Number(t.id) !== Number(cur[0].id) && extractTableNumber(t.name) === num);
            if (dup) throw new AdminStoreError('Số bàn này đã tồn tại trong chi nhánh');
          }
        }

        const sets = [];
        const params = [];
        if (name !== undefined) {
          params.push(name.trim());
          sets.push(`name = $${params.length}`);
        }
        if (is_active !== undefined) {
          params.push(Boolean(is_active));
          sets.push(`is_active = $${params.length}`);
        }
        if (sets.length === 0) return cur[0];
        params.push(id);
        const [rows] = await tx.query(
          `UPDATE tables SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
          params,
        );
        return rows[0] || null;
      });
    },

    async deleteTable(id, { scopedStoreId } = {}) {
      return database.transaction(async (tx) => {
        const [cur] = await tx.query('SELECT id, store_id FROM tables WHERE id = $1', [id]);
        if (!cur[0]) throw new AdminStoreError('Không tìm thấy bàn', 404);
        if (scopedStoreId && Number(cur[0].store_id) !== Number(scopedStoreId)) {
          throw new AdminStoreError('Không có quyền thao tác bàn của chi nhánh khác', 403);
        }
        const [, affected] = await tx.query('DELETE FROM tables WHERE id = $1', [id]);
        return affected > 0;
      });
    },
  };
}

export const adminStoresRepository = createAdminStoresRepository();
export default adminStoresRepository;
