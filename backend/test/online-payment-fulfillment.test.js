import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrdersRepository } from '../repositories/postgres/orders.js';

function makePaidOrderRow(overrides = {}) {
  return {
    id: 71,
    order_code: 'TP2609170071',
    store_id: 3,
    user_id: 19,
    order_type: 'Take-away',
    payment_status: 'paid',
    preorder_id: null,
    current_status: 'Chờ xác nhận',
    ...overrides,
  };
}

describe('Online payment fulfillment activation', () => {
  it('creates kitchen/packing work and enters preparation only after a paid settlement', async () => {
    const queries = [];
    const notifications = [];
    const database = {
      transaction: async (runner) => runner(database),
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.includes('FROM orders o')) return [[makePaidOrderRow()], 1];
        if (sql.includes('FROM order_items oi')) {
          return [[{
            id: 901,
            product_id: 20,
            product_name: 'Trà đào',
            qty: 1,
            fulfillment_lane: 'kitchen',
            size_label: 'M',
            base_tea: '',
            sugar_level: '100%',
            ice_level: '100%',
            note: null,
          }], 1];
        }
        if (sql.includes('INSERT INTO fulfillment_tasks')) {
          return [[{ id: 301, order_id: 71, branch_id: 3, lane: 'kitchen', status: 'pending' }], 1];
        }
        if (sql.includes('INSERT INTO fulfillment_task_items')) return [[], 1];
        if (sql.includes('INSERT INTO order_status_history')) return [[], 1];
        return [[], 0];
      },
    };
    const repo = createOrdersRepository(database, {}, {
      async insertForUser(payload) { notifications.push({ type: 'customer', payload }); },
      async fanOutToOrderAdmins(storeId, payload) { notifications.push({ type: 'admin', storeId, payload }); },
    });

    const result = await repo.activateFulfillmentAfterPayment({ orderId: 71 });

    assert.deepEqual(result, { activatedOrderIds: [71], kind: 'activated' });
    assert.ok(queries.some(({ sql }) => sql.includes('INSERT INTO fulfillment_tasks')));
    const statusInsert = queries.find(({ sql }) => sql.includes('INSERT INTO order_status_history'));
    assert.deepEqual(statusInsert.params, [71]);
    assert.equal(notifications.length, 2);
  });

  it('does nothing for an unpaid online order, even if a settlement bridge is retried incorrectly', async () => {
    let itemQueryCount = 0;
    const database = {
      transaction: async (runner) => runner(database),
      query: async (sql) => {
        if (sql.includes('FROM orders o')) return [[makePaidOrderRow({ payment_status: 'unpaid' })], 1];
        if (sql.includes('FROM order_items oi')) itemQueryCount += 1;
        return [[], 0];
      },
    };
    const repo = createOrdersRepository(database, {}, {
      async insertForUser() { throw new Error('must not notify'); },
      async fanOutToOrderAdmins() { throw new Error('must not notify'); },
    });

    const result = await repo.activateFulfillmentAfterPayment({ orderId: 71 });

    assert.deepEqual(result, { activatedOrderIds: [], kind: 'already_activated' });
    assert.equal(itemQueryCount, 0);
  });
});
