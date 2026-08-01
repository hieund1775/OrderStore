import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const isTrusted = process.env.DB_TRUSTED === 'true';
const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';

const config = {
  server,
  database: process.env.DB_NAME || 'teaplus_db',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    trustedConnection: isTrusted,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

// Nếu dùng SQL Auth (DB_TRUSTED != true), lấy user/pass từ env
if (!isTrusted) {
  config.user = process.env.DB_USER || 'sa';
  config.password = process.env.DB_PASSWORD || '';
}

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log(`✅ SQL Server: ${server}/${config.database}`);
  }
  return pool;
}

const db = {
  async query(string, params = []) {
    const p = await getPool();
    const req = p.request();
    for (let i = 0; i < params.length; i++) {
      req.input(`p${i}`, params[i]);
    }
    let sqlText = string;
    let idx = 0;
    sqlText = sqlText.replace(/\?/g, () => `@p${idx++}`);
    const result = await req.query(sqlText);
    return [result.recordset || [], []];
  },
};

export default db;
