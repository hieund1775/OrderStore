import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createPromotionsRepository, PromotionError } from '../repositories/postgres/promotions.js';
import { createOrdersRepository } from '../repositories/postgres/orders.js';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';
import { OrderDomainError, orderErrorStatus } from '../services/orders/order-errors.js';
import { createOnlinePayOSOrder } from '../services/online-payos-order.js';

describe('Checkout Voucher Stability Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENT_MODE = 'payos';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const basePromotionRow = {
    id: 1,
    title: 'Giảm 20%',
    code: 'SALE20',
    discount_type: 'percent',
    discount_value: 20,
    max_discount: 30000,
    min_order: 50000,
    voucher_type: 'shared',
    usage_limit: 100,
    used_count: 5,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    is_active: true,
    deleted_at: null,
  };

  function createMockDatabase({ promotion = basePromotionRow, usageHistory = [] } = {}) {
    const singleUseRecords = new Set(usageHistory);
    let usedCount = promotion?.used_count || 0;

    return {
      async query(sql, params = []) {
        if (sql.includes('SELECT p.*') && sql.includes('FROM promotions')) {
          if (!promotion || !promotion.is_active || (promotion.end_date && params[2] > promotion.end_date)) {
            return [[], 0];
          }
          return [[{ ...promotion, used_count: usedCount }], 1];
        }
        if (sql.includes('SELECT id FROM stores')) {
          return [[{ id: 1 }], 1];
        }
        if (sql.includes('SELECT p.id, p.name, p.price')) {
          const pid = params[0];
          const price = pid === 2 ? 40000 : 60000;
          return [[{ id: pid, name: `Product ${pid}`, price, category_id: 1, fulfillment_lane: 'kitchen' }], 1];
        }
        return [[], 0];
      },
      async transaction(cb) {
        const tx = {
          async query(sql, params = []) {
            if (sql.includes('SELECT p.*') && sql.includes('FROM promotions')) {
              if (!promotion || !promotion.is_active || (promotion.end_date && params[2] > promotion.end_date)) {
                return [[], 0];
              }
              return [[{ ...promotion, used_count: usedCount }], 1];
            }
            if (sql.includes('SELECT 1 FROM voucher_usage_history')) {
              const [promoId, phone] = params;
              const exists = singleUseRecords.has(`${promoId}:${phone}`);
              return [exists ? [{ id: 1 }] : [], exists ? 1 : 0];
            }
            if (sql.includes('INSERT INTO voucher_usage_history')) {
              const [promoId, phone] = params;
              const key = `${promoId}:${phone}`;
              if (singleUseRecords.has(key)) {
                return [[], 0]; // ON CONFLICT DO NOTHING
              }
              singleUseRecords.add(key);
              return [[{ id: 999 }], 1];
            }
            if (sql.includes('UPDATE promotions SET used_count')) {
              if (promotion.usage_limit != null && usedCount >= promotion.usage_limit) {
                return [[], 0];
              }
              usedCount += 1;
              return [[], 1];
            }
            if (sql.includes('SELECT id FROM stores')) {
              return [[{ id: 1 }], 1];
            }
            if (sql.includes('SELECT p.id, p.name, p.price')) {
              const pid = params[0];
              const price = pid === 2 ? 40000 : 60000;
              return [[{ id: pid, name: `Product ${pid}`, price, category_id: 1, fulfillment_lane: 'kitchen' }], 1];
            }
            if (sql.includes('INSERT INTO orders')) {
              const subtotal = params[18];
              const discount = params[16];
              const total = params[19];
              return [[{
                id: 100,
                order_code: 'TP2609131234',
                subtotal,
                discount_amount: discount,
                total,
                payment_status: params[8],
                payment_provider: params[9],
                root_category_id: 1,
                payment_profile_code: 'DEFAULT_LONG',
              }], 1];
            }
            if (sql.includes('INSERT INTO order_items')) {
              return [[{ id: 10 }], 1];
            }
            if (sql.includes('order_status_history') || sql.includes('fulfillment_tasks')) {
              return [[], 1];
            }
            if (sql.includes('idempotency_keys')) {
              if (sql.includes('SELECT scope')) {
                return [[{ scope: 'online-order:guest:test', request_hash: null, status: 'started', response_body: null }], 1];
              }
              return [[{ id: 1 }], 1];
            }
            return [[], 0];
          },
        };
        return cb(tx);
      },
    };
  }

  it('direct checkout with valid voucher applies discount snapshot and consumes voucher', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    const order = await ordersRepo.createPublicOrder({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [{ product_id: 1, qty: 1 }],
      },
      idempotencyKey: 'test-direct-1',
    });

    assert.equal(order.subtotal, 60000);
    assert.equal(order.discount_amount, 12000);
    assert.equal(order.total, 48000);
  });

  it('normalizes lowercase voucher code to uppercase in direct checkout', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    const order = await ordersRepo.createPublicOrder({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        voucher_code: 'sale20', // lowercase input from customer
        items: [{ product_id: 1, qty: 1 }],
      },
      idempotencyKey: 'test-direct-lowercase',
    });

    assert.equal(order.discount_amount, 12000);
    assert.equal(order.total, 48000);
  });

  it('direct checkout without voucher proceeds unchanged', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    const order = await ordersRepo.createPublicOrder({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        voucher_code: null,
        items: [{ product_id: 1, qty: 1 }],
      },
      idempotencyKey: 'test-direct-no-voucher',
    });

    assert.equal(order.subtotal, 60000);
    assert.equal(order.discount_amount, 0);
    assert.equal(order.total, 60000);
  });

  it('fully voucher-covered checkout settles as promotion and creates no PayOS link', async () => {
    const fullDiscountPromo = { ...basePromotionRow, discount_value: 100, max_discount: null };
    const mockDb = createMockDatabase({ promotion: fullDiscountPromo });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    const order = await ordersRepo.createPublicOrder({
      input: {
        store_id: 1, source: 'online', order_type: 'Take-away', payment_method: 'VietQR',
        customer_name: 'Nguyen Van A', customer_phone: '0901234567', voucher_code: 'SALE20',
        items: [{ product_id: 1, qty: 1 }],
      },
      paymentProvider: 'payos',
      idempotencyKey: 'test-full-discount',
    });

    assert.equal(order.total, 0);
    assert.equal(order.payment_status, 'paid');
    assert.equal(order.payment_provider, 'promotion');

    let payosCalls = 0;
    const result = await createOnlinePayOSOrder({
      input: { return_url: 'https://example.test/return', cancel_url: 'https://example.test/cancel' },
      userId: 1,
      idempotencyKey: 'test-full-discount-online',
      ordersRepository: { async createPublicOrder() { return order; } },
      directPayOSAttempts: { async createForOrder() { payosCalls += 1; } },
    });
    assert.equal(result.payment_required, false);
    assert.equal(payosCalls, 0);
  });

  it('holds every non-zero VietQR order out of fulfillment until provider settlement', async () => {
    let createInput = null;
    const order = {
      id: 45,
      order_code: 'TP2609170045',
      total: 45000,
      payment_status: 'unpaid',
      payment_provider: 'sandbox',
    };

    await createOnlinePayOSOrder({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'VietQR',
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        items: [{ product_id: 1, qty: 1 }],
      },
      userId: 1,
      idempotencyKey: 'test-online-deferred-fulfillment',
      ordersRepository: {
        async createPublicOrder({ input }) {
          createInput = input;
          return order;
        },
      },
      directPayOSAttempts: {
        async createForOrder() {
          return { payment_provider: 'sandbox', payment_checkout_url: '/thanh-toan/sandbox?token=test' };
        },
      },
    });

    assert.equal(createInput.defer_fulfillment, true);
  });

  it('checkout-time expired voucher fails with 400 PROMOTION_NOT_FOUND rather than 500', async () => {
    const expiredPromo = { ...basePromotionRow, end_date: '2026-01-01' };
    const mockDb = createMockDatabase({ promotion: expiredPromo });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    await assert.rejects(
      async () => {
        await ordersRepo.createPublicOrder({
          input: {
            store_id: 1,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'COD',
            customer_name: 'Nguyen Van A',
            customer_phone: '0901234567',
            voucher_code: 'SALE20',
            items: [{ product_id: 1, qty: 1 }],
          },
          idempotencyKey: 'test-expired',
        });
      },
      (err) => {
        assert.ok(err instanceof OrderDomainError);
        assert.ok(err instanceof PromotionError);
        assert.equal(orderErrorStatus(err), 400);
        assert.equal(err.code, 'PROMOTION_NOT_FOUND');
        assert.match(err.message, /không tồn tại, đã hết hạn/);
        return true;
      },
    );
  });

  it('checkout-time min-order not met fails with 400 PROMOTION_MIN_ORDER_NOT_MET', async () => {
    const highMinPromo = { ...basePromotionRow, min_order: 200000 };
    const mockDb = createMockDatabase({ promotion: highMinPromo });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    await assert.rejects(
      async () => {
        await ordersRepo.createPublicOrder({
          input: {
            store_id: 1,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'COD',
            customer_name: 'Nguyen Van A',
            customer_phone: '0901234567',
            voucher_code: 'SALE20',
            items: [{ product_id: 1, qty: 1 }],
          },
          idempotencyKey: 'test-min-order',
        });
      },
      (err) => {
        assert.ok(err instanceof PromotionError);
        assert.equal(orderErrorStatus(err), 400);
        assert.equal(err.code, 'PROMOTION_MIN_ORDER_NOT_MET');
        assert.match(err.message, /chưa đạt giá trị tối thiểu/);
        return true;
      },
    );
  });

  it('single-use voucher already used for phone fails with 400 PROMOTION_SINGLE_USE_EXHAUSTED', async () => {
    const singleUsePromo = { ...basePromotionRow, voucher_type: 'single_use' };
    const mockDb = createMockDatabase({
      promotion: singleUsePromo,
      usageHistory: ['1:0901234567'],
    });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb, promoRepo, {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    }, { clock: () => new Date('2026-09-13T12:00:00Z') });

    await assert.rejects(
      async () => {
        await ordersRepo.createPublicOrder({
          input: {
            store_id: 1,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'COD',
            customer_name: 'Nguyen Van A',
            customer_phone: '0901234567',
            voucher_code: 'SALE20',
            items: [{ product_id: 1, qty: 1 }],
          },
          idempotencyKey: 'test-single-use-exhausted',
        });
      },
      (err) => {
        assert.ok(err instanceof PromotionError);
        assert.equal(orderErrorStatus(err), 400);
        assert.equal(err.code, 'PROMOTION_SINGLE_USE_EXHAUSTED');
        assert.match(err.message, /đã được sử dụng cho số điện thoại/);
        return true;
      },
    );
  });

  it('preorder channel rejection preserves clean UTF-8 error message without mojibake', async () => {
    const mockDb = createMockDatabase({ promotion: { ...basePromotionRow, applies_to_preorder: false } });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });

    await assert.rejects(
      async () => {
        await promoRepo.preview({
          code: 'SALE20',
          subtotal: 60000,
          phone: '0901234567',
          storeId: 1,
          checkoutChannel: 'preorder',
        });
      },
      (err) => {
        assert.ok(err instanceof PromotionError);
        assert.equal(err.code, 'PROMOTION_PREORDER_NOT_APPLICABLE');
        assert.equal(err.message, 'Mã giảm giá này không áp dụng cho đơn đặt trước');
        assert.ok(!err.message.includes('Ã'));
        return true;
      },
    );
  });

  it('grouped checkout with eligible voucher allocates pro-rata and consumes once', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    let consumeCalls = 0;
    const trackingPromoRepo = {
      ...promoRepo,
      async consumeForOrder(args) {
        consumeCalls += 1;
        return promoRepo.consumeForOrder(args);
      },
    };

    let createdChildOrderCount = 0;
    const mockOrdersRepo = {
      async createPublicOrder({ input }) {
        createdChildOrderCount += 1;
        const subtotal = input.items.reduce((s, it) => s + (it.price || 50000) * (it.qty || 1), 0);
        const discount = Number(input.allocatedDiscount || 0);
        return {
          id: 100 + createdChildOrderCount,
          order_code: `TP-CHILD-${createdChildOrderCount}`,
          subtotal,
          discount_amount: discount,
          total: subtotal - discount,
          status: 'Đang chuẩn bị',
          payment_status: 'unpaid',
        };
      },
    };

    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(data) {
        return {
          id: 50,
          group_code: 'GRP-TEST-VOUCHER',
          ...data,
        };
      },
    };

    const service = createCustomerOrderService({
      repository: mockOrdersRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      promotionsRepo: trackingPromoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({
        isGrouped: true,
        profile: { id: 99, code: 'GROUP_CHECKOUT', status: 'active' },
        rootGroups: [
          {
            rootCategoryId: 1,
            rootCategoryName: 'Trà Trái Cây',
            paymentProfile: { id: 1, code: 'PROFILE_A' },
            items: [{ product_id: 1, price: 60000, qty: 1 }],
          },
          {
            rootCategoryId: 2,
            rootCategoryName: 'Cà Phê',
            paymentProfile: { id: 2, code: 'PROFILE_B' },
            items: [{ product_id: 2, price: 40000, qty: 1 }],
          },
        ],
      }),
      checkPayOSConfigured: () => false,
    });

    const result = await service.create({
      userId: 1,
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Group Customer',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [
          { product_id: 1, price: 60000, qty: 1 },
          { product_id: 2, price: 40000, qty: 1 },
        ],
      },
      idempotencyKey: 'test-group-voucher',
    });

    assert.equal(result.is_grouped, true);
    assert.equal(result.payment_summary.subtotal, 100000);
    // 20% of 100000 = 20000
    assert.equal(result.payment_summary.discount_amount, 20000);
    assert.equal(result.payment_summary.total_amount, 80000);
    assert.equal(consumeCalls, 1, 'Voucher must be consumed exactly once for grouped checkout');

    // Allocation pro-rata check:
    // Group 1: 60000 / 100000 * 20000 = 12000
    // Group 2: 40000 / 100000 * 20000 = 8000
    const ind1 = result.payment_summary.industries.find((i) => i.root_category_id === '1');
    const ind2 = result.payment_summary.industries.find((i) => i.root_category_id === '2');
    assert.equal(ind1.discount_amount, 12000);
    assert.equal(ind1.total_amount, 48000);
    assert.equal(ind2.discount_amount, 8000);
    assert.equal(ind2.total_amount, 32000);
  });

  it('fully voucher-covered grouped checkout is paid by promotion without a group PayOS attempt', async () => {
    const fullDiscountPromo = { ...basePromotionRow, discount_value: 100, max_discount: null };
    const mockDb = createMockDatabase({ promotion: fullDiscountPromo });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    let payosAttempts = 0;
    let groupInput = null;
    let childCount = 0;
    const service = createCustomerOrderService({
      repository: {
        async createPublicOrder({ input }) {
          childCount += 1;
          const subtotal = input.items.reduce(
            (sum, item) => sum + (Number(item.product_id) === 2 ? 40000 : 60000) * Number(item.qty),
            0,
          );
          const discount = Number(input.allocatedDiscount || 0);
          return {
            id: 300 + childCount, order_code: `ZERO-GROUP-${childCount}`,
            subtotal, discount_amount: discount, total: subtotal - discount,
            payment_status: 'paid', payment_provider: 'promotion',
          };
        },
      },
      checkoutGroupsRepo: {
        async createCheckoutGroup(input) {
          groupInput = input;
          return {
            id: 90, group_code: 'ZERO-GROUP', total_amount: input.totalAmount,
            subtotal: input.subtotal, discount_amount: input.discountAmount,
            payment_status: input.paymentStatus, payment_provider: input.paymentProvider,
          };
        },
      },
      promotionsRepo: promoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({
        isGrouped: true,
        profile: { id: 99, code: 'GROUP_CHECKOUT', status: 'active' },
        rootGroups: [
          { rootCategoryId: 1, rootCategoryName: 'A', rootCategorySlug: 'a', originalPaymentProfile: { code: 'A' }, items: [{ product_id: 1, qty: 1 }] },
          { rootCategoryId: 2, rootCategoryName: 'B', rootCategorySlug: 'b', originalPaymentProfile: { code: 'B' }, items: [{ product_id: 2, qty: 1 }] },
        ],
      }),
      checkPayOSConfigured: () => true,
      createGroupPayOSAttempt: async () => { payosAttempts += 1; },
    });

    const result = await service.create({
      userId: 1,
      idempotencyKey: 'test-full-discount-group',
      input: {
        store_id: 1, source: 'online', order_type: 'Take-away', payment_method: 'VietQR',
        customer_name: 'Group Customer', customer_phone: '0901234567', voucher_code: 'SALE20',
        items: [{ product_id: 1, qty: 1 }, { product_id: 2, qty: 1 }],
      },
    });

    assert.equal(result.payment_required, false);
    assert.equal(result.payment_status, 'paid');
    assert.equal(groupInput.paymentProvider, 'promotion');
    assert.equal(groupInput.paymentStatus, 'paid');
    assert.equal(payosAttempts, 0);
  });

  function makeHttpRequest(app, { method, path, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = { ...headers };
        if (payload) {
          reqHeaders['content-type'] = 'application/json';
          reqHeaders['content-length'] = Buffer.byteLength(payload);
        }
        const req = http.request(
          { hostname: '127.0.0.1', port, path, method, headers: reqHeaders },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              server.close(() => {
                let json = null;
                try { json = JSON.parse(data); } catch {}
                resolve({ status: res.statusCode, headers: res.headers, body: json, text: data });
              });
            });
          }
        );
        req.on('error', (err) => server.close(() => reject(err)));
        if (payload) req.write(payload);
        req.end();
      });
    });
  }

  function createTestHttpApp(orderService) {
    const app = express();
    app.use(express.json());
    app.post('/api/orders', async (req, res) => {
      try {
        const idempotencyKey = String(req.headers['idempotency-key'] || 'test-default-idemp');
        const order = await orderService.create({
          input: req.body,
          userId: 1,
          idempotencyKey,
        });
        res.status(order.replay ? 200 : 201).json(order);
      } catch (err) {
        res.status(orderErrorStatus(err)).json({
          error: err.message,
          code: err.code || 'ORDER_BUSINESS_RULE',
        });
      }
    });
    return app;
  }

  it('HTTP contract: expired voucher returns HTTP 400 with PROMOTION_NOT_FOUND without masking as 500', async () => {
    const mockDb = createMockDatabase({
      promotion: { ...basePromotionRow, end_date: '2020-01-01' },
    });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb);
    const service = createCustomerOrderService({
      repository: ordersRepo,
      promotionsRepo: promoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({ isGrouped: false, profile: { id: 1, code: 'DEFAULT' } }),
      checkPayOSConfigured: () => false,
    });
    const app = createTestHttpApp(service);

    const res = await makeHttpRequest(app, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'idempotency-key': 'test-expired-key' },
      body: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Test Customer',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [{ product_id: 1, price: 60000, qty: 1 }],
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PROMOTION_NOT_FOUND');
    assert.match(res.body.error, /hết hạn/i);
    assert.notEqual(res.status, 500, 'Voucher error must never be masked as 500');
  });

  it('HTTP contract: single-use voucher already used returns HTTP 400 with PROMOTION_SINGLE_USE_EXHAUSTED', async () => {
    const mockDb = createMockDatabase({
      promotion: { ...basePromotionRow, voucher_type: 'single_use' },
      usageHistory: ['1:0901234567'],
    });
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb);
    const service = createCustomerOrderService({
      repository: ordersRepo,
      promotionsRepo: promoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({ isGrouped: false, profile: { id: 1, code: 'DEFAULT' } }),
      checkPayOSConfigured: () => false,
    });
    const app = createTestHttpApp(service);

    const res = await makeHttpRequest(app, {
      method: 'POST',
      path: '/api/orders',
      body: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Test Customer',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [{ product_id: 1, price: 60000, qty: 1 }],
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PROMOTION_SINGLE_USE_EXHAUSTED');
    assert.match(res.body.error, /đã được sử dụng cho số điện thoại/i);
  });

  it('HTTP contract: direct checkout with valid voucher returns 201 with applied discount', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    const ordersRepo = createOrdersRepository(mockDb);
    const service = createCustomerOrderService({
      repository: ordersRepo,
      promotionsRepo: promoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({ isGrouped: false, profile: { id: 1, code: 'DEFAULT' } }),
      checkPayOSConfigured: () => false,
    });
    const app = createTestHttpApp(service);

    const res = await makeHttpRequest(app, {
      method: 'POST',
      path: '/api/orders',
      body: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Test Customer',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [{ product_id: 1, price: 60000, qty: 1 }],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.discount_amount, 12000);
    assert.equal(res.body.total, 48000);
  });

  it('HTTP contract: grouped checkout with voucher returns 201 with pro-rata discount allocation', async () => {
    const mockDb = createMockDatabase();
    const promoRepo = createPromotionsRepository(mockDb, { clock: () => new Date('2026-09-13T12:00:00Z') });
    let createdChildOrderCount = 0;
    const mockOrdersRepo = {
      async createPublicOrder({ input }) {
        createdChildOrderCount += 1;
        const subtotal = input.items.reduce((s, it) => s + (it.price || 50000) * (it.qty || 1), 0);
        const discount = Number(input.allocatedDiscount || 0);
        return {
          id: 100 + createdChildOrderCount,
          order_code: `TP-CHILD-${createdChildOrderCount}`,
          subtotal,
          discount_amount: discount,
          total: subtotal - discount,
          status: 'Đang chuẩn bị',
          payment_status: 'unpaid',
        };
      },
    };
    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(data) {
        return { id: 50, group_code: 'GRP-TEST-VOUCHER', ...data };
      },
    };

    const service = createCustomerOrderService({
      repository: mockOrdersRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      promotionsRepo: promoRepo,
      database: mockDb,
      resolvePaymentProfile: async () => ({
        isGrouped: true,
        profile: { id: 99, code: 'GROUP_CHECKOUT', status: 'active' },
        rootGroups: [
          {
            rootCategoryId: 1,
            rootCategoryName: 'Trà Trái Cây',
            paymentProfile: { id: 1, code: 'PROFILE_A' },
            items: [{ product_id: 1, price: 60000, qty: 1 }],
          },
          {
            rootCategoryId: 2,
            rootCategoryName: 'Cà Phê',
            paymentProfile: { id: 2, code: 'PROFILE_B' },
            items: [{ product_id: 2, price: 40000, qty: 1 }],
          },
        ],
      }),
      checkPayOSConfigured: () => false,
    });
    const app = createTestHttpApp(service);

    const res = await makeHttpRequest(app, {
      method: 'POST',
      path: '/api/orders',
      body: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Group Customer',
        customer_phone: '0901234567',
        voucher_code: 'SALE20',
        items: [
          { product_id: 1, price: 60000, qty: 1 },
          { product_id: 2, price: 40000, qty: 1 },
        ],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.is_grouped, true);
    assert.equal(res.body.payment_summary.discount_amount, 20000);
    assert.equal(res.body.payment_summary.total_amount, 80000);
  });
});
