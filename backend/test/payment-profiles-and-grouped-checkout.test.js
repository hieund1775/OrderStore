import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { requireSuperAdmin } from '../routes/admin/payment-profiles.js';
import {
  resolvePaymentProfileForCart,
  allocateVoucherDiscount,
} from '../services/payment-profiles/payment-profile-resolver.js';
import { createPaymentProfilesRepository, maskAccountNumber, generateEnvPrefix } from '../repositories/postgres/payment-profiles.js';
import { createCheckoutGroupsRepository, verifyGroupOwnership, generateGroupCode } from '../repositories/postgres/checkout-groups.js';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';
import { isPayOSConfigured, setPayOSForTest } from '../services/payos.js';

describe('Payment Profiles & Grouped Checkout Comprehensive Acceptance Suite (Round 4)', () => {

  // ═════════════════════════════════════════════════════════════════
  // Gate 1: RBAC & Canonical Role Enforcement ('super')
  // ═════════════════════════════════════════════════════════════════
  it('Gate 1: RBAC strictly permits canonical "super" role and rejects manager/kitchen/cashier/packing with 403', () => {
    const nextCalls = [];
    const mockNext = () => nextCalls.push(true);

    const makeRes = () => {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      return res;
    };

    // 1. Super admin passes
    const superReq = { user: { id: 1, role: 'super', name: 'Super Admin' } };
    const superRes = makeRes();
    requireSuperAdmin(superReq, superRes, mockNext);
    assert.equal(nextCalls.length, 1);
    assert.equal(superRes.statusCode, 200);

    // 2. Non-super roles get 403
    const forbiddenRoles = ['manager', 'kitchen', 'cashier', 'packing', 'super_admin', 'guest'];
    for (const role of forbiddenRoles) {
      const req = { user: { id: 2, role, name: `User ${role}` } };
      const res = makeRes();
      requireSuperAdmin(req, res, mockNext);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.error, /Super Admin/i);
    }
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 2: Secret Safety & Account Number Masking
  // ═════════════════════════════════════════════════════════════════
  it('Gate 2: Secret Safety & Account Masking in Repository and ENV Prefix generator', () => {
    assert.equal(maskAccountNumber('0987654321'), '******4321');
    assert.equal(maskAccountNumber('12345'), '*2345');
    assert.equal(maskAccountNumber('123'), '123');
    assert.equal(maskAccountNumber(null), null);
    assert.equal(maskAccountNumber(''), null);

    assert.equal(generateEnvPrefix('nuoc_hieu'), 'PAYOS_PROFILE_NUOC_HIEU');
    assert.equal(generateEnvPrefix('QUANAO-HUNG'), 'PAYOS_PROFILE_QUANAO_HUNG');
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 3: Decimal-Safe Pro-Rata Integer Remainder Allocation ($1 dong sink)
  // ═════════════════════════════════════════════════════════════════
  it('Gate 3: Decimal-Safe Pro-Rata Integer Remainder Allocation guarantees exact sum', () => {
    const result = allocateVoucherDiscount({
      rootGroupsWithSubtotal: [
        { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc', subtotal: 100000 },
        { rootCategoryId: 2, rootCategoryName: 'Thời Trang', rootCategorySlug: 'thoi-trang', subtotal: 100000 },
        { rootCategoryId: 3, rootCategoryName: 'Mỹ Phẩm', rootCategorySlug: 'my-pham', subtotal: 100000 },
      ],
      voucherDiscount: 50000,
      shippingFee: 15000,
    });

    assert.equal(result.subtotal, 300000);
    assert.equal(result.discountAmount, 50000);
    assert.equal(result.allocations.length, 3);

    // Integer allocation: Group 0: 16666, Group 1: 16666, Group 2 (remainder sink): 16668
    assert.equal(result.allocations[0].allocatedDiscount, 16666);
    assert.equal(result.allocations[1].allocatedDiscount, 16666);
    assert.equal(result.allocations[2].allocatedDiscount, 16668);

    const sumDiscount = result.allocations.reduce((sum, a) => sum + a.allocatedDiscount, 0);
    assert.equal(sumDiscount, 50000);

    const sumTotal = result.allocations.reduce((sum, a) => sum + a.allocatedTotal, 0);
    assert.equal(sumTotal, 300000 - 50000 + 15000);
  });

  // ═════════════════════════════════════════════════════════════════
  // B1: Fail-Closed DB Line Price Calculation (No client price fallback)
  // ═════════════════════════════════════════════════════════════════
  it('B1: Fail-closed when DB query or product/topping is invalid (never falls back to client price)', async () => {
    let orderCreated = false;
    let groupCreated = false;
    let voucherConsumed = false;

    const mockOrdersRepo = {
      async createPublicOrder() {
        orderCreated = true;
        return { id: 1 };
      },
    };

    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup() {
        groupCreated = true;
        return { id: 1 };
      },
    };

    const mockPromotionsRepo = {
      async validateForOrder() {
        return { discount_amount: 10000 };
      },
      async consumeForOrder() {
        voucherConsumed = true;
      },
    };

    const mockResolvePaymentProfile = async () => ({
      isGrouped: true,
      profile: { id: 1, code: 'LONG_GROUPED_CHECKOUT', version: 1 },
      rootGroups: [
        { rootCategoryId: 1, rootCategoryName: 'Nước', items: [{ product_id: 999, price: 1, qty: 1 }] },
        { rootCategoryId: 2, rootCategoryName: 'Áo', items: [{ product_id: 888, price: 1, qty: 1 }] },
      ],
    });

    // DB query returns empty for product 999 (unavailable/non-existent)
    const mockDb = {
      async transaction(cb) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('SELECT p.id, p.name, p.price')) {
              return [[]]; // Product not found!
            }
            return [[]];
          },
        };
        return cb(tx);
      },
    };

    const service = createCustomerOrderService({
      repository: mockOrdersRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      promotionsRepo: mockPromotionsRepo,
      resolvePaymentProfile: mockResolvePaymentProfile,
      database: mockDb,
    });

    await assert.rejects(
      async () => {
        await service.create({
          input: {
            store_id: 1,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'COD',
            customer_name: 'Nguyen Van A',
            customer_phone: '0987654321',
            items: [{ product_id: 999, price: 1, qty: 1 }, { product_id: 888, price: 1, qty: 1 }],
            voucher_code: 'SALE10K',
          },
          userId: 123,
        });
      },
      (err) => err.message.includes('Sản phẩm không tồn tại hoặc đã ngừng bán'),
    );

    // Assert that fail-closed aborted everything
    assert.equal(orderCreated, false);
    assert.equal(groupCreated, false);
    assert.equal(voucherConsumed, false);
  });

  // ═════════════════════════════════════════════════════════════════
  // B2 & B5: Resolver Strict Product Validation and Audit Logging
  // ═════════════════════════════════════════════════════════════════
  it('B2 & B5: Resolver rejects missing product and fails closed without a ready fallback', async () => {
    let auditLogInserted = false;
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('FROM products p')) {
          if (params[0].includes(102)) {
            return [[{ product_id: 101, product_name: 'Trà Sữa', price: 30000, category_id: 1, root_category_id: 1, root_category_name: 'Nước', root_category_slug: 'nuoc' }]];
          }
          return [[{ product_id: 101, product_name: 'Trà Sữa', price: 30000, category_id: 1, root_category_id: 1, root_category_name: 'Nước', root_category_slug: 'nuoc' }]];
        }
        if (sql.includes('INSERT INTO audit_logs')) {
          auditLogInserted = true;
          return [[]];
        }
        return [[]];
      },
    };

    // B2: Missing product 102 in DB must throw 400
    await assert.rejects(
      async () => {
        await resolvePaymentProfileForCart({
          storeId: 1,
          items: [{ product_id: 101, qty: 1 }, { product_id: 102, qty: 1 }],
          database: mockDb,
        });
      },
      (err) => err.message.includes('Sản phẩm #102 không tồn tại hoặc chưa gán danh mục'),
    );

    // B5: Valid but unmapped root fails closed while DEFAULT_PROFILE is unavailable.
    const mockProfilesRepo = {
      async getActiveProfileByRootCategoryId() {
        return null; // Unmapped root
      },
    };

    await assert.rejects(
      async () => {
        await resolvePaymentProfileForCart({
          storeId: 1,
          items: [{ product_id: 101, qty: 1 }],
          database: mockDb,
          profilesRepo: mockProfilesRepo,
        });
      },
      (err) => err.code === 'FALLBACK_PAYMENT_PROFILE_UNAVAILABLE',
    );
  });

  // ═════════════════════════════════════════════════════════════════
  // C3: DB failure during profile query must throw 500 without falling back to Long
  // ═════════════════════════════════════════════════════════════════
  it('C3: DB query error during profile lookup rethrows 500 and does NOT fallback to Long or log audit', async () => {
    let auditLogInserted = false;
    const mockDb = {
      async query(sql) {
        if (sql.includes('FROM products p')) {
          return [[{ product_id: 101, product_name: 'Trà Sữa', price: 30000, category_id: 1, root_category_id: 1, root_category_name: 'Nước', root_category_slug: 'nuoc' }]];
        }
        if (sql.includes('INSERT INTO audit_logs')) {
          auditLogInserted = true;
          return [[]];
        }
        return [[]];
      },
    };

    const brokenProfilesRepo = {
      async getActiveProfileByRootCategoryId() {
        throw new Error('Database pool connection refused ECONNREFUSED');
      },
    };

    await assert.rejects(
      async () => {
        await resolvePaymentProfileForCart({
          storeId: 1,
          items: [{ product_id: 101, qty: 1 }],
          database: mockDb,
          profilesRepo: brokenProfilesRepo,
        });
      },
      (err) => err.message.includes('ECONNREFUSED'),
    );

    assert.equal(auditLogInserted, false);
  });

  // ═════════════════════════════════════════════════════════════════
  // R2 & R3: Group Ownership & QR Renew Security
  // ═════════════════════════════════════════════════════════════════
  it('R2 & R3: verifyGroupOwnership strictly enforces credentials for both registered users and guests', () => {
    const rawToken = 'guest-secret-token-12345';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const userGroup = {
      id: 1,
      group_code: 'GRP_USER',
      user_id: 100,
      cancel_token_hashes: [],
    };

    const guestGroup = {
      id: 2,
      group_code: 'GRP_GUEST',
      user_id: null,
      cancel_token_hashes: [tokenHash],
    };

    // 1. Registered User Group checks
    assert.equal(verifyGroupOwnership(userGroup, { userId: 100 }), true);
    assert.throws(() => verifyGroupOwnership(userGroup, { userId: null }), (err) => err.status === 401);
    assert.throws(() => verifyGroupOwnership(userGroup, { userId: 999 }), (err) => err.status === 403);

    // 2. Guest Group checks
    assert.equal(verifyGroupOwnership(guestGroup, { cancelToken: rawToken }), true);
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: null }), (err) => err.status === 401);
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: '' }), (err) => err.status === 401);
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: 'wrong-token' }), (err) => err.status === 403);
  });

  // ═════════════════════════════════════════════════════════════════
  // C2: Failure-First PayOS Creation and Retry with Same Idempotency Key
  // ═════════════════════════════════════════════════════════════════
  it('C2: Initial PayOS failure does NOT get stuck in_progress; retry resumes exact group and returns usable link', async () => {
    let orderCreateCount = 0;
    let groupCreateCount = 0;
    let voucherConsumeCount = 0;
    let renewCallCount = 0;

    const idempotencyStore = new Map();

    const mockDb = {
      async transaction(cb) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('SELECT p.id, p.name, p.price')) {
              return [[{ id: params[0], name: 'Mock Product', price: 50000, fulfillment_lane: 'kitchen' }]];
            }
            if (sql.includes('INSERT INTO idempotency_keys')) {
              const key = params[0];
              if (idempotencyStore.has(key)) {
                return [[]]; // Conflict on unique key
              }
              idempotencyStore.set(key, { scope: params[1], request_hash: params[2], status: 'in_progress' });
              return [[{ id: 1 }]];
            }
            if (sql.includes('SELECT scope, request_hash, status, response_body')) {
              const key = params[0];
              const record = idempotencyStore.get(key);
              if (!record) return [[]];
              return [[{
                scope: record.scope,
                request_hash: record.request_hash,
                status: record.status,
                response_body: record.response_body,
              }]];
            }
            if (sql.includes('UPDATE idempotency_keys')) {
              const key = params[0];
              const record = idempotencyStore.get(key) || {};
              idempotencyStore.set(key, { ...record, status: 'completed', response_body: JSON.parse(params[2]) });
              return [[]];
            }
            return [[]];
          },
        };
        return cb(tx);
      },
    };

    const mockOrdersRepo = {
      async createPublicOrder({ input, rootCategoryId, paymentProfile }) {
        orderCreateCount++;
        return {
          id: orderCreateCount,
          order_code: `TP${orderCreateCount}`,
          subtotal: 50000,
          discount_amount: 0,
          total: 50000,
          root_category_id: rootCategoryId,
          payment_profile_code: paymentProfile?.code,
        };
      },
    };

    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(data) {
        groupCreateCount++;
        return {
          id: 1,
          group_code: 'GRP_FAIL_RETRY_1',
          total_amount: data.totalAmount,
          subtotal: data.subtotal,
          discount_amount: 0,
          payment_profile_code: data.paymentProfile.code,
          allocations: data.allocations,
        };
      },
      async reservePayOSCheckoutGroup() {
        return { payos_order_code: 999222, payment_expires_at: new Date(Date.now() + 900_000) };
      },
      async attachPaymentLinkToGroup() {
        return { payment_link_id: 'link_222', payos_order_code: 999222, payment_expires_at: new Date() };
      },
      async renewGroupPayOSLink() {
        renewCallCount++;
        return {
          payment_checkout_url: 'https://payos.vn/gate/222',
          payment_qr_code: 'qr_222',
          payment_link_id: 'link_222',
          payos_order_code: 999222,
          payment_expires_at: new Date(),
        };
      },
    };

    const mockPromotionsRepo = {
      async validateForOrder() {
        return null;
      },
      async consumeForOrder() {
        voucherConsumeCount++;
      },
    };

    const mockResolvePaymentProfile = async () => ({
      isGrouped: true,
      profile: { id: 1, code: 'LONG_GROUPED_CHECKOUT', version: 1 },
      rootGroups: [
        { rootCategoryId: 1, rootCategoryName: 'Nước', items: [{ product_id: 1, price: 50000, qty: 1 }] },
        { rootCategoryId: 2, rootCategoryName: 'Áo', items: [{ product_id: 2, price: 50000, qty: 1 }] },
      ],
    });

    const service = createCustomerOrderService({
      repository: mockOrdersRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      promotionsRepo: mockPromotionsRepo,
      resolvePaymentProfile: mockResolvePaymentProfile,
      checkPayOSConfigured: () => true,
      database: mockDb,
    });

    const requestPayload = {
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'VietQR',
        customer_name: 'Nguyen Van A',
        customer_phone: '0987654321',
        items: [{ product_id: 1, price: 50000, qty: 1 }, { product_id: 2, price: 50000, qty: 1 }],
      },
      userId: 123,
      idempotencyKey: 'IDEM_FAILURE_FIRST_KEY',
    };

    // 1. Initial attempt fails during PayOS link creation
    setPayOSForTest({
      paymentRequests: {
        create: async () => {
          throw new Error('PayOS gateway temporary outage 503');
        },
      },
    });

    await assert.rejects(
      async () => {
        await service.create(requestPayload);
      },
      (err) => err.status === 502 && err.message.includes('GRP_FAIL_RETRY_1'),
    );

    assert.equal(orderCreateCount, 2);
    assert.equal(groupCreateCount, 1);

    // 2. Retry with SAME idempotency key when PayOS is healthy
    setPayOSForTest({
      paymentRequests: {
        create: async () => ({
          checkoutUrl: 'https://payos.vn/gate/222',
          qrCode: 'qr_222',
          paymentLinkId: 'link_222',
        }),
      },
    });

    try {
      const retryResult = await service.create(requestPayload);
      assert.equal(retryResult.replay, true);
      assert.equal(retryResult.group_code, 'GRP_FAIL_RETRY_1');
      assert.equal(retryResult.checkout_url, 'https://payos.vn/gate/222');
      assert.equal(retryResult.qr_code, 'qr_222');

      // Assert NO duplicate child orders or groups were created on retry
      assert.equal(orderCreateCount, 2);
      assert.equal(groupCreateCount, 1);
      assert.equal(renewCallCount, 1);
    } finally {
      setPayOSForTest(null);
    }
  });

  describe('Gate 9: Customer Industry Payment Summary Contract', () => {
    it('Single-industry order returns payment_summary with 1 industry and matching totals', async () => {
      const mockOrdersRepo = {
        async createPublicOrder({ input, rootCategoryId }) {
          return {
            id: 101,
            order_code: 'TP_SINGLE_1',
            subtotal: 50000,
            discount_amount: 0,
            shipping_fee: 0,
            total: 50000,
            payment_status: 'unpaid',
            status: 'Đang chuẩn bị',
          };
        },
      };

      const mockResolvePaymentProfile = async () => ({
        mode: 'single',
        profile: { code: 'TEAPLUS_PROFILE', bankAccount: '00001', secretKey: 'SECRET_1' },
        rootCategory: { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc-uong' },
      });

      const service = createCustomerOrderService({
        repository: mockOrdersRepo,
        resolvePaymentProfile: mockResolvePaymentProfile,
        checkPayOSConfigured: () => false,
      });

      const res = await service.create({
        userId: 123,
        input: {
          store_id: 1,
          order_type: 'Take-away',
          payment_method: 'COD',
          customer_name: 'Nguyen Van Single',
          customer_phone: '0987654321',
          items: [{ product_id: 1, product_name: 'Trà Đào', unit_price: 50000, qty: 1 }],
        },
      });

      assert.ok(res.payment_summary, 'payment_summary must be present');
      assert.equal(res.payment_summary.is_grouped, false);
      assert.equal(res.payment_summary.group_code, null);
      assert.equal(res.payment_summary.subtotal, 50000);
      assert.equal(res.payment_summary.discount_amount, 0);
      assert.equal(res.payment_summary.total_amount, 50000);
      assert.equal(res.payment_summary.industries.length, 1);

      const ind = res.payment_summary.industries[0];
      assert.equal(ind.root_category_id, '1');
      assert.equal(ind.root_category_name, 'Nước Uống');
      assert.equal(ind.order_code, 'TP_SINGLE_1');
      assert.equal(ind.subtotal, 50000);
      assert.equal(ind.total_amount, 50000);
      assert.equal(ind.items.length, 1);
      assert.equal(ind.items[0].product_name, 'Trà Đào');

      // Zero secret leakage check
      const jsonStr = JSON.stringify(res);
      assert.equal(jsonStr.includes('00001'), false, 'Bank account must not be leaked');
      assert.equal(jsonStr.includes('SECRET_1'), false, 'Secret key must not be leaked');
      assert.equal(jsonStr.includes('TEAPLUS_PROFILE'), false, 'Profile code must not be leaked');
    });

    it('Grouped multi-industry checkout returns payment_summary.is_grouped === true and sum invariants', async () => {
      const mockCheckoutGroupsRepo = {
        async createCheckoutGroup({ subtotal, discountAmount, shippingFee, totalAmount }) {
          return {
            id: 999,
            group_code: 'GRP_SUMMARY_TEST',
            subtotal,
            discount_amount: discountAmount,
            shipping_fee: shippingFee || 0,
            total_amount: totalAmount,
            payment_status: 'unpaid',
          };
        },
      };

      const mockOrdersRepo = {
        async createPublicOrder({ input, rootCategoryId }) {
          return {
            id: rootCategoryId === 1 ? 201 : 202,
            order_code: rootCategoryId === 1 ? 'TP_CHILD_1' : 'TP_CHILD_2',
            subtotal: 50000,
            discount_amount: 10000,
            shipping_fee: 0,
            total: 40000,
            payment_status: 'unpaid',
            status: 'Đang chuẩn bị',
          };
        },
      };

      const mockResolvePaymentProfile = async () => ({
        isGrouped: true,
        profile: { code: 'PARENT_PROFILE', bankAccount: 'SECRET_BANK', secretKey: 'SECRET_PAYOS' },
        rootGroups: [
          {
            rootCategoryId: 1,
            rootCategoryName: 'Nước Uống',
            rootCategorySlug: 'nuoc-uong',
            items: [{ product_id: 1, product_name: 'Trà Lài', price: 50000, qty: 1 }],
          },
          {
            rootCategoryId: 2,
            rootCategoryName: 'Thời Trang',
            rootCategorySlug: 'thoi-trang',
            items: [{ product_id: 2, product_name: 'Áo Thun', price: 50000, qty: 1 }],
          },
        ],
      });

      const service = createCustomerOrderService({
        repository: mockOrdersRepo,
        checkoutGroupsRepo: mockCheckoutGroupsRepo,
        promotionsRepo: {
          async validateForOrder() {
            return { valid: true, discount_amount: 20000 };
          },
          async consumeForOrder() {
            return true;
          },
        },
        resolvePaymentProfile: mockResolvePaymentProfile,
        checkPayOSConfigured: () => false,
        database: {
          async transaction(fn) {
            return await fn({});
          },
        },
      });

      const res = await service.create({
        userId: 123,
        input: {
          store_id: 1,
          order_type: 'Take-away',
          payment_method: 'COD',
          voucher_code: 'SALE20',
          customer_name: 'Nguyen Van Group',
          customer_phone: '0987654321',
          items: [
            { product_id: 1, price: 50000, qty: 1 },
            { product_id: 2, price: 50000, qty: 1 },
          ],
        },
      });

      assert.ok(res.payment_summary, 'payment_summary must be present');
      assert.equal(res.payment_summary.is_grouped, true);
      assert.equal(res.payment_summary.group_code, 'GRP_SUMMARY_TEST');
      assert.equal(res.payment_summary.subtotal, 100000);
      assert.equal(res.payment_summary.discount_amount, 20000);
      assert.equal(res.payment_summary.total_amount, 80000);
      assert.equal(res.payment_summary.industries.length, 2);

      // Verify sum invariants
      const sumSubtotal = res.payment_summary.industries.reduce((s, ind) => s + ind.subtotal, 0);
      const sumDiscount = res.payment_summary.industries.reduce((s, ind) => s + ind.discount_amount, 0);
      const sumTotal = res.payment_summary.industries.reduce((s, ind) => s + ind.total_amount, 0);
      assert.equal(sumSubtotal, res.payment_summary.subtotal);
      assert.equal(sumDiscount, res.payment_summary.discount_amount);
      assert.equal(sumTotal, res.payment_summary.total_amount);

      // Zero secret leakage check
      const jsonStr = JSON.stringify(res);
      assert.equal(jsonStr.includes('SECRET_BANK'), false);
      assert.equal(jsonStr.includes('SECRET_PAYOS'), false);
      assert.equal(jsonStr.includes('PARENT_PROFILE'), false);
    });

    it('Missing root category name defaults to Chưa phân loại fallback', async () => {
      const mockOrdersRepo = {
        async createPublicOrder({ input }) {
          return {
            id: 301,
            order_code: 'TP_NO_CAT',
            subtotal: 30000,
            discount_amount: 0,
            shipping_fee: 0,
            total: 30000,
            payment_status: 'unpaid',
            status: 'Đang chuẩn bị',
          };
        },
      };

      const mockResolvePaymentProfile = async () => ({
        mode: 'single',
        profile: { code: 'DEFAULT_PROFILE' },
        rootCategory: null,
      });

      const service = createCustomerOrderService({
        repository: mockOrdersRepo,
        resolvePaymentProfile: mockResolvePaymentProfile,
        checkPayOSConfigured: () => false,
      });

      const res = await service.create({
        userId: 123,
        input: {
          store_id: 1,
          order_type: 'Take-away',
          payment_method: 'COD',
          customer_name: 'Nguyen Fallback',
          customer_phone: '0987654321',
          items: [{ product_id: 99, price: 30000, qty: 1 }],
        },
      });

      assert.equal(res.payment_summary.industries[0].root_category_name, 'Chưa phân loại');
    });

    it('Public Group Lookup via customerOrderService returns payment_summary with child orders by industry and sum invariants', async () => {
      const mockCheckoutGroupsRepo = {
        async findGroupForCustomerLookup(groupCode, { userId, cancelToken }) {
          if (groupCode !== 'GRP2609010001') return null;
          return {
            group_code: 'GRP2609010001',
            payment_status: 'unpaid',
            payment_provider: 'payos',
            subtotal: 100000,
            discount_amount: 15000,
            shipping_fee: 0,
            total_amount: 85000,
            payment_checkout_url: 'https://payos.vn/gate/grp',
            payment_qr_code: 'qr_grp',
            created_at: new Date().toISOString(),
            child_orders: [
              {
                order_id: '101',
                order_code: 'TP_CHILD_01',
                root_category_id: '1',
                root_category_name: 'Nước Uống',
                allocated_subtotal: 50000,
                allocated_discount: 7500,
                allocated_shipping_fee: 0,
                allocated_total: 42500,
                status: 'Đang chuẩn bị',
                payment_status: 'unpaid',
                items: [{ product_id: '1', product_name: 'Trà Sữa', quantity: 1, unit_price: 50000, line_total: 50000 }],
              },
              {
                order_id: '102',
                order_code: 'TP_CHILD_02',
                root_category_id: null,
                root_category_name: 'Chưa phân loại',
                allocated_subtotal: 50000,
                allocated_discount: 7500,
                allocated_shipping_fee: 0,
                allocated_total: 42500,
                status: 'Đang chuẩn bị',
                payment_status: 'unpaid',
                items: [{ product_id: '2', product_name: 'Bánh Mì', quantity: 1, unit_price: 50000, line_total: 50000 }],
              },
            ],
            payment_summary: {
              is_grouped: true,
              group_code: 'GRP2609010001',
              subtotal: 100000,
              discount_amount: 15000,
              shipping_fee: 0,
              total_amount: 85000,
              industries: [
                {
                  root_category_id: '1',
                  root_category_name: 'Nước Uống',
                  order_id: '101',
                  order_code: 'TP_CHILD_01',
                  subtotal: 50000,
                  discount_amount: 7500,
                  shipping_fee: 0,
                  total_amount: 42500,
                  status: 'Đang chuẩn bị',
                  payment_status: 'unpaid',
                  items: [{ product_id: '1', product_name: 'Trà Sữa', quantity: 1, unit_price: 50000, line_total: 50000 }],
                },
                {
                  root_category_id: null,
                  root_category_name: 'Chưa phân loại',
                  order_id: '102',
                  order_code: 'TP_CHILD_02',
                  subtotal: 50000,
                  discount_amount: 7500,
                  shipping_fee: 0,
                  total_amount: 42500,
                  status: 'Đang chuẩn bị',
                  payment_status: 'unpaid',
                  items: [{ product_id: '2', product_name: 'Bánh Mì', quantity: 1, unit_price: 50000, line_total: 50000 }],
                },
              ],
            },
          };
        },
      };

      const service = createCustomerOrderService({
        checkoutGroupsRepo: mockCheckoutGroupsRepo,
        repository: {},
      });

      const res = await service.lookup({ code: 'GRP2609010001', userId: 123 });
      assert.ok(res.group, 'Must return group object');
      assert.equal(res.group.group_code, 'GRP2609010001');
      assert.ok(res.group.payment_summary, 'Must return payment_summary');
      assert.equal(res.group.payment_summary.is_grouped, true);
      assert.equal(res.group.payment_summary.industries.length, 2);

      // Verify industries fallback and items
      const ind1 = res.group.payment_summary.industries[0];
      assert.equal(ind1.root_category_name, 'Nước Uống');
      assert.equal(ind1.items[0].product_name, 'Trà Sữa');

      const ind2 = res.group.payment_summary.industries[1];
      assert.equal(ind2.root_category_name, 'Chưa phân loại');
      assert.equal(ind2.items[0].product_name, 'Bánh Mì');

      // Verify sum invariants
      const sumSubtotal = res.group.payment_summary.industries.reduce((s, i) => s + i.subtotal, 0);
      const sumDiscount = res.group.payment_summary.industries.reduce((s, i) => s + i.discount_amount, 0);
      const sumTotal = res.group.payment_summary.industries.reduce((s, i) => s + i.total_amount, 0);
      assert.equal(sumSubtotal, res.group.payment_summary.subtotal);
      assert.equal(sumDiscount, res.group.payment_summary.discount_amount);
      assert.equal(sumTotal, res.group.payment_summary.total_amount);
    });

    it('Public lookup boundary strictly protects bank accounts, profile codes and PayOS keys', async () => {
      const mockOrdersRepo = {
        async findPublicOrder(code) {
          return {
            id: 888,
            order_code: code,
            store_name: 'Store 1',
            order_type: 'Take-away',
            payment_method: 'VietQR',
            payment_status: 'paid',
            payment_provider: 'payos',
            subtotal: 60000,
            discount_amount: 0,
            total: 60000,
            root_category_id: 1,
            root_category_name: 'Nước Uống',
            secret_bank_account: '999988887777',
            payment_profile_code: 'SECRET_PROFILE_CODE',
            payos_api_key: 'PAYOS_API_SECRET_KEY',
          };
        },
        async loadPublicDetails() {
          return [{ product_id: '1', product_name: 'Trà Đào', unit_price: 60000, qty: 1, line_total: 60000 }];
        },
        async loadStatusHistory() {
          return [{ status: 'Hoàn thành', note: null, created_at: new Date().toISOString() }];
        },
      };

      const service = createCustomerOrderService({
        repository: mockOrdersRepo,
      });

      const res = await service.lookup({ code: 'TP2609018888', userId: 123 });
      assert.ok(res.order);
      assert.ok(res.order.payment_summary);
      assert.equal(res.order.payment_summary.industries.length, 1);
      assert.equal(res.order.payment_summary.industries[0].root_category_name, 'Nước Uống');

      const jsonStr = JSON.stringify(res);
      assert.equal(jsonStr.includes('999988887777'), false, 'Bank account must not be present in public lookup');
      assert.equal(jsonStr.includes('SECRET_PROFILE_CODE'), false, 'Profile code must not be present in public lookup');
      assert.equal(jsonStr.includes('PAYOS_API_SECRET_KEY'), false, 'PayOS API keys must not be present in public lookup');
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 10: Payment Profile Purpose, ENV Status & Disabled Defaults Suite
  // ═════════════════════════════════════════════════════════════════
  describe('Gate 10: Payment Profile Purpose, ENV Status & Disabled Defaults Contract', () => {
    it('createProfile creates profile with status=disabled, stores purpose, and rejects active without ENV', async () => {
      const mockDatabase = {
        async query(sql, params) {
          if (sql.includes('SELECT id FROM payment_profiles WHERE code')) {
            return [[]]; // Not exists
          }
          if (sql.includes('FROM categories')) {
            return [[{ id: 7, name: 'Thoi Trang', slug: 'thoi-trang', parent_id: null, depth: 0 }]];
          }
          if (sql.includes('INSERT INTO payment_profiles')) {
            return [[{
              id: 501,
              code: params[0],
              display_name: params[1],
              purpose: params[2],
              env_prefix: params[3],
              status: 'disabled',
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]];
          }
          return [[]];
        },
      };

      const repo = createPaymentProfilesRepository(mockDatabase);
      const created = await repo.createProfile({
        code: 'THOI_TRANG_DEFAULT',
        displayName: 'Thời Trang Hưng',
        purpose: 'industry',
        rootCategoryId: 7,
      });

      assert.equal(created.status, 'disabled', 'New profile must default to disabled status');
      assert.equal(created.purpose, 'industry');
      assert.equal(created.code, 'THOI_TRANG_DEFAULT');
      assert.equal(created.assigned_categories[0].category_id, 7);

      // Attempt to activate without configured ENV must throw ENV_NOT_CONFIGURED error
      const mockTxDb = {
        async transaction(cb) {
          return cb({
            async query(sql) {
              if (sql.includes('SELECT * FROM payment_profiles WHERE id')) {
                return [[{
                  id: 501,
                  code: 'THOI_TRANG',
                  display_name: 'Thời Trang Hưng',
                  purpose: 'industry',
                  env_prefix: 'PAYOS_PROFILE_THOI_TRANG',
                  status: 'disabled',
                  version: 1,
                }]];
              }
              return [[]];
            },
          });
        },
      };

      const repoTx = createPaymentProfilesRepository(mockTxDb);
      await assert.rejects(
        async () => {
          await repoTx.updateProfile(501, { status: 'active' });
        },
        (err) => err.code === 'ENV_NOT_CONFIGURED' || err.message.includes('chưa cấu hình đủ 3 biến môi trường'),
      );
    });

    it('Industry profile can be assigned to root category; grouped profile is strictly rejected', async () => {
      const mockTxDb = {
        async transaction(cb) {
          return cb({
            async query(sql, params) {
              if (sql.includes('SELECT id, parent_id, depth, name FROM categories')) {
                return [[{ id: 1, parent_id: null, depth: 0, name: 'Thời Trang' }]];
              }
              if (sql.includes('SELECT id, code, display_name, purpose, status FROM payment_profiles')) {
                const profileId = params[0];
                if (profileId === 10) {
                  return [[{ id: 10, code: 'IND_01', display_name: 'Industry Profile', purpose: 'industry', status: 'active' }]];
                }
                if (profileId === 20) {
                  return [[{ id: 20, code: 'GRP_01', display_name: 'Group Profile', purpose: 'grouped_checkout', status: 'active' }]];
                }
              }
              if (sql.includes('INSERT INTO category_payment_profiles')) {
                return [[{ id: 99, root_category_id: 1, payment_profile_id: 10, is_active: true }]];
              }
              return [[]];
            },
          });
        },
      };

      const repo = createPaymentProfilesRepository(mockTxDb);

      // Industry profile succeeds
      const assigned = await repo.assignProfileToRootCategory({ rootCategoryId: 1, profileId: 10 });
      assert.equal(assigned.profile_code, 'IND_01');

      // Grouped profile fails with INVALID_PROFILE_PURPOSE
      await assert.rejects(
        async () => {
          await repo.assignProfileToRootCategory({ rootCategoryId: 1, profileId: 20 });
        },
        (err) => err.code === 'INVALID_PROFILE_PURPOSE' || err.message.includes('Chỉ payment profile có mục đích "industry"'),
      );
    });

    it('Multi-industry checkout uses grouped profile only for distinct resolved profiles', async () => {
      process.env.PAYOS_PROFILE_GROUP_CHECKOUT_CLIENT_ID = 'test-client';
      process.env.PAYOS_PROFILE_GROUP_CHECKOUT_API_KEY = 'test-api-key';
      process.env.PAYOS_PROFILE_GROUP_CHECKOUT_CHECKSUM_KEY = 'test-checksum-key';
      for (const prefix of ['PAYOS_PROFILE_NUOC_UONG_DEFAULT', 'PAYOS_PROFILE_THOI_TRANG_DEFAULT']) {
        process.env[`${prefix}_CLIENT_ID`] = 'test-client';
        process.env[`${prefix}_API_KEY`] = 'test-api-key';
        process.env[`${prefix}_CHECKSUM_KEY`] = 'test-checksum-key';
      }

      const mockDb = {
        async query(sql) {
          if (sql.includes('FROM products p')) {
            return [[
              { product_id: 1, product_name: 'Trà', price: 30000, category_id: 1, root_category_id: 1, root_category_name: 'Nước', root_category_slug: 'nuoc' },
              { product_id: 2, product_name: 'Áo', price: 150000, category_id: 2, root_category_id: 2, root_category_name: 'Thời Trang', root_category_slug: 'thoi-trang' },
            ]];
          }
          return [[]];
        },
      };

      // 1. When active grouped profile is present and configured
      const mockProfilesRepoSuccess = {
        async getMappedProfileByRootCategoryId(rootCategoryId) {
          return {
            id: rootCategoryId,
            code: rootCategoryId === 1 ? 'NUOC_UONG_DEFAULT' : 'THOI_TRANG_DEFAULT',
            purpose: 'industry',
            status: 'active',
          };
        },
        async getActiveGroupedProfile() {
          return {
            id: 2,
            code: 'GROUP_CHECKOUT',
            display_name: 'Grouped Checkout',
            purpose: 'grouped_checkout',
            status: 'active',
            is_env_configured: true,
          };
        },
      };

      const resolved = await resolvePaymentProfileForCart({
        storeId: 1,
        items: [{ product_id: 1, qty: 1 }, { product_id: 2, qty: 1 }],
        database: mockDb,
        profilesRepo: mockProfilesRepoSuccess,
      });

      assert.equal(resolved.isGrouped, true);
      assert.equal(resolved.profile.code, 'GROUP_CHECKOUT');
      assert.equal(resolved.rootGroups.length, 2);

      // 2. When no active grouped profile is present
      const mockProfilesRepoMissing = {
        async getMappedProfileByRootCategoryId(rootCategoryId) {
          return {
            id: rootCategoryId,
            code: rootCategoryId === 1 ? 'NUOC_UONG_DEFAULT' : 'THOI_TRANG_DEFAULT',
            purpose: 'industry',
            status: 'active',
          };
        },
        async getActiveGroupedProfile() {
          return null;
        },
        async getProfileByCode() {
          return null;
        },
      };

      await assert.rejects(
        async () => {
          await resolvePaymentProfileForCart({
            storeId: 1,
            items: [{ product_id: 1, qty: 1 }, { product_id: 2, qty: 1 }],
            database: mockDb,
            profilesRepo: mockProfilesRepoMissing,
          });
        },
        (err) => err.code === 'GROUPED_PAYMENT_PROFILE_UNAVAILABLE' || err.message.includes('Chưa có tài khoản thanh toán gộp'),
      );
    });

    it('Strictly prohibits disabling the last active grouped profile', async () => {
      const mockTxDb = {
        async transaction(cb) {
          return cb({
            async query(sql) {
              if (sql.includes('SELECT * FROM payment_profiles WHERE id = $1 FOR UPDATE')) {
                return [[{
                  id: 1,
                  code: 'LONG_GROUPED_CHECKOUT',
                  display_name: 'Long Grouped',
                  purpose: 'grouped_checkout',
                  status: 'active',
                }]];
              }
              if (sql.includes('SELECT id FROM payment_profiles WHERE purpose = \'grouped_checkout\' AND status = \'active\' AND id <> $1')) {
                return [[]]; // No other active grouped profile exists!
              }
              return [[]];
            },
          });
        },
      };

      const repo = createPaymentProfilesRepository(mockTxDb);
      await assert.rejects(
        async () => {
          await repo.updateProfile(1, { status: 'disabled' });
        },
        (err) => err.code === 'CANNOT_DISABLE_LAST_GROUPED_PROFILE' || err.message.includes('Không thể tắt tài khoản thanh toán gộp duy nhất'),
      );
    });
  });
});
