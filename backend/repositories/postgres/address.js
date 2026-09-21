import postgresDb from '../../config/db-postgres.js';

function cleanPrefix(str) {
  if (!str) return '';
  return str.replace(/^(Thành phố|Tỉnh|Quận|Huyện|Thị xã|TP\.?)\s+/i, '').trim();
}

export function createAddressRepository(database = postgresDb) {
  return {
    async searchStreets({ province = '', district = '', query = '', limit = 15 } = {}) {
      const q = (query || '').trim();
      if (!q || q.length < 2) return [];

      const cleanP = cleanPrefix(province);
      const cleanD = cleanPrefix(district);

      const params = [];
      let sql = `
        SELECT DISTINCT street_name
        FROM vietnam_streets
        WHERE 1=1
      `;

      if (cleanP) {
        params.push(`%${cleanP}%`);
        sql += ` AND (province_name ILIKE $${params.length})`;
      }

      if (cleanD) {
        params.push(`%${cleanD}%`);
        sql += ` AND (district_name ILIKE $${params.length})`;
      }

      params.push(`%${q}%`);
      const qParam = `$${params.length}`;
      sql += ` AND street_name ILIKE ${qParam}`;

      // Sort: prioritize streets that start with query string, then alphabetical
      params.push(`${q}%`);
      const startsWithParam = `$${params.length}`;
      sql += `
        ORDER BY
          CASE WHEN street_name ILIKE ${startsWithParam} THEN 0 ELSE 1 END,
          street_name ASC
        LIMIT ${Math.min(Math.max(Number(limit) || 15, 1), 50)}
      `;

      const [rows] = await database.query(sql, params);
      return (rows || []).map((r) => r.street_name);
    },

    async insertStreetsBatch(streets) {
      if (!streets || streets.length === 0) return 0;
      let inserted = 0;
      const CHUNK_SIZE = 500;
      for (let i = 0; i < streets.length; i += CHUNK_SIZE) {
        const chunk = streets.slice(i, i + CHUNK_SIZE);
        const values = [];
        const params = [];
        chunk.forEach((item, idx) => {
          const offset = idx * 3;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
          params.push(item.province_name, item.district_name, item.street_name);
        });

        const sql = `
          INSERT INTO vietnam_streets (province_name, district_name, street_name)
          VALUES ${values.join(', ')}
          ON CONFLICT (province_name, district_name, street_name) DO NOTHING
        `;
        const [, affected] = await database.query(sql, params);
        inserted += affected || 0;
      }
      return inserted;
    },

    async countStreets() {
      const [rows] = await database.query('SELECT COUNT(*)::int AS count FROM vietnam_streets');
      return rows[0]?.count || 0;
    },
  };
}

export const addressRepository = createAddressRepository();
export default addressRepository;
