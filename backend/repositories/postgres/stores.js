import postgresDb from '../../config/db-postgres.js';
import { getTableDeterministicToken, hashTableQrToken } from '../../services/table-qr-token.js';

export function createStoresRepository(database = postgresDb) {
  return {
    async listActiveStores({ city, district } = {}) {
      let sql = 'SELECT * FROM stores WHERE is_active = TRUE';
      const params = [];
      if (city) {
        params.push(city);
        sql += ` AND city = $${params.length}`;
      }
      if (district) {
        params.push(district);
        sql += ` AND district = $${params.length}`;
      }
      sql += ' ORDER BY id';
      const [rows] = await database.query(sql, params);
      return rows;
    },

    async listActiveDistricts() {
      const [rows] = await database.query(
        'SELECT DISTINCT city, district FROM stores WHERE is_active = TRUE ORDER BY city, district',
      );
      return rows;
    },

    async resolveTable(tableId) {
      const [rows] = await database.query(
        `SELECT t.id, t.name, t.store_id, s.name AS store_name, s.address AS store_address
         FROM tables t JOIN stores s ON s.id = t.store_id
         WHERE t.id = $1 AND t.is_active = TRUE`,
        [tableId],
      );
      return rows[0] || null;
    },

    async resolveTableByCheckoutToken(tokenHash, { tx = null, forUpdate = false } = {}) {
      const runner = tx || database;
      const [rows] = await runner.query(
        `SELECT t.id, t.name, t.store_id, s.name AS store_name, s.address AS store_address
         FROM tables t
         JOIN stores s ON s.id = t.store_id
         WHERE t.qr_checkout_token_hash = $1
           AND t.is_active = TRUE
           AND s.is_active = TRUE
         ${forUpdate ? 'FOR KEY SHARE OF t, s' : ''}`,
        [tokenHash],
      );
      if (rows && rows.length > 0) return rows[0];

      // Fallback for legacy tables where qr_checkout_token_hash is NULL
      const [candidateRows] = await runner.query(
        `SELECT t.id, t.name, t.store_id, s.name AS store_name, s.address AS store_address
         FROM tables t
         JOIN stores s ON s.id = t.store_id
         WHERE t.qr_checkout_token_hash IS NULL
           AND t.is_active = TRUE
           AND s.is_active = TRUE`,
      );
      for (const row of candidateRows || []) {
        const expectedHash = hashTableQrToken(getTableDeterministicToken(row.id, row.store_id));
        if (expectedHash === tokenHash) {
          await runner.query('UPDATE tables SET qr_checkout_token_hash = $1 WHERE id = $2', [expectedHash, row.id]);
          return row;
        }
      }
      return null;
    },
  };
}

export const storesRepository = createStoresRepository();
export default storesRepository;
