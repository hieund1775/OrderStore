import dotenv from 'dotenv';
import sqlAuth from 'mssql';
import sqlTrusted from 'mssql/msnodesqlv8.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
let mockAdapter = null;

async function getPool() {
  if (mockAdapter?.getPool) return mockAdapter.getPool();
  if (!pool) {
    pool = await sql.connect(config);
    console.log(`✅ SQL Server: ${server}/${config.database}`);
  }
  return pool;
}

// Escape giá trị inline cho msnodesqlv8 (driver ODBC có bug prepared statement nhiều tham số
// "The variable name '@p1' has already been declared"). Chỉ dùng khi DB_TRUSTED=true.
export function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `N'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Compiles a query with '?' placeholders into driver-specific SQL.
 * - In Trusted mode (ODBC): inlines escaped values safely.
 * - In SQL Auth mode (tedious): transforms '?' to '@p0, @p1...' and prepares inputs.
 */
export function compileQuery(string, params = [], trusted = isTrusted) {
  const paramCount = (string.match(/\?/g) || []).length;
  if (paramCount !== params.length) {
    throw new Error(
      `Parameter count mismatch: Query expects ${paramCount} parameters (?) but received ${params.length}`
    );
  }

  let sqlText = string;
  let idx = 0;
  if (trusted) {
    sqlText = sqlText.replace(/\?/g, () => esc(params[idx++]));
    return { sqlText, inputs: [] };
  } else {
    const inputs = [];
    for (let i = 0; i < params.length; i++) {
      inputs.push({ name: `p${i}`, value: params[i] });
    }
    sqlText = sqlText.replace(/\?/g, () => `@p${idx++}`);
    return { sqlText, inputs };
  }
}

async function run(holder, string, params = []) {
  const req = holder.request();
  const compiled = compileQuery(string, params, isTrusted);
  for (const input of compiled.inputs) {
    req.input(input.name, input.value);
  }
  const result = await req.query(compiled.sqlText);
  return [result.recordset || [], result.rowsAffected?.[0] ?? 0];
}

async function runWithStats(holder, string, params = []) {
  const req = holder.request();
  const queryTag = `BM_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const infoMessages = [];

  req.on('infoMessage', (info) => {
    if (info?.message) {
      infoMessages.push(info.message);
    }
  });

  const compiled = compileQuery(string, params, isTrusted);
  for (const input of compiled.inputs) {
    req.input(input.name, input.value);
  }

  const taggedSql = `/* ${queryTag} */ ${compiled.sqlText}`;
  const start = performance.now();
  const result = await req.query(taggedSql);
  const wallClockMs = Math.round((performance.now() - start) * 100) / 100;

  // Retrieve exact execution engine statistics from SQL Server DMV
  let dmvStats = null;
  try {
    const statsReq = holder.request();
    let dmvResult = await statsReq.query(
      `SELECT TOP 1
         qs.last_logical_reads,
         qs.last_physical_reads,
         qs.last_elapsed_time / 1000 AS last_elapsed_ms,
         qs.last_worker_time / 1000 AS last_cpu_ms,
         qs.last_rows
       FROM sys.dm_exec_query_stats qs
       CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
       WHERE st.text LIKE '%${queryTag}%' AND st.text NOT LIKE '%sys.dm_exec_query_stats%'
       ORDER BY qs.last_execution_time DESC`
    );
    if (dmvResult.recordset && dmvResult.recordset.length > 0) {
      dmvStats = dmvResult.recordset[0];
    } else {
      const tableMatch = compiled.sqlText.match(/FROM\s+(\w+)/i)?.[1];
      if (tableMatch) {
        dmvResult = await statsReq.query(
          `SELECT TOP 1
             qs.last_logical_reads,
             qs.last_physical_reads,
             qs.last_elapsed_time / 1000 AS last_elapsed_ms,
             qs.last_worker_time / 1000 AS last_cpu_ms,
             qs.last_rows
           FROM sys.dm_exec_query_stats qs
           CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
           WHERE st.text LIKE '%${tableMatch}%' AND st.text NOT LIKE '%sys.dm_exec_query_stats%'
           ORDER BY qs.last_execution_time DESC`
        );
        if (dmvResult.recordset && dmvResult.recordset.length > 0) {
          dmvStats = dmvResult.recordset[0];
        }
      }
    }
  } catch {
    /* fallback */
  }

  return {
    recordset: result.recordset || [],
    rowsAffected: result.rowsAffected?.[0] ?? 0,
    infoMessages,
    dmvStats,
    wallClockMs,
  };
}

const db = {
  setMockAdapter(adapter) {
    mockAdapter = adapter;
  },
  resetMockAdapter() {
    mockAdapter = null;
  },
  async getPool() {
    return getPool();
  },
  async query(string, params = []) {
    if (mockAdapter?.query) return mockAdapter.query(string, params);
    return run(await getPool(), string, params);
  },
  async queryWithStats(string, params = []) {
    if (mockAdapter?.queryWithStats) return mockAdapter.queryWithStats(string, params);
    return runWithStats(await getPool(), string, params);
  },
  /**
   * Chạy fn(tx) trong một SQL Server transaction.
   * fn nhận `tx.query(sql, params)` dùng đúng pattern như db.query.
   * Có lỗi -> ROLLBACK, thành công -> COMMIT.
   */
  async transaction(fn) {
    if (mockAdapter?.transaction) return mockAdapter.transaction(fn);
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
