import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrdersRepository } from '../repositories/postgres/orders.js';
import { createCheckoutGroupsRepository, generateGroupCode } from '../repositories/postgres/checkout-groups.js';
import { createGroupedPayOSAttemptService } from '../services/grouped-payos-attempt.js';
import { createPaymentLinkForOrder, setPayOSForTest } from '../services/payos.js';
import { createCatalogV2Repository, CatalogV2Error } from '../repositories/postgres/catalog-v2.js';

describe('Regression: Preorder Code PO, Normal Code TP, PayOS Description & Duplicate Category 409', () => {
  describe('1. Normal Order Code (TP...) vs Preorder Order Code (PO...) in orders repository', () => {
    function createMockDb() {
      let insertedOrderCode = null;
      const mockTx = {
        async query(sql, params) {
          if (sql.includes('idempotency_keys')) return [[{ id: 1 }], 1];
          if (sql.includes('SELECT id FROM stores')) return [[{ id: 1, is_active: true }], 1];
          if (sql.includes('FROM products')) {
            return [[{
              id: 1,
              name: 'Trà Đào',
              price: 35000,
              status: 'active',
              category_id: 1,
              root_category_id: 1,
              product_type_id: 1,
              stock_mode: 'made_to_order',
              fulfillment_lane: 'kitchen',
            }], 1];
          }
          if (sql.includes('FROM categories')) {
            return [[{ id: 1, name: 'Trà', is_visible: true }], 1];
          }
          if (sql.includes('SAVEPOINT') || sql.includes('RELEASE SAVEPOINT')) {
            return [[], 0];
          }
          if (sql.includes('INSERT INTO orders')) {
            insertedOrderCode = params[0];
            return [[{
              id: 101,
              order_code: params[0],
              subtotal: 35000,
              discount_amount: 0,
              total: 35000,
              payment_status: 'unpaid',
              payment_provider: 'cod',
            }], 1];
          }
          if (sql.includes('INSERT INTO order_items')) return [[{ id: 1 }], 1];
          if (sql.includes('INSERT INTO order_events')) return [[{ id: 1 }], 1];
          if (sql.includes('INSERT INTO order_status_history')) return [[{ id: 1 }], 1];
          if (sql.includes('INSERT INTO fulfillment_tasks')) return [[{ id: 1, branch_id: 1, lane: 'kitchen', status: 'pending' }], 1];
          return [[], 0];
        },
      };

      const mockDb = {
        async transaction(callback) {
          return callback(mockTx);
        },
        async query(sql, params) {
          return mockTx.query(sql, params);
        },
      };

      return { mockDb, getInsertedCode: () => insertedOrderCode };
    }

    const mockPromotions = {
      async validateForOrder() { return null; },
      async consumeForOrder() {},
    };
    const mockNotifications = {
      async insertForUser() {},
      async fanOutToOrderAdmins() {},
    };
    const clock = () => new Date('2026-09-14T10:00:00.000Z');
    const randomInt = () => 4321;

    it('generates normal direct order code = TP... for normal orders', async () => {
      const { mockDb, getInsertedCode } = createMockDb();
      const repo = createOrdersRepository(mockDb, mockPromotions, mockNotifications, { clock, randomInt });

      const order = await repo.createPublicOrder({
        input: {
          store_id: 1,
          customer_name: 'Nguyen Van Normal',
          customer_phone: '0901111111',
          items: [{ product_id: 1, qty: 1 }],
        },
        idempotencyKey: 'test-norm-key',
        requestHash: 'hash-norm',
      });

      assert.equal(getInsertedCode()?.startsWith('TP'), true);
      assert.equal(order.order_code?.startsWith('TP'), true);
      assert.equal(order.order_code, 'TP2609144321');
    });

    it('generates preorder direct order code = PO... when preorder_id is present', async () => {
      const { mockDb, getInsertedCode } = createMockDb();
      const repo = createOrdersRepository(mockDb, mockPromotions, mockNotifications, { clock, randomInt });

      const order = await repo.createPublicOrder({
        input: {
          store_id: 1,
          customer_name: 'Nguyen Van Preorder',
          customer_phone: '0902222222',
          preorder_id: 99,
          items: [{ product_id: 1, qty: 1 }],
        },
        idempotencyKey: 'test-pre-key-1',
        requestHash: 'hash-pre-1',
      });

      assert.equal(getInsertedCode()?.startsWith('PO'), true);
      assert.equal(order.order_code?.startsWith('PO'), true);
      assert.equal(order.order_code, 'PO2609144321');
    });

    it('generates preorder direct order code = PO... when checkout_channel is preorder', async () => {
      const { mockDb, getInsertedCode } = createMockDb();
      const repo = createOrdersRepository(mockDb, mockPromotions, mockNotifications, { clock, randomInt });

      const order = await repo.createPublicOrder({
        input: {
          store_id: 1,
          customer_name: 'Nguyen Van Preorder',
          customer_phone: '0902222222',
          checkout_channel: 'preorder',
          items: [{ product_id: 1, qty: 1 }],
        },
        idempotencyKey: 'test-pre-key-2',
        requestHash: 'hash-pre-2',
      });

      assert.equal(getInsertedCode()?.startsWith('PO'), true);
      assert.equal(order.order_code?.startsWith('PO'), true);
      assert.equal(order.order_code, 'PO2609144321');
    });
  });

  describe('2. Checkout Groups: GRP... for both normal and preorder', () => {
    it('generateGroupCode always generates GRP prefix', () => {
      const code = generateGroupCode(() => 123456);
      assert.equal(code.startsWith('GRP'), true);
    });

    it('normal grouped group_code = GRP...', async () => {
      let createdGroupCode = null;
      const mockTx = {
        async query(sql, params) {
          if (sql.includes('INSERT INTO checkout_groups')) {
            createdGroupCode = params[0];
            return [[{
              id: 1,
              group_code: params[0],
              subtotal: 50000,
              total_amount: 50000,
            }], 1];
          }
          if (sql.includes('INSERT INTO checkout_group_allocations')) return [[], 0];
          return [[], 0];
        },
      };

      const mockDb = {
        async transaction(callback) { return callback(mockTx); },
      };

      const repo = createCheckoutGroupsRepository(mockDb);

      await repo.createCheckoutGroup({
        storeId: 1,
        subtotal: 50000,
        totalAmount: 50000,
        paymentProfile: { code: 'DEFAULT_PROFILE' },
        checkoutChannel: 'normal',
      });
      assert.equal(createdGroupCode?.startsWith('GRP'), true);
    });

    it('preorder grouped group_code = GRP... (mandatory)', async () => {
      let createdGroupCode = null;
      const mockTx = {
        async query(sql, params) {
          if (sql.includes('INSERT INTO checkout_groups')) {
            createdGroupCode = params[0];
            return [[{
              id: 2,
              group_code: params[0],
              subtotal: 70000,
              total_amount: 70000,
            }], 1];
          }
          if (sql.includes('INSERT INTO checkout_group_allocations')) return [[], 0];
          return [[], 0];
        },
      };

      const mockDb = {
        async transaction(callback) { return callback(mockTx); },
      };

      const repo = createCheckoutGroupsRepository(mockDb);

      await repo.createCheckoutGroup({
        storeId: 1,
        subtotal: 70000,
        totalAmount: 70000,
        paymentProfile: { code: 'DEFAULT_PROFILE' },
        checkoutChannel: 'preorder',
        isPreorder: true,
      });
      assert.equal(createdGroupCode?.startsWith('GRP'), true);
    });

    it('grouped preorder lookup, status and link renewal still recognize group GRP...', async () => {
      const targetGroupCode = 'GRP2609149999';
      const fakeGroup = {
        id: 50,
        group_code: targetGroupCode,
        store_id: 1,
        user_id: 10,
        total_amount: 80000,
        subtotal: 80000,
        discount_amount: 0,
        shipping_fee: 0,
        payment_status: 'unpaid',
        payment_provider: 'payos',
        payment_profile_code: 'DEFAULT_PROFILE',
        created_at: new Date().toISOString(),
        child_orders: [
          {
            order_id: 101,
            order_code: 'PO2609140001',
            preorder_id: 99,
            status: 'Chờ xác nhận',
            payment_status: 'unpaid',
            allocated_subtotal: 80000,
            allocated_total: 80000,
            items: [
              { id: 1, product_name: 'Trà Sữa Preorder', qty: 2, line_total: 80000 },
            ],
          },
        ],
        cancel_token_hashes: [],
      };

      const mockDb = {
        async query(sql, params) {
          if (sql.includes('WHERE cg.group_code = $1')) {
            assert.equal(params[0], targetGroupCode);
            return [[fakeGroup], 1];
          }
          return [[], 0];
        },
        async transaction(callback) {
          const tx = {
            async query(sql, params) {
              if (sql.includes('WHERE cg.group_code = $1')) {
                assert.equal(params[0], targetGroupCode);
                return [[fakeGroup], 1];
              }
              if (sql.includes('UPDATE checkout_groups')) {
                return [[{ ...fakeGroup, payment_checkout_url: 'https://pay.test/new' }], 1];
              }
              return [[], 0];
            },
          };
          return callback(tx);
        },
      };

      const repo = createCheckoutGroupsRepository(mockDb);

      // 1. Lookup
      const lookupResult = await repo.findGroupForCustomerLookup(targetGroupCode, { userId: 10 });
      assert.ok(lookupResult);
      assert.equal(lookupResult.group_code, targetGroupCode);
      assert.equal(lookupResult.child_orders.length, 1);
      assert.equal(lookupResult.child_orders[0].order_code, 'PO2609140001');

      // 2. Renewal / Regenerate recognizes group GRP... and uses preorder PO... for description
      setPayOSForTest({
        paymentRequests: {
          create: async (payload) => {
            assert.equal(payload.description, 'PO2609140001');
            return {
              checkoutUrl: 'https://pay.test/new',
              qrCode: 'qr-new',
              paymentLinkId: 'link-renew-1',
            };
          },
        },
      });

      const renewResult = await repo.renewGroupPayOSLink({ groupCode: targetGroupCode, userId: 10 });
      assert.ok(renewResult);
      assert.equal(renewResult.group_code, targetGroupCode);
      setPayOSForTest();
    });

    it('grouped normal link renewal keeps GRP... and uses Don GRP... for description', async () => {
      const normalGroupCode = 'GRP2609141111';
      const fakeNormalGroup = {
        id: 51,
        group_code: normalGroupCode,
        store_id: 1,
        user_id: 10,
        total_amount: 60000,
        subtotal: 60000,
        discount_amount: 0,
        shipping_fee: 0,
        payment_status: 'unpaid',
        payment_provider: 'payos',
        payment_profile_code: 'DEFAULT_PROFILE',
        created_at: new Date().toISOString(),
        child_orders: [
          {
            order_id: 102,
            order_code: 'TP2609140002',
            preorder_id: null,
            status: 'Chờ xác nhận',
            payment_status: 'unpaid',
            allocated_subtotal: 60000,
            allocated_total: 60000,
          },
        ],
        cancel_token_hashes: [],
      };

      const mockDb = {
        async transaction(callback) {
          const tx = {
            async query(sql) {
              if (sql.includes('WHERE cg.group_code = $1')) {
                return [[fakeNormalGroup], 1];
              }
              if (sql.includes('UPDATE checkout_groups')) {
                return [[{ ...fakeNormalGroup, payment_checkout_url: 'https://pay.test/normal-new' }], 1];
              }
              return [[], 0];
            },
          };
          return callback(tx);
        },
      };

      const repo = createCheckoutGroupsRepository(mockDb);

      setPayOSForTest({
        paymentRequests: {
          create: async (payload) => {
            assert.equal(payload.description, `Don ${normalGroupCode}`);
            return {
              checkoutUrl: 'https://pay.test/normal-new',
              qrCode: 'qr-normal-new',
              paymentLinkId: 'link-renew-normal',
            };
          },
        },
      });

      const renewResult = await repo.renewGroupPayOSLink({ groupCode: normalGroupCode, userId: 10 });
      assert.ok(renewResult);
      assert.equal(renewResult.group_code, normalGroupCode);
      setPayOSForTest();
    });
  });

  describe('3. PayOS Description: Don TP... for normal vs PO... for preorder (Direct & Grouped)', () => {
    let capturedPayload = null;

    beforeEach(() => {
      capturedPayload = null;
      setPayOSForTest({
        paymentRequests: {
          create: async (payload) => {
            capturedPayload = payload;
            return {
              checkoutUrl: 'https://sandbox.payos.test/checkout',
              qrCode: 'qr-sample',
              paymentLinkId: 'link-123',
            };
          },
        },
      });
    });

    afterEach(() => {
      setPayOSForTest();
    });

    it('direct normal: order_code TP..., PayOS description Don TP...', async () => {
      await createPaymentLinkForOrder({
        orderId: 10,
        orderCode: 'TP2609141234',
        total: 45000,
        payosOrderCode: '900001',
      });

      assert.ok(capturedPayload);
      assert.equal(capturedPayload.description.startsWith('Don TP'), true);
      assert.equal(capturedPayload.description, 'Don TP2609141234');
    });

    it('direct preorder: order_code PO..., PayOS description PO...', async () => {
      await createPaymentLinkForOrder({
        orderId: 20,
        orderCode: 'PO2609145678',
        total: 55000,
        payosOrderCode: '900002',
      });

      assert.ok(capturedPayload);
      assert.equal(capturedPayload.description.startsWith('PO'), true);
      assert.equal(capturedPayload.description, 'PO2609145678');
    });

    it('grouped normal: group_code GRP..., child orders TP..., PayOS description Don GRP...', async () => {
      let createdLinkPayload = null;
      const attempt = {
        id: 701,
        status: 'creating',
        provider: 'payos',
        payment_profile_code: 'DEFAULT',
        provider_order_code: 987654321,
        expires_at: new Date(Date.now() + 900000),
      };
      const service = createGroupedPayOSAttemptService({
        attemptsRepository: {
          reserveOrRecoverCreatingAttempt: async () => ({ kind: 'creating', attempt, recovered: false }),
          activateAttempt: async () => ({ ...attempt, status: 'active' }),
        },
        lookupPaymentLink: async () => ({ kind: 'not_found' }),
        createPaymentLink: async (input) => {
          createdLinkPayload = input;
          return { paymentLinkId: 'link-norm', checkoutUrl: 'https://pay.test', qrCode: 'qr-norm' };
        },
        withCreationLock: async (_key, fn) => fn(),
      });

      const normalGroup = {
        id: 60,
        group_code: 'GRP2609146001',
        total_amount: 70000,
        payment_profile_code: 'DEFAULT',
        payment_status: 'unpaid',
        child_orders: [{ order_code: 'TP2609146001' }, { order_code: 'TP2609146002' }],
      };

      const result = await service.createForGroup({ group: normalGroup });
      assert.equal(result.group_code, 'GRP2609146001');
      assert.ok(createdLinkPayload);
      assert.equal(createdLinkPayload.orderCode, 'GRP2609146001');
      assert.equal(createdLinkPayload.description, 'Don GRP2609146001');
    });

    it('grouped preorder: group_code GRP..., child service order PO..., PayOS description PO...', async () => {
      let createdLinkPayload = null;
      const attempt = {
        id: 702,
        status: 'creating',
        provider: 'payos',
        payment_profile_code: 'DEFAULT',
        provider_order_code: 987654322,
        expires_at: new Date(Date.now() + 900000),
      };
      const service = createGroupedPayOSAttemptService({
        attemptsRepository: {
          reserveOrRecoverCreatingAttempt: async () => ({ kind: 'creating', attempt, recovered: false }),
          activateAttempt: async () => ({ ...attempt, status: 'active' }),
        },
        lookupPaymentLink: async () => ({ kind: 'not_found' }),
        createPaymentLink: async (input) => {
          createdLinkPayload = input;
          return { paymentLinkId: 'link-pre', checkoutUrl: 'https://pay.test', qrCode: 'qr-pre' };
        },
        withCreationLock: async (_key, fn) => fn(),
      });

      const preorderGroup = {
        id: 61,
        group_code: 'GRP2609146002',
        total_amount: 85000,
        payment_profile_code: 'DEFAULT',
        payment_status: 'unpaid',
        preorder_code: 'PO2609149999',
        child_orders: [{ order_code: 'PO2609140001' }],
      };

      const result = await service.createForGroup({ group: preorderGroup });
      assert.equal(result.group_code, 'GRP2609146002');
      assert.ok(createdLinkPayload);
      assert.equal(createdLinkPayload.orderCode, 'GRP2609146002');
      assert.equal(createdLinkPayload.description, 'PO2609149999');
    });

    it('grouped preorder regenerate: group_code GRP..., PayOS description PO...', async () => {
      let createdLinkPayload = null;
      const attempt = {
        id: 703,
        status: 'creating',
        provider: 'payos',
        payment_profile_code: 'DEFAULT',
        provider_order_code: 987654323,
        expires_at: new Date(Date.now() + 900000),
      };
      const preorderGroup = {
        id: 62,
        group_code: 'GRP2609146003',
        user_id: 10,
        total_amount: 90000,
        payment_profile_code: 'DEFAULT',
        payment_status: 'unpaid',
        preorder_code: 'PO2609147777',
        child_orders: [{ order_code: 'PO2609140002' }],
      };

      const service = createGroupedPayOSAttemptService({
        attemptsRepository: {
          reserveOrRecoverCreatingAttempt: async () => ({ kind: 'creating', attempt, recovered: false }),
          activateAttempt: async () => ({ ...attempt, status: 'active' }),
          findAttemptById: async () => null,
        },
        groupsRepository: {
          findGroupByCode: async (code) => {
            assert.equal(code, 'GRP2609146003');
            return preorderGroup;
          },
        },
        lookupPaymentLink: async () => ({ kind: 'not_found' }),
        createPaymentLink: async (input) => {
          createdLinkPayload = input;
          return { paymentLinkId: 'link-regen', checkoutUrl: 'https://pay.test', qrCode: 'qr-regen' };
        },
        withCreationLock: async (_key, fn) => fn(),
        reconcileGroup: async () => ({ outcome: 'terminal_unpaid' }),
      });

      const result = await service.regenerateForCustomer({ groupCode: 'GRP2609146003', userId: 10 });
      assert.equal(result.group_code, 'GRP2609146003');
      assert.ok(createdLinkPayload);
      assert.equal(createdLinkPayload.orderCode, 'GRP2609146003');
      assert.equal(createdLinkPayload.description, 'PO2609147777');
    });

    it('PayOS description respects explicit custom description if provided', async () => {
      await createPaymentLinkForOrder({
        orderId: 30,
        orderCode: 'TP2609141234',
        total: 45000,
        payosOrderCode: '900003',
        description: 'Custom Description',
      });

      assert.ok(capturedPayload);
      assert.equal(capturedPayload.description, 'Custom Description');
    });
  });

  describe('4. Duplicate Category Creation returns 409 clearly', () => {
    it('duplicate root category => 409 + message rõ (Tên hoặc slug ngành hàng gốc đã tồn tại)', async () => {
      const mockDb = {
        async query(sql) {
          if (sql.includes('INSERT INTO categories')) {
            const err = new Error('duplicate key value violates unique constraint "categories_slug_key"');
            err.code = '23505';
            throw err;
          }
          return [[], 0];
        },
      };

      const repo = createCatalogV2Repository(mockDb);

      await assert.rejects(
        async () => {
          await repo.createCategory({
            name: 'Đồ Uống',
            slug: 'do-uong',
            parent_id: null,
          });
        },
        (err) => {
          assert.ok(err instanceof CatalogV2Error);
          assert.equal(err.status, 409);
          assert.equal(err.message, 'Tên hoặc slug ngành hàng gốc đã tồn tại');
          return true;
        },
      );
    });

    it('duplicate subcategory => 409 + message rõ (Tên hoặc slug danh mục đã tồn tại)', async () => {
      const mockDb = {
        async query(sql) {
          if (sql.includes('WHERE c.id = $1')) {
            return [[{ id: 1, depth: 0, name: 'Ngành Gốc' }], 1];
          }
          if (sql.includes('INSERT INTO categories')) {
            const err = new Error('duplicate key value violates unique constraint "categories_slug_key"');
            err.code = '23505';
            throw err;
          }
          return [[], 0];
        },
      };

      const repo = createCatalogV2Repository(mockDb);

      await assert.rejects(
        async () => {
          await repo.createCategory({
            name: 'Trà Trái Cây',
            slug: 'tra-trai-cay',
            parent_id: 1,
          });
        },
        (err) => {
          assert.ok(err instanceof CatalogV2Error);
          assert.equal(err.status, 409);
          assert.equal(err.message, 'Tên hoặc slug danh mục đã tồn tại');
          return true;
        },
      );
    });
  });
});
