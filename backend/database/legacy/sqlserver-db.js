import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Legacy SQL Server DB adapter preserved strictly for historical migrations/export tools.
// NOT imported or executed by production runtime.

let pool;
let mockAdapter = null;

export function isMockAdapterActive() {
  return Boolean(mockAdapter);
}

export function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `N'${String(v).replace(/'/g, "''")}'`;
}

export function compileQuery(string, params = [], trusted = process.env.DB_TRUSTED === 'true') {
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

export function parseExecutionPlanOperators(xmlPlan) {
  if (!xmlPlan || typeof xmlPlan !== 'string') return [];
  const operators = [];
  const objRegex = /<Object\s+[^>]*Table="\[?([^"\]]+)\]?"(?:\s+Index="\[?([^"\]]+)\]?")?[^>]*>/g;
  let objMatch;
  while ((objMatch = objRegex.exec(xmlPlan)) !== null) {
    const table = objMatch[1];
    const index = objMatch[2] || null;
    const preText = xmlPlan.slice(Math.max(0, objMatch.index - 1000), objMatch.index);
    const relOpMatches = [...preText.matchAll(/PhysicalOp="([^"]+)"/g)];
    const physicalOp = relOpMatches.length > 0 ? relOpMatches[relOpMatches.length - 1][1] : (index ? 'Index Seek' : 'Table Scan');
    operators.push({ operator: physicalOp, table, index });
  }
  const seen = new Set();
  return operators.filter((op) => {
    const key = `${op.operator}|${op.table}|${op.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const legacySqlServerDb = {
  setMockAdapter(adapter) { mockAdapter = adapter; },
  resetMockAdapter() { mockAdapter = null; },
  async close() { if (pool) { await pool.close(); pool = null; } },
  async query(string, params = []) {
    if (mockAdapter?.query) return mockAdapter.query(string, params);
    throw new Error('Legacy SQL Server driver is not enabled in production runtime.');
  },
};

export default legacySqlServerDb;
