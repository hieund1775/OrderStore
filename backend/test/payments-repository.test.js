import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentsRepository } from '../repositories/postgres/payments.js';

function repositoryForWebhook(order) {
  const queries = [];
  const database = {
    transaction: (callback) => callback({
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.includes('INSERT INTO payment_events')) return [[{ id: 77 }], 1];
        if (sql.includes('SELECT id, order_code, total')) return [order ? [order] : [], order ? 1 : 0];
        if (sql.includes('UPDATE orders')) return [[{ id: order.id }], 1];
        return [[], 1];
      },
    }),
  };
  return { repository: createPaymentsRepository(database), queries };
}

describe('PostgreSQL payment repository webhook transaction', () => {
  it('uses payment identity, provider, unpaid status, and amount in the paid CAS', async () => {
    const { repository, queries } = repositoryForWebhook({
      id: 12, order_code: 'TP12', total: 50000, payment_status: 'unpaid', payment_provider: 'payos',
    });
    const result = await repository.processSuccessfulWebhook({
      eventKey: 'evt-12', orderCode: 812, amount: 50000, reference: 'ref-12', paymentLinkId: 'link-12',
    });

    assert.equal(result.kind, 'paid');
    const cas = queries.find(({ sql }) => sql.includes('UPDATE orders'));
    assert.match(cas.sql, /payment_provider = 'payos'/);
    assert.match(cas.sql, /payment_status = 'unpaid'/);
    assert.match(cas.sql, /total = \$3/);
    assert.deepEqual(cas.params, [12, 'ref-12', 50000]);
    const eventResult = queries.at(-1);
    assert.match(eventResult.sql, /processing_status/);
    assert.deepEqual(eventResult.params, [12, 'processed', null, 77]);
  });

  it('records amount mismatches as an ignored payment event without changing the order', async () => {
    const { repository, queries } = repositoryForWebhook({
      id: 13, order_code: 'TP13', total: 50000, payment_status: 'unpaid', payment_provider: 'payos',
    });
    const result = await repository.processSuccessfulWebhook({ eventKey: 'evt-13', orderCode: 813, amount: 40000 });

    assert.equal(result.kind, 'amount_mismatch');
    assert.equal(queries.some(({ sql }) => sql.includes('UPDATE orders')), false);
    const eventResult = queries.at(-1);
    assert.deepEqual(eventResult.params, [13, 'ignored', 'AMOUNT_MISMATCH', 77]);
  });

  it('treats an existing provider event key as an idempotent duplicate', async () => {
    const database = {
      transaction: (callback) => callback({ query: async () => [[], 0] }),
    };
    const result = await createPaymentsRepository(database).processSuccessfulWebhook({ eventKey: 'evt-duplicate', orderCode: 1, amount: 1 });
    assert.deepEqual(result, { kind: 'duplicate' });
  });
});
