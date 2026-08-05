import dotenv from 'dotenv';
import sqlAuth from 'mssql';
import sqlTrusted from 'mssql/msnodesqlv8.js';
dotenv.config();

// Windows Auth → msnodesqlv8 (ODBC); SQL Auth → mssql (tedious)
const isTrusted = process.env.DB_TRUSTED === 'true';
const sql = isTrusted ? sqlTrusted : sqlAuth;

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

// Escape giá trị inline cho msnodesqlv8 (driver ODBC có bug prepared statement nhiều tham số
// "The variable name '@p1' has already been declared"). Chỉ dùng khi DB_TRUSTED=true.
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `N'${String(v).replace(/'/g, "''")}'`;
}

async function run(holder, string, params = []) {
  const req = holder.request();
  let sqlText = string;
  let idx = 0;
  if (isTrusted) {
    // msnodesqlv8: inline an toàn (escape '' và số) — tránh prepared statement buggy
    sqlText = sqlText.replace(/\?/g, () => esc(params[idx++]));
  } else {
    // tedious: parameterized query chuẩn OWASP
    for (let i = 0; i < params.length; i++) req.input(`p${i}`, params[i]);
    sqlText = sqlText.replace(/\?/g, () => `@p${idx++}`);
  }
  const result = await req.query(sqlText);
  return [result.recordset || [], result.rowsAffected?.[0] ?? 0];
}

const db = {
  async query(string, params = []) {
    return run(await getPool(), string, params);
  },
  /**
   * Chạy fn(tx) trong một SQL Server transaction.
   * fn nhận `tx.query(sql, params)` dùng đúng pattern như db.query.
   * Có lỗi -> ROLLBACK, thành công -> COMMIT.
   */
  async transaction(fn) {
    const p = await getPool();
    const tx = new sql.Transaction(p);
    await tx.begin();
    try {
      const result = await fn({ query: (s, ps = []) => run(tx, s, ps) });
      await tx.commit();
      return result;
    } catch (err) {
      try { await tx.rollback(); } catch { /* transaction đã đóng */ }
      throw err;
    }
  },
};

export default db;
