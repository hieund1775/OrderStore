import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPreordersRepository } from '../repositories/postgres/preorders.js';

describe('Preorder reservation repository', () => {
  it('binds reservation timestamps explicitly as timestamptz during preorder checkout', async () => {
    const calls = [];
    const tx = {
      async query(sql) {
        calls.push(sql);
        if (sql.includes('INSERT INTO preorders')) return { rows: [{ id: 12 }] };
        return { rows: [] };
      },
    };
    const repository = createPreordersRepository({ transaction: async (callback) => callback(tx) });

    await repository.createAwaitingPayment({
      preorderCode: 'PO-TEST', storeId: 1, customerUserId: 2, idempotencyKey: 'reservation-test',
      scheduledStartAt: new Date('2026-09-15T13:00:00.000Z'), scheduledEndAt: new Date('2026-09-15T14:00:00.000Z'),
      responsibleManagerId: 3, tableId: 4,
    });

    const reservationSql = calls.find((sql) => sql.includes('INSERT INTO preorder_table_reservations'));
    assert.match(reservationSql, /\$3::timestamptz\s*-\s*INTERVAL '30 minutes'/i);
    assert.match(reservationSql, /\$3::timestamptz\s*\+\s*INTERVAL '60 minutes'/i);
  });
});
