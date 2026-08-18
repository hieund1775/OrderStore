import postgresDb from '../../config/db-postgres.js';

export class AdminInventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createAdminInventoryRepository(database = postgresDb) {
  return {
    async listInventory({ scopedStoreId } = {}) {
      const params = [];
      let where = 'WHERE TRUE';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND i.store_id = $${params.length}`;
      }
      const [rows] = await database.query(
        `SELECT i.*, s.name AS store_name,
                (i.stock <= i.safe_level) AS is_low_stock
         FROM ingredients i
         JOIN stores s ON s.id = i.store_id
         ${where}
         ORDER BY i.store_id, i.id`,
        params,
      );
      return rows;
    },

    async updateInventory(id, { stock, safe_level, scopedStoreId }) {
      return database.transaction(async (tx) => {
        const [cur] = await tx.query('SELECT * FROM ingredients WHERE id = $1', [id]);
        if (!cur[0]) throw new AdminInventoryError('Không tìm thấy nguyên liệu', 404);
        if (scopedStoreId && Number(cur[0].store_id) !== Number(scopedStoreId)) {
          throw new AdminInventoryError('Không có quyền thao tác nguyên liệu của chi nhánh khác', 403);
        }

        const sets = [];
        const params = [];
        if (stock !== undefined) {
          params.push(Number(stock));
          sets.push(`stock = $${params.length}`);
        }
        if (safe_level !== undefined) {
          params.push(Number(safe_level));
          sets.push(`safe_level = $${params.length}`);
        }
        if (sets.length === 0) return cur[0];
        sets.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const [rows] = await tx.query(
          `UPDATE ingredients SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
          params,
        );
        return rows[0] || null;
      });
    },

    async logInventory(id, { change_amount, reason, reference, created_by, scopedStoreId }) {
      return database.transaction(async (tx) => {
        const [cur] = await tx.query('SELECT * FROM ingredients WHERE id = $1', [id]);
        if (!cur[0]) throw new AdminInventoryError('Không tìm thấy nguyên liệu', 404);
        if (scopedStoreId && Number(cur[0].store_id) !== Number(scopedStoreId)) {
          throw new AdminInventoryError('Không có quyền thao tác nguyên liệu của chi nhánh khác', 403);
        }

        const delta = Number(change_amount) || 0;
        const [updatedRows] = await tx.query(
          `UPDATE ingredients SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING stock`,
          [delta, id],
        );

        const [logRows] = await tx.query(
          `INSERT INTO ingredient_logs (ingredient_id, change_amount, reason, reference, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [id, delta, reason.trim(), reference || null, created_by || null],
        );

        return {
          id: logRows[0].id,
          change_amount: delta,
          new_stock: updatedRows[0].stock,
        };
      });
    },
  };
}

export const adminInventoryRepository = createAdminInventoryRepository();
export default adminInventoryRepository;
