import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentsRepository } from '../repositories/postgres/payments.js';
import { runPayOSExpiryCommand } from '../commands/expire-payos-orders.js';

describe('PayOS expiry cron command', () => {
  it('uses a transaction advisory lock and a bounded UPDATE ... RETURNING batch', async () => {
    const queries = [];
    const database = {
      transaction: (callback) => callback({
        query: async (sql, params = []) => {
          queries.push({ sql, params });
          if (sql.includes('UPDATE orders o')) return [[{ id: 1, order_code: 'TP1' }], 1];
          return [[], 0];
        },
      }),
    };
    const rows = await createPaymentsRepository(database).expireUnpaidPayOSOrders(5000);

    assert.deepEqual(rows, [{ id: 1, order_code: 'TP1' }]);
    assert.match(queries[0].sql, /pg_advisory_xact_lock/);
    assert.match(queries[1].sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(queries[1].sql, /UPDATE orders o[\s\S]*RETURNING o\.id, o\.order_code/);
    assert.deepEqual(queries[1].params, [1000]);
  });

  it('is one-shot, forwards the batch size, and closes PostgreSQL after success', async () => {
    let receivedBatch = null;
    let closeCount = 0;
    const logs = [];
    const count = await runPayOSExpiryCommand({
      batchSize: 25,
      expire: async (limit) => { receivedBatch = limit; return 3; },
      close: async () => { closeCount += 1; },
      logger: { log: (message) => logs.push(message) },
    });

    assert.equal(count, 3);
    assert.equal(receivedBatch, 25);
    assert.equal(closeCount, 1);
    assert.match(logs[0], /3 order\(s\) expired/);
  });

  it('fails the command while still closing PostgreSQL when expiry fails', async () => {
    let closeCount = 0;
    await assert.rejects(
      () => runPayOSExpiryCommand({
        expire: async () => { throw new Error('query failed'); },
        close: async () => { closeCount += 1; },
        logger: { log() {} },
      }),
      /query failed/,
    );
    assert.equal(closeCount, 1);
  });
});
