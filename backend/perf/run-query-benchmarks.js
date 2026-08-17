import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { validatePerfGuard } from './seed-performance-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseStatisticsIo(statString = '') {
  const result = {
    tables: {},
    totalLogicalReads: 0,
    elapsedTimeMs: 0,
    cpuTimeMs: 0,
  };

  const tableRegex = /Table '([^']+)'.*?logical reads (\d+)/g;
  let match;
  while ((match = tableRegex.exec(statString)) !== null) {
    const tableName = match[1];
    const reads = parseInt(match[2], 10);
    result.tables[tableName] = (result.tables[tableName] || 0) + reads;
    result.totalLogicalReads += reads;
  }

  const timeRegex = /CPU time = (\d+) ms.*?elapsed time = (\d+) ms/g;
  while ((match = timeRegex.exec(statString)) !== null) {
    result.cpuTimeMs += parseInt(match[1], 10);
    result.elapsedTimeMs += parseInt(match[2], 10);
  }

  return result;
}

export async function benchmarkQuery({ name, sqlText, params = [], q = db.query }) {
  const start = performance.now();

  // Fail-fast: Do NOT silently swallow errors. Errors must propagate.
  const result = await q(sqlText, params);
  const rows = result[0] || [];
  const rowCount = Array.isArray(rows) ? rows.length : result[1] || 0;

  const elapsedMs = performance.now() - start;

  return {
    name,
    rowCount,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    timestamp: new Date().toISOString(),
    status: 'success',
  };
}

export async function runAllBenchmarks({ confirmFlag = '1', q = db.query } = {}) {
  validatePerfGuard({ confirmFlag });

  const queryDir = path.resolve(__dirname, 'queries');
  if (!fs.existsSync(queryDir)) {
    throw new Error(`Query directory not found at ${queryDir}`);
  }

  const files = fs.readdirSync(queryDir).filter((f) => f.endsWith('.sql'));
  const results = [];

  // Enable statistics if connected to real pool
  try {
    await q('SET STATISTICS IO, TIME ON;');
  } catch {
    /* mock or offline mode */
  }

  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(queryDir, file), 'utf-8');
    const name = path.basename(file, '.sql');

    // Standard benchmark parameter set matching query placeholders
    const params = [1, '2026-08-01', '2026-08-18', '2026-08-18', 999999];
    const placeholderCount = (sqlText.match(/\?/g) || []).length;
    const activeParams = params.slice(0, placeholderCount);

    const bench = await benchmarkQuery({ name, sqlText, params: activeParams, q });
    results.push(bench);
  }

  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsPath = path.resolve(resultsDir, 'latest-benchmark.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`✅ Benchmark completed. ${results.length} queries executed. Results saved to ${resultsPath}`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('run-query-benchmarks.js')) {
  runAllBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Benchmark failed:', err.message);
      process.exit(1);
    });
}
