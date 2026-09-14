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

  it('returns customer preorder item snapshots separately from ordinary order history', async () => {
    const calls = [];
    const repository = createPreordersRepository({
      async query(sql) {
        calls.push(sql);
        if (sql.includes('FROM preorders p')) {
          return [[{ id: 12, preorder_code: 'PO-CUSTOMER', customer_user_id: 7, store_name: 'Store A' }], 1];
        }
        if (sql.includes('FROM orders o')) {
          return [[{ id: 99, preorder_id: 12, order_code: 'ORDER-1', current_status: 'Chờ xác nhận' }], 1];
        }
        if (sql.includes('FROM order_items')) {
          return [[{ id: 501, order_id: 99, product_name: 'Trà đào', qty: 2, size_label: 'M', unit_price: 30000, line_total: 60000 }], 1];
        }
        if (sql.includes('FROM order_item_toppings')) return [[], 0];
        throw new Error(`Unexpected preorder query: ${sql}`);
      },
    });

    const rows = await repository.listForCustomer(7);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].preorder_code, 'PO-CUSTOMER');
    assert.deepEqual(rows[0].orders.map((order) => order.order_code), ['ORDER-1']);
    assert.deepEqual(rows[0].orders[0].items.map((item) => item.product_name), ['Trà đào']);
    assert.equal(calls.some((sql) => sql.includes('WHERE p.customer_user_id = $1')), true);
    assert.equal(calls.some((sql) => sql.includes("AND p.status NOT IN ('AWAITING_PAYMENT', 'PAYMENT_EXPIRED')")), true);
  });

  it('inserts customer check-in request with slot conflict handling', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const repository = createPreordersRepository({
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [{ id: 88, status: 'PENDING' }] };
      },
    });

    const result = await repository.createOrGetCheckinRequest({
      preorderId: 10,
      storeId: 1,
      customerUserId: 5,
      scheduledStartAt: '2026-09-15T12:00:00.000Z',
      scheduledEndAt: '2026-09-15T13:00:00.000Z',
      requestedAt: '2026-09-15T11:45:00.000Z',
    });

    assert.equal(result.id, 88);
    assert.match(capturedSql, /INSERT INTO preorder_checkin_requests/i);
    assert.match(capturedSql, /ON CONFLICT \(preorder_id, scheduled_start_at\) DO UPDATE/i);
    assert.equal(capturedParams[0], 10);
    assert.equal(capturedParams[1], 1);
    assert.equal(capturedParams[2], 5);
  });

  it('records slot strike event idempotently with ON CONFLICT DO NOTHING', async () => {
    let capturedSql = '';
    const repository = createPreordersRepository({
      async query(sql) {
        capturedSql = sql;
        return { rows: [{ id: 99 }] };
      },
    });

    const result = await repository.recordSlotStrikeOnce({
      preorderId: 10,
      scheduledStartAt: '2026-09-15T12:00:00.000Z',
      managerId: 9,
      strikeSource: 'CHECKIN_BREACH',
    });

    assert.equal(result.id, 99);
    assert.match(capturedSql, /INSERT INTO preorder_slot_strike_events/i);
    assert.match(capturedSql, /ON CONFLICT \(preorder_id, scheduled_start_at\) DO NOTHING/i);
  });
});
