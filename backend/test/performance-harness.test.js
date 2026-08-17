import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePerfGuard, generateDeterministicOrders } from '../perf/seed-performance-data.js';
import { parseStatisticsIo } from '../perf/run-query-benchmarks.js';

describe('Performance Benchmark Harness & Guards Suite', () => {
  it('rejects execution when NODE_ENV is production', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'production', dbName: 'teaplus_db', confirmFlag: '1' }),
      /forbidden in production mode/i
    );
  });

  it('rejects execution when database is not in allowlist', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'development', dbName: 'prod_customer_data_live', confirmFlag: '1' }),
      /not on the test\/performance allowlist/i
    );
  });

  it('rejects execution when confirmation flag is missing', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_db', confirmFlag: '' }),
      /Missing PERF_SEED_CONFIRM=1 confirmation flag/i
    );
  });

  it('passes guard validation with development environment and allowed database', () => {
    const valid = validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_db', confirmFlag: '1' });
    assert.equal(valid, true);
  });

  it('generates reproducible and deterministic datasets given the same seed', () => {
    const runA = generateDeterministicOrders({ seed: 42, count: 50, days: 30 });
    const runB = generateDeterministicOrders({ seed: 42, count: 50, days: 30 });
    const runDifferent = generateDeterministicOrders({ seed: 99, count: 50, days: 30 });

    assert.equal(runA.length, 50);
    assert.equal(runB.length, 50);

    // Deep equality check between runA and runB with identical seed
    assert.deepEqual(runA, runB);

    // Different seed must produce different order totals/timestamps
    assert.notEqual(runA[0].total, runDifferent[0].total);
    assert.notEqual(runA[0].created_at.getTime(), runDifferent[0].created_at.getTime());
  });

  it('correctly parses SQL Server SET STATISTICS IO and TIME outputs', () => {
    const sampleStat = `
Table 'orders'. Scan count 1, logical reads 12450, physical reads 0.
Table 'order_status_history'. Scan count 2, logical reads 340, physical reads 0.
SQL Server Execution Times:
   CPU time = 45 ms,  elapsed time = 52 ms.
`;

    const parsed = parseStatisticsIo(sampleStat);

    assert.equal(parsed.tables['orders'], 12450);
    assert.equal(parsed.tables['order_status_history'], 340);
    assert.equal(parsed.totalLogicalReads, 12790);
    assert.equal(parsed.cpuTimeMs, 45);
    assert.equal(parsed.elapsedTimeMs, 52);
  });
});
