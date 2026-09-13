import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPromotionsRepository, PromotionError } from '../repositories/postgres/promotions.js';
import { createOrdersRepository } from '../repositories/postgres/orders.js';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';
import { OrderDomainError, orderErrorStatus } from '../services/orders/order-errors.js';

describe('Checkout Voucher Stability Suite', () => {
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
                payment_status: 'unpaid',
                payment_provider: 'cod',
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
});
