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

describe('Payment Profiles & Grouped Checkout Comprehensive Acceptance Suite (Round 3)', () => {

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
  it('B2 & B5: Resolver rejects unmapped product with 400 and records audit log on fallback', async () => {
    let auditLogInserted = false;
    const mockDb = {
      async query(sql, params) {
        if (sql.includes('FROM products p')) {
          // Only returns product 101, missing product 102
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

    // B5: Valid product with unmapped profile triggers fallback with audit log
    const mockProfilesRepo = {
      async getActiveProfileByRootCategoryId() {
        return null; // Unmapped root
      },
      async getProfileByCode() {
        return { id: 1, code: 'LONG_GROUPED_CHECKOUT', status: 'active', version: 1 };
      },
    };

    const resolved = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 101, qty: 1 }],
      database: mockDb,
      profilesRepo: mockProfilesRepo,
    });

    assert.equal(resolved.isFallback, true);
    assert.equal(resolved.profile.code, 'LONG_GROUPED_CHECKOUT');
    assert.equal(auditLogInserted, true);
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
  // B4: Group Idempotency & PayOS Retry Resume Flow
  // ═════════════════════════════════════════════════════════════════
  it('B4: Group Idempotency resume returns active usable PayOS link without creating duplicate child orders', async () => {
    let orderCreateCount = 0;
    let groupCreateCount = 0;
    let voucherConsumeCount = 0;

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
          group_code: 'GRP_IDEM_1',
          total_amount: data.totalAmount,
          subtotal: data.subtotal,
          discount_amount: 0,
          payment_profile_code: data.paymentProfile.code,
          allocations: data.allocations,
        };
      },
      async reservePayOSCheckoutGroup() {
        return { payos_order_code: 999111, payment_expires_at: new Date(Date.now() + 900_000) };
      },
      async attachPaymentLinkToGroup() {
        return { payment_link_id: 'link_111', payos_order_code: 999111, payment_expires_at: new Date() };
      },
      async renewGroupPayOSLink() {
        return {
          payment_checkout_url: 'https://payos.vn/gate/111',
          payment_qr_code: 'qr_111',
          payment_link_id: 'link_111',
          payos_order_code: 999111,
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
      idempotencyKey: 'IDEM_PAYOS_KEY_123',
    };

    setPayOSForTest({
      paymentRequests: {
        create: async () => ({
          checkoutUrl: 'https://payos.vn/gate/111',
          qrCode: 'qr_111',
          paymentLinkId: 'link_111',
        }),
      },
    });

    try {
      // First attempt creates group and orders
      const res1 = await service.create(requestPayload);
      assert.equal(res1.group_code, 'GRP_IDEM_1');
      assert.equal(orderCreateCount, 2);
      assert.equal(groupCreateCount, 1);

      // Second attempt with same idempotency key: returns usable link without creating duplicate orders or groups
      const res2 = await service.create(requestPayload);
      assert.equal(res2.group_code, 'GRP_IDEM_1');
      assert.equal(orderCreateCount, 2); // Unchanged!
      assert.equal(groupCreateCount, 1); // Unchanged!
    } finally {
      setPayOSForTest(null);
    }
  });
});
