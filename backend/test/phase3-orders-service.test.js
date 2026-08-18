import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminOrderService } from '../services/orders/admin-order-service.js';

describe('Phase 3 admin order read service', () => {
  it('preserves legacy array mode and builds cursor DTOs from repository rows', async () => {
    const calls = [];
    const rows = [
      { id: 3, created_at: new Date('2026-08-17T12:00:00Z') },
      { id: 2, created_at: new Date('2026-08-17T11:00:00Z') },
      { id: 1, created_at: new Date('2026-08-17T10:00:00Z') },
    ];
    const service = createAdminOrderService({
      async list(input) { calls.push(input); return rows; },
    });

    const legacy = await service.list({ status: 'Đang chuẩn bị', storeId: 2, limit: 50 });
    const paginated = await service.list({ status: 'Đang chuẩn bị', storeId: 2, limit: 2, paginated: true });

    assert.equal(legacy, rows);
    assert.deepEqual(calls[0], {
      status: 'Đang chuẩn bị', scopedStoreId: 2, dateFrom: undefined, dateTo: undefined,
      search: undefined, cursor: undefined, limit: 50,
    });
    assert.deepEqual(paginated.orders.map((order) => order.id), [3, 2]);
    assert.equal(paginated.page_info.has_more, true);
    assert.ok(paginated.page_info.next_cursor);
  });

  it('passes already-resolved scope to detail and KDS reads without Express state', async () => {
    const calls = [];
    const service = createAdminOrderService({
      async detail(input) { calls.push(['detail', input]); return { id: 9, items: [], status_history: [] }; },
      async listKitchen(input) { calls.push(['kitchen', input]); return [{ id: 9, items: [] }]; },
    });

    assert.deepEqual(await service.getDetail({ orderId: 9, storeId: 4 }), { id: 9, items: [], status_history: [] });
    assert.deepEqual(await service.listKitchen({ storeId: 4 }), [{ id: 9, items: [] }]);
    assert.deepEqual(calls, [
      ['detail', { orderId: 9, scopedStoreId: 4 }],
      ['kitchen', { scopedStoreId: 4 }],
    ]);
  });

  it('forwards mutation actor, branch scope, transition policy, and shipping input without HTTP state', async () => {
    const calls = [];
    const service = createAdminOrderService({
      async transition(input) { calls.push(['transition', input]); return { order_id: input.orderId, status: input.targetStatus }; },
      async cancel(input) { calls.push(['cancel', input]); return { order_id: input.orderId, already_cancelled: true }; },
      async confirmPayment(input) { calls.push(['payment', input]); return { alreadyPaid: true }; },
      async markPrinted(input) { calls.push(['print', input]); return true; },
    });
    const actor = { id: 7, role: 'manager' };

    assert.deepEqual(await service.updateStatus({
      orderId: 10, storeId: 3, status: 'Đang giao', note: 'rider assigned', actor,
      driverName: 'A', driverPhone: '0901', trackingUrl: 'https://tracking.test/10',
    }), { order_id: 10, status: 'Đang giao' });
    assert.deepEqual(await service.cancel({ orderId: 10, storeId: 3, reason: 'out of stock', actor }), { order_id: 10, already_cancelled: true });
    assert.deepEqual(await service.confirmPayment({ orderId: 10, storeId: 3, actor }), { alreadyPaid: true });
    assert.equal(await service.markPrinted({ orderId: 10, storeId: 3 }), true);

    assert.deepEqual(calls.map(([name, input]) => [name, input.orderId, input.scopedStoreId, input.actorId, input.actorRole]), [
      ['transition', 10, 3, 7, 'manager'],
      ['cancel', 10, 3, 7, 'manager'],
      ['payment', 10, 3, 7, undefined],
      ['print', 10, 3, undefined, undefined],
    ]);
    assert.equal(typeof calls[0][1].evaluateTransition, 'function');
    assert.equal(typeof calls[1][1].evaluateTransition, 'function');
  });

  it('does not alter concurrent idempotent mutation results from the repository', async () => {
    let calls = 0;
    const service = createAdminOrderService({
      async cancel(input) {
        calls += 1;
        return { order_id: input.orderId, already_cancelled: calls > 1 };
      },
    });
    const actor = { id: 7, role: 'manager' };
    const results = await Promise.all([
      service.cancel({ orderId: 10, storeId: 3, reason: 'duplicate click', actor }),
      service.cancel({ orderId: 10, storeId: 3, reason: 'duplicate click', actor }),
    ]);

    assert.equal(calls, 2);
    assert.deepEqual(results.map((result) => result.already_cancelled).sort(), [false, true]);
  });
});
