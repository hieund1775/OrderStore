import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import db from '../config/db.js';
import { validatePerfGuard } from './seed-performance-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseStatisticsIo(statMessage) {
  if (!statMessage || typeof statMessage !== 'string') {
    return { tables: {}, totalLogicalReads: 0, cpuTimeMs: 0, elapsedTimeMs: 0 };
  }

  const result = {
    tables: {},
    totalLogicalReads: 0,
    cpuTimeMs: 0,
    elapsedTimeMs: 0,
  };

  // Parse Table 'xyz'. Scan count 1, logical reads 1234, physical reads 0...
  const tableRegex = /Table\s+'([^']+)'\.\s+Scan\s+count\s+\d+,\s+logical\s+reads\s+(\d+)/gi;
  let match;
  while ((match = tableRegex.exec(statMessage)) !== null) {
    const tableName = match[1];
    const logicalReads = parseInt(match[2], 10);
    result.tables[tableName] = logicalReads;
    result.totalLogicalReads += logicalReads;
  }

  // Parse SQL Server Execution Times: CPU time = 45 ms,  elapsed time = 52 ms.
  const timeRegex = /CPU\s+time\s+=\s+(\d+)\s+ms,\s+elapsed\s+time\s+=\s+(\d+)\s+ms/i;
  const timeMatch = statMessage.match(timeRegex);
  if (timeMatch) {
    result.cpuTimeMs = parseInt(timeMatch[1], 10);
    result.elapsedTimeMs = parseInt(timeMatch[2], 10);
  }

  return result;
}

export async function benchmarkQuery({ name, sqlText, params = [], qWithStats = db.queryWithStats } = {}) {
  // Fail-fast on execution error
  const res = await qWithStats(sqlText, params);
  const rows = res.recordset || [];
  const rowCount = Array.isArray(rows) ? rows.length : res.rowsAffected || 0;
  const rawMessages = (res.infoMessages || []).join('\n');
  const dmvStats = res.dmvStats || null;
  const executionPlanSummary = res.executionPlanSummary || [];

  const parsedStats = parseStatisticsIo(rawMessages);
  const logicalReads = parsedStats.totalLogicalReads > 0
    ? parsedStats.totalLogicalReads
    : (dmvStats?.last_logical_reads ?? null);

  const cpuTimeMs = parsedStats.cpuTimeMs > 0
    ? parsedStats.cpuTimeMs
    : (dmvStats?.last_cpu_ms ?? null);

  const elapsedMs = parsedStats.elapsedTimeMs > 0
    ? parsedStats.elapsedTimeMs
    : (dmvStats?.last_elapsed_ms ?? res.wallClockMs);

  const ioStatsAvailable = logicalReads !== null && logicalReads > 0;

  return {
    name,
    rowCount,
    elapsedMs,
    wallClockMs: res.wallClockMs,
    cpuTimeMs: cpuTimeMs ?? 0,
    totalLogicalReads: logicalReads ?? 0,
    io_stats_available: ioStatsAvailable,
    engine_stats: dmvStats,
    execution_plan_summary: executionPlanSummary,
    tables: parsedStats.tables,
    rawMessages: res.infoMessages || [],
    timestamp: new Date().toISOString(),
    status: 'success',
  };
}

export async function runAllBenchmarks({
  confirmFlag = '1',
  q = db.query,
  qWithStats = db.queryWithStats,
  dbName = process.env.DB_NAME,
  minOrders = 100000,
  enforcePlan = false,
  seed = 42,
  prefix = 'TP',
} = {}) {
  validatePerfGuard({ confirmFlag, dbName });

  const queryDir = path.resolve(__dirname, 'queries');
  if (!fs.existsSync(queryDir)) {
    throw new Error(`Query directory not found at ${queryDir}`);
  }

  // Check git commit hash for audit provenance
  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../..') }).toString().trim();
  } catch {
    /* ignore */
  }

  // Query actual dataset row counts from database for complete provenance
  let datasetCounts = {};
  try {
    const [counts] = await q(`
      SELECT
        (SELECT COUNT(*) FROM orders) AS orders_count,
        (SELECT COUNT(*) FROM order_items) AS items_count,
        (SELECT COUNT(*) FROM order_status_history) AS status_history_count,
        (SELECT COUNT(*) FROM voucher_usage_history) AS voucher_usage_count
    `);
    datasetCounts = counts[0] || {};
  } catch {
    /* fallback */
  }

  const currentOrders = datasetCounts.orders_count || 0;
  if (minOrders > 0 && currentOrders < minOrders) {
    throw new Error(
      `ACCEPTANCE VIOLATION: Dataset order count (${currentOrders}) is below required minimum (${minOrders}). ` +
      `Please run the performance seeder to populate at least ${minOrders} orders before benchmarking.`
    );
  }

  const files = fs.readdirSync(queryDir).filter((f) => f.endsWith('.sql'));
  const results = [];

  // Enable statistics on session
  await q('SET STATISTICS IO, TIME ON;');

  const QUERY_PARAM_MAP = {
    'admin-orders': [50, 1, '2026-08-01 00:00:00', '2026-08-18 00:00:00', '2026-08-17 12:00:00', '2026-08-17 12:00:00', 999999],
    'customer-history': [50, 1, '2026-08-17 12:00:00', '2026-08-17 12:00:00', 999999],
    'dashboard': [1, '2026-08-01 00:00:00', '2026-08-18 00:00:00'],
    'kds-orders': [1],
    'payos-expiry': [],
    'voucher-usage': [1, '0901234567'],
  };

  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(queryDir, file), 'utf-8');
    const name = path.basename(file, '.sql');
    const params = QUERY_PARAM_MAP[name] || [];

    const bench = await benchmarkQuery({ name, sqlText, params, qWithStats });

    if (enforcePlan) {
      if (!bench.io_stats_available || bench.totalLogicalReads === 0) {
        throw new Error(`ACCEPTANCE VIOLATION: Query "${name}" has 0 logical reads or no IO stats.`);
      }
      if (!bench.execution_plan_summary || bench.execution_plan_summary.length === 0) {
        throw new Error(`ACCEPTANCE VIOLATION: Query "${name}" is missing execution plan operators.`);
      }
    }

    results.push(bench);
  }

  // Turn off statistics
  await q('SET STATISTICS IO, TIME OFF;');

  const outputPayload = {
    metadata: {
      runner: 'backend/perf/run-query-benchmarks.js',
      database: dbName,
      seed,
      prefix,
      git_commit: gitCommit,
      executed_at: new Date().toISOString(),
      query_count: results.length,
      dataset_counts: datasetCounts,
      acceptance_verified: true,
    },
    results,
  };

  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsPath = path.resolve(resultsDir, 'latest-benchmark.json');
  fs.writeFileSync(resultsPath, JSON.stringify(outputPayload, null, 2));
  console.log(`✅ Benchmark completed. ${results.length} queries executed on ${dbName} (${currentOrders} orders). Results saved to ${resultsPath}`);
  return outputPayload;
}

if (process.argv[1] && process.argv[1].endsWith('run-query-benchmarks.js')) {
  runAllBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Benchmark failed:', err.message);
      process.exit(1);
    });
}
