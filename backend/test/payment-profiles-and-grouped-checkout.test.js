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
import { isPayOSConfigured } from '../services/payos.js';

describe('Payment Profiles & Grouped Checkout Comprehensive Acceptance Suite (Round 2)', () => {

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
  // R1: Subtotal & Voucher Verification uses true DB prices (never trusting client item price)
  // ═════════════════════════════════════════════════════════════════
  it('R1: Grouped Checkout computes subtotal, voucher and allocation from DB prices, ignoring client price spoofing', async () => {
    let orderCreateCount = 0;
    const mockOrdersRepo = {
      async createPublicOrder({ input, rootCategoryId, paymentProfile }, { tx } = {}) {
        orderCreateCount++;
        const subtotal = input.items.reduce((s, it) => s + (50000 * it.qty), 0); // DB price is 50,000
        const discount = input.allocatedDiscount || 0;
        return {
          id: orderCreateCount,
          order_code: `TP20260901${orderCreateCount}`,
          subtotal,
          discount_amount: discount,
          total: subtotal - discount,
          root_category_id: rootCategoryId,
          payment_profile_code: paymentProfile?.code,
        };
      },
    };

    let createdGroupData = null;
    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(data, { tx } = {}) {
        createdGroupData = data;
        return {
          id: 1,
          group_code: 'GRP123456',
          total_amount: data.totalAmount,
          subtotal: data.subtotal,
          discount_amount: data.discountAmount,
          voucher_code: data.voucherCode,
          payment_profile_code: data.paymentProfile.code,
          allocations: data.allocations,
        };
      },
      async reservePayOSCheckoutGroup() {
        return { payos_order_code: 999888, payment_expires_at: new Date() };
      },
      async attachPaymentLinkToGroup() {
        return { payment_link_id: 'plink_123', payos_order_code: 999888, payment_expires_at: new Date() };
      },
    };

    let validatedSubtotal = 0;
    const mockPromotionsRepo = {
      async validateForOrder({ code, subtotal }) {
        validatedSubtotal = subtotal;
        return {
          id: 99,
          code,
          discount_amount: 10000,
          phone: '0987654321',
        };
      },
      async consumeForOrder() {},
    };

    const mockResolvePaymentProfile = async () => ({
      isGrouped: true,
      profile: {
        id: 1,
        code: 'LONG_GROUPED_CHECKOUT',
        display_name: 'Long - Grouped Checkout',
        version: 1,
      },
      rootGroups: [
        { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc', items: [{ product_id: 1, price: 1, qty: 1 }] },
        { rootCategoryId: 2, rootCategoryName: 'Thời Trang', rootCategorySlug: 'ao', items: [{ product_id: 2, price: 1, qty: 1 }] },
      ],
    });

    const mockDb = {
      async transaction(cb) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('SELECT price FROM products')) {
              return [[{ price: 50000 }]];
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
      checkPayOSConfigured: () => false,
      database: mockDb,
    });

    // Client maliciously sends price: 1 for items that are actually 50k
    const result = await service.create({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0987654321',
        items: [
          { product_id: 1, price: 1, qty: 1 },
          { product_id: 2, price: 1, qty: 1 },
        ],
        voucher_code: 'SALE10K',
      },
      userId: 123,
    });

    // Subtotal must be 100,000 (from DB 50k + 50k), voucher validated on 100,000, and total = 90,000
    assert.equal(validatedSubtotal, 100000);
    assert.equal(createdGroupData.subtotal, 100000);
    assert.equal(createdGroupData.discountAmount, 10000);
    assert.equal(createdGroupData.totalAmount, 90000);
    assert.equal(result.total_amount, 90000);
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
    // Owner passes
    assert.equal(verifyGroupOwnership(userGroup, { userId: 100 }), true);
    // Anonymous fails with 401
    assert.throws(() => verifyGroupOwnership(userGroup, { userId: null }), (err) => err.status === 401);
    // Different user fails with 403
    assert.throws(() => verifyGroupOwnership(userGroup, { userId: 999 }), (err) => err.status === 403);

    // 2. Guest Group checks
    // Correct cancel token passes
    assert.equal(verifyGroupOwnership(guestGroup, { cancelToken: rawToken }), true);
    // Missing cancel token fails with 401
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: null }), (err) => err.status === 401);
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: '' }), (err) => err.status === 401);
    // Invalid cancel token fails with 403
    assert.throws(() => verifyGroupOwnership(guestGroup, { cancelToken: 'wrong-token' }), (err) => err.status === 403);
  });

  // ═════════════════════════════════════════════════════════════════
  // R4: Group-Level Idempotency Replay
  // ═════════════════════════════════════════════════════════════════
  it('R4: Group-Level Idempotency returns existing group without creating duplicate orders or consuming vouchers', async () => {
    let orderCreateCount = 0;
    let voucherConsumeCount = 0;

    const idempotencyStore = new Map();

    const mockDb = {
      async transaction(cb) {
        const tx = {
          async query(sql, params) {
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
        return {
          id: 1,
          group_code: 'GRP_IDEMPOTENT_1',
          total_amount: data.totalAmount,
          subtotal: data.subtotal,
          discount_amount: 0,
          payment_profile_code: data.paymentProfile.code,
          allocations: data.allocations,
        };
      },
      async reservePayOSCheckoutGroup() {
        return null;
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
      checkPayOSConfigured: () => false,
      database: mockDb,
    });

    const requestPayload = {
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0987654321',
        items: [{ product_id: 1, price: 50000, qty: 1 }, { product_id: 2, price: 50000, qty: 1 }],
      },
      userId: 123,
      idempotencyKey: 'IDEM_GRP_KEY_123',
    };

    // First call: creates group and child orders
    const res1 = await service.create(requestPayload);
    assert.equal(res1.group_code, 'GRP_IDEMPOTENT_1');
    assert.equal(orderCreateCount, 2);

    // Second call with same idempotency key: returns replay without creating new orders
    const res2 = await service.create(requestPayload);
    assert.equal(res2.group_code, 'GRP_IDEMPOTENT_1');
    assert.equal(orderCreateCount, 2); // Count remains 2
  });

  // ═════════════════════════════════════════════════════════════════
  // R5: Fallback Distinction & Infrastructure Failure
  // ═════════════════════════════════════════════════════════════════
  it('R5: DB Query errors throw 500 without silently falling back to Long profile', async () => {
    const brokenDb = {
      async query() {
        throw new Error('PostgreSQL connection timeout ETIMEDOUT');
      },
    };

    // Resolver must rethrow the database error rather than swallowing it
    await assert.rejects(
      async () => {
        await resolvePaymentProfileForCart({
          storeId: 1,
          items: [{ product_id: 101, qty: 1 }],
          database: brokenDb,
        });
      },
      (err) => err.message.includes('ETIMEDOUT'),
    );
  });
});
