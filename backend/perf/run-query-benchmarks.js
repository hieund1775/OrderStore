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

export async function benchmarkQuery({ name, sqlText, params = [] }) {
  const start = performance.now();
  let rows = [];
  let rowCount = 0;

  try {
    const result = await db.query(sqlText, params);
    rows = result[0] || [];
    rowCount = rows.length || result[1] || 0;
  } catch (err) {
    console.error(`Error benchmarking ${name}:`, err.message);
  }

  const elapsedMs = performance.now() - start;

  return {
    name,
    rowCount,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}

export async function runAllBenchmarks() {
  validatePerfGuard({ confirmFlag: '1' });

  const queryDir = path.resolve(__dirname, 'queries');
  const files = fs.readdirSync(queryDir).filter((f) => f.endsWith('.sql'));
  const results = [];

  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(queryDir, file), 'utf-8');
    const name = path.basename(file, '.sql');
    const bench = await benchmarkQuery({ name, sqlText, params: [1, '2026-08-01', '2026-08-18', '2026-08-18', 999999] });
    results.push(bench);
  }

  const resultsPath = path.resolve(__dirname, 'results/latest-benchmark.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`✅ Benchmark completed. Results saved to ${resultsPath}`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('run-query-benchmarks.js')) {
  runAllBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
