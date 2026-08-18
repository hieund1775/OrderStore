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
});
