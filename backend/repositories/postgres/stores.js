import postgresDb from '../../config/db-postgres.js';

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
  };
}

export const storesRepository = createStoresRepository();
export default storesRepository;
