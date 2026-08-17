import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import db from '../config/db.js';
import {
  validatePerfGuard,
  generateDeterministicOrders,
  bootstrapPrerequisiteData,
  seedOrdersIntoDatabase,
  cleanupPerformanceDataset,
  VALID_SCHEMA_ORDER_TYPES,
  VALID_SCHEMA_PAYMENT_STATUSES,
  VALID_SCHEMA_PAYMENT_METHODS,
  VALID_SCHEMA_ORDER_STATUSES,
} from '../perf/seed-performance-data.js';
import { parseStatisticsIo, benchmarkQuery } from '../perf/run-query-benchmarks.js';

describe('Performance Benchmark Harness & Guards Suite', () => {
  it('rejects execution when NODE_ENV is production', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'production', dbName: 'teaplus_perf', confirmFlag: '1' }),
      /forbidden in production mode/i
    );
  });

  it('strictly rejects execution on default teaplus_db without exception', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_db', confirmFlag: '1' }),
      /primary application database/i
    );
  });

  it('rejects execution when confirmation flag is missing', () => {
    assert.throws(
      () => validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_perf', confirmFlag: '' }),
      /Missing PERF_SEED_CONFIRM=1 confirmation flag/i
    );
  });

  it('passes guard validation with dedicated perf database ending in _perf or _test', () => {
    const validPerf = validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_perf', confirmFlag: '1' });
    assert.equal(validPerf, true);

    const validTest = validatePerfGuard({ nodeEnv: 'development', dbName: 'teaplus_test', confirmFlag: '1' });
    assert.equal(validTest, true);

    const validCustomTest = validatePerfGuard({
      nodeEnv: 'development',
      dbName: 'store_benchmark_test',
      confirmFlag: '1',
    });
    assert.equal(validCustomTest, true);
  });

  it('verifies generateDeterministicOrders aligns 100% with production schema CHECK constraints', () => {
    const orders = generateDeterministicOrders({ seed: 777, count: 100, days: 30, prefix: 'TP' });
    assert.equal(orders.length, 100);

    for (const order of orders) {
      assert.ok(
        VALID_SCHEMA_ORDER_TYPES.includes(order.order_type),
        `Invalid order_type: ${order.order_type}`
      );
      assert.ok(
        VALID_SCHEMA_PAYMENT_STATUSES.includes(order.payment_status),
        `Invalid payment_status: ${order.payment_status}`
      );
      assert.ok(
        VALID_SCHEMA_PAYMENT_METHODS.includes(order.payment_method),
        `Invalid payment_method: ${order.payment_method}`
      );
      assert.ok(
        VALID_SCHEMA_ORDER_STATUSES.includes(order.initial_status),
        `Invalid initial_status: ${order.initial_status}`
      );
      assert.ok(order.order_code.length <= 20, `Order code too long (${order.order_code.length}): ${order.order_code}`);
      assert.ok(order.total >= 0, 'Total must be non-negative');
      assert.ok(order.items.length >= 1, 'Each order must have at least 1 item');
    }
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

  it('fails fast on query error during benchmarkQuery without swallowing error', async () => {
    const brokenQuery = async () => {
      throw new Error('SQL Server syntax error or connection terminated');
    };

    await assert.rejects(
      async () => {
        await benchmarkQuery({ name: 'test_broken', sqlText: 'SELECT 1', params: [], qWithStats: brokenQuery });
      },
      /SQL Server syntax error/
    );
  });

  it('executes real database smoke seed (20 orders) and asserts relational integrity', async (t) => {
    const isSqlIntegrationEnabled = process.env.PERF_SQL_INTEGRATION === '1';
    const isDedicatedDb = /(_test|_perf)$/i.test(process.env.DB_NAME || '');

    if (!isSqlIntegrationEnabled || !isDedicatedDb) {
      t.skip('Skipping live SQL smoke seed: Requires PERF_SQL_INTEGRATION=1 and dedicated DB ending in _test or _perf');
      return;
    }

    const smokePrefix = 'SMK';

    try {
      // Step 1: Bootstrap prerequisite data & clean previous smoke test records
      await cleanupPerformanceDataset({ prefix: smokePrefix, q: db.query });
      await bootstrapPrerequisiteData(db.query);

      // Step 2: Generate 20 deterministic orders
      const orders = generateDeterministicOrders({ seed: 12345, count: 20, days: 5, prefix: smokePrefix });
      assert.equal(orders.length, 20);

      // Step 3: Insert into SQL Server in transactional batches
      const { insertedOrders } = await seedOrdersIntoDatabase(orders, db.transaction);
      assert.equal(insertedOrders, 20);

      // Step 4: Query back from SQL Server and assert relational counts
      const [orderRows] = await db.query(
        'SELECT id, order_code, total FROM orders WHERE order_code LIKE ?',
        [`${smokePrefix}%`]
      );
      assert.equal(orderRows.length, 20);

      const [statusRows] = await db.query(
        `SELECT osh.id FROM order_status_history osh
         JOIN orders o ON osh.order_id = o.id
         WHERE o.order_code LIKE ?`,
        [`${smokePrefix}%`]
      );
      assert.equal(statusRows.length, 20, 'Each seeded order must have an order_status_history record');

      const [itemRows] = await db.query(
        `SELECT oi.id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.order_code LIKE ?`,
        [`${smokePrefix}%`]
      );
      assert.ok(itemRows.length >= 20, 'Seeded items must exist for all orders');
    } finally {
      // Step 5: Always clean up smoke test dataset in finally block
      try {
        await cleanupPerformanceDataset({ prefix: smokePrefix, q: db.query });
      } catch {
        /* ignore cleanup errors */
      }
    }
  });
});
