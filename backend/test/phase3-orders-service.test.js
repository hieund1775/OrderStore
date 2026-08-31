import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminOrderService } from '../services/orders/admin-order-service.js';
import { createCustomerOrderService, setResolvePaymentProfileForTest } from '../services/orders/customer-order-service.js';

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

describe('Phase 3 customer order service', () => {
  before(() => {
    setResolvePaymentProfileForTest(async ({ items }) => ({
      isGrouped: false,
      profile: { id: 1, code: 'DEFAULT_LONG', version: 1 },
      rootCategory: { rootCategoryId: 1, rootCategoryName: 'Trà Trái Cây Tươi', rootCategorySlug: 'tra-trai-cay-tuoi' },
      rootGroups: [{ rootCategoryId: 1, rootCategoryName: 'Trà Trái Cây Tươi', items }],
    }));
  });

  after(() => {
    setResolvePaymentProfileForTest(null);
  });

  it('preserves legacy array mode and builds cursor DTOs for customer history', async () => {
    const rows = [
      { id: 30, created_at: new Date('2026-08-18T12:00:00Z') },
      { id: 20, created_at: new Date('2026-08-18T11:00:00Z') },
      { id: 10, created_at: new Date('2026-08-18T10:00:00Z') },
    ];
    let batchLoadedCount = 0;
    const service = createCustomerOrderService({
      repository: {
        async listCustomerOrders({ userId, limit, cursor }) {
          assert.equal(userId, 5);
          assert.equal(limit, 2);
          return rows;
        },
      },
      batchLoader: async (orders) => {
        batchLoadedCount = orders.length;
      },
    });

    const paginated = await service.listCustomerHistory({ userId: 5, limit: 2, paginated: true });
    assert.equal(paginated.orders.length, 2);
    assert.equal(paginated.page_info.has_more, true);
    assert.equal(batchLoadedCount, 2);

    const legacy = await service.listCustomerHistory({ userId: 5, limit: 2, paginated: false });
    assert.equal(legacy.length, 2);
  });

  it('rejects online checkout without customer identity', async () => {
    const service = createCustomerOrderService({
      repository: {},
    });

    await assert.rejects(
      () => service.create({
        input: {
          store_id: 1,
          customer_name: 'Khách',
          customer_phone: '0901234567',
          source: 'online',
          items: [{ product_id: 1, qty: 1 }],
        },
        userId: null,
      }),
      (err) => {
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Vui lòng đăng nhập tài khoản trước khi đặt hàng');
        return true;
      },
    );
  });

  it('routes online VietQR checkout to PayOS adapter and attaches status', async () => {
    let payosCalledWith = null;
    const service = createCustomerOrderService({
      repository: {},
      checkPayOSConfigured: () => true,
      createPayOSOrder: async (payload) => {
        payosCalledWith = payload;
        return { id: 101, order_code: 'TP123', total: 45000, checkout_url: 'https://pay.payos.vn/101' };
      },
    });

    const result = await service.create({
      input: {
        store_id: 1,
        customer_name: 'Nguyen Van A',
        customer_phone: '0900000001',
        payment_method: 'VietQR',
        source: 'online',
        items: [{ product_id: 2, qty: 1 }],
      },
      userId: 8,
      idempotencyKey: 'idemp-key-123',
    });

    assert.equal(result.status, 'Đang chuẩn bị');
    assert.equal(result.checkout_url, 'https://pay.payos.vn/101');
    assert.equal(payosCalledWith.userId, 8);
    assert.equal(payosCalledWith.idempotencyKey, 'idemp-key-123');
  });

  it('dispatches POS creation to repository with normalized payment provider', async () => {
    let repoPayload = null;
    const service = createCustomerOrderService({
      repository: {
        async createPublicOrder(payload) {
          repoPayload = payload;
          return { id: 50, order_code: 'TPPOS01', total: 60000 };
        },
      },
      checkPayOSConfigured: () => false,
    });

    const result = await service.create({
      input: {
        store_id: 2,
        customer_name: 'Khách POS',
        customer_phone: '0909999999',
        source: 'pos',
        payment_method: 'VietQR',
        items: [{ product_id: 1, qty: 2 }],
      },
      userId: null,
      idempotencyKey: 'pos-idemp-1',
    });

    assert.equal(result.status, 'Đang chuẩn bị');
    assert.equal(repoPayload.paymentProvider, 'manual_vietqr');
    assert.equal(repoPayload.idempotencyKey, 'pos-idemp-1');
  });

  it('maps public lookup DTO and hides PII for anonymous guests', async () => {
    const service = createCustomerOrderService({
      repository: {
        async findPublicOrder(code) {
          return {
            id: 99,
            order_code: code,
            user_id: 42,
            customer_name: 'Nguyen Van B',
            customer_phone: '0912345678',
            delivery_addr: '123 Nguyen Trai',
            store_name: 'Chi nhánh 1',
            current_status: 'Đang chuẩn bị',
            subtotal: 50000,
            discount_amount: 0,
            total: 50000,
            payment_status: 'unpaid',
            created_at: new Date(),
          };
        },
        async loadPublicDetails(id) {
          return [{ id: 1, product_name: 'Trà đào', qty: 1, unit_price: 50000, line_total: 50000, toppings: [] }];
        },
        async loadStatusHistory(id) {
          return [{ status: 'Đang chuẩn bị', created_at: new Date() }];
        },
      },
    });

    const lookupRes = await service.lookup({ code: 'TP9999', tokenUser: null });
    assert.ok(lookupRes.order);
    assert.equal(lookupRes.order.order_code, 'TP9999');
    // Anonymous lookup masks PII
    assert.ok(lookupRes.order.customer_phone.includes('*'));
  });

  it('forwards cancellation input to repository with transition policy', async () => {
    let cancelCalledWith = null;
    const service = createCustomerOrderService({
      repository: {
        async cancelCustomerOrder(payload) {
          cancelCalledWith = payload;
          return { order_id: 88, order_code: 'TP8888', status: 'Đã hủy' };
        },
      },
    });

    const cancelRes = await service.cancel({
      identifier: 'TP8888',
      userId: 15,
      cancelToken: 'guest-tok',
      reason: 'Đổi ý',
    });

    assert.equal(cancelRes.status, 'Đã hủy');
    assert.equal(cancelRes.message, 'Đã hủy đơn hàng thành công');
    assert.equal(cancelCalledWith.identifier, 'TP8888');
    assert.equal(cancelCalledWith.userId, 15);
    assert.equal(cancelCalledWith.cancelToken, 'guest-tok');
    assert.equal(typeof cancelCalledWith.evaluateTransition, 'function');
  });
});
