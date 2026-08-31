import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireSuperAdmin } from '../routes/admin/payment-profiles.js';
import {
  resolvePaymentProfileForCart,
  allocateVoucherDiscount,
} from '../services/payment-profiles/payment-profile-resolver.js';
import { createPaymentProfilesRepository, maskAccountNumber, generateEnvPrefix } from '../repositories/postgres/payment-profiles.js';
import { createCheckoutGroupsRepository, generateGroupCode } from '../repositories/postgres/checkout-groups.js';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';
import { isPayOSConfigured, getPayOS, setPayOSForTest } from '../services/payos.js';

describe('Payment Profiles & Grouped Checkout Comprehensive Acceptance Suite', () => {

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

    assert.equal(generateEnvPrefix('nuoc_hieu'), 'PAYOS_PROFILE_NUOC_HIEU');
    assert.equal(generateEnvPrefix('QUANAO-HUNG'), 'PAYOS_PROFILE_QUANAO_HUNG');
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 3: Decimal-Safe Pro-Rata Integer Remainder Allocation ($1 dong sink)
  // ═════════════════════════════════════════════════════════════════
  it('Gate 3: Decimal-Safe Pro-Rata Integer Remainder Allocation guarantees exact sum', () => {
    // 3 groups with subtotals: 100k, 100k, 100k (Total = 300k), Voucher = 50k (16666.66... each)
    const result1 = allocateVoucherDiscount({
      rootGroupsWithSubtotal: [
        { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc', subtotal: 100000 },
        { rootCategoryId: 2, rootCategoryName: 'Thời Trang', rootCategorySlug: 'thoi-trang', subtotal: 100000 },
        { rootCategoryId: 3, rootCategoryName: 'Mỹ Phẩm', rootCategorySlug: 'my-pham', subtotal: 100000 },
      ],
      voucherDiscount: 50000,
      shippingFee: 15000,
    });

    assert.equal(result1.subtotal, 300000);
    assert.equal(result1.discountAmount, 50000);
    assert.equal(result1.allocations.length, 3);

    // Integer allocation: Group 0: 16666, Group 1: 16666, Group 2 (remainder sink): 16668
    assert.equal(result1.allocations[0].allocatedDiscount, 16666);
    assert.equal(result1.allocations[1].allocatedDiscount, 16666);
    assert.equal(result1.allocations[2].allocatedDiscount, 16668);

    const sumDiscount = result1.allocations.reduce((sum, a) => sum + a.allocatedDiscount, 0);
    assert.equal(sumDiscount, 50000);

    const sumTotal = result1.allocations.reduce((sum, a) => sum + a.allocatedTotal, 0);
    assert.equal(sumTotal, 300000 - 50000 + 15000);
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 4: Single Profile Resolution vs Missing ENV Strict Fallback
  // ═════════════════════════════════════════════════════════════════
  it('Gate 4: Single Profile Resolution vs Strict Missing ENV Fallback (No silent legacy charge)', async () => {
    // Setup mock DB for product resolution
    const mockDb = {
      async query(sql, params) {
        return [[
          {
            product_id: 101,
            product_name: 'Trà Sữa Trân Châu',
            price: 35000,
            category_id: 10,
            depth: 1,
            parent_id: 1,
            root_category_id: 1,
            root_category_name: 'Nước Uống',
            root_category_slug: 'nuoc-uong',
          },
        ]];
      },
    };

    // Case 4A: Profile mapped but ENV missing -> Strictly falls back to LONG_GROUPED_CHECKOUT
    const mockRepoMissingEnv = {
      async getActiveProfileByRootCategoryId(rootId) {
        return {
          id: 10,
          code: 'NUOC_HIEU_UNCONFIGURED',
          display_name: 'Nước Uống Hiếu (Chưa ENV)',
          status: 'active',
          version: 1,
        };
      },
      async getProfileByCode(code) {
        return {
          id: 1,
          code: 'LONG_GROUPED_CHECKOUT',
          display_name: 'Long - Grouped Checkout',
          status: 'active',
          version: 1,
        };
      },
    };

    const resolvedFallback = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 101, qty: 1 }],
      database: mockDb,
      profilesRepo: mockRepoMissingEnv,
    });

    assert.equal(resolvedFallback.isGrouped, false);
    assert.equal(resolvedFallback.isFallback, true);
    assert.equal(resolvedFallback.profile.code, 'LONG_GROUPED_CHECKOUT');

    // Case 4B: Profile mapped and ENV configured -> Charges exact industry profile
    process.env.PAYOS_PROFILE_NUOC_HIEU_CLIENT_ID = 'test-client-id';
    process.env.PAYOS_PROFILE_NUOC_HIEU_API_KEY = 'test-api-key';
    process.env.PAYOS_PROFILE_NUOC_HIEU_CHECKSUM_KEY = 'test-checksum-key';

    const mockRepoConfigured = {
      async getActiveProfileByRootCategoryId(rootId) {
        return {
          id: 11,
          code: 'NUOC_HIEU',
          display_name: 'Nước Uống Hiếu',
          status: 'active',
          version: 1,
        };
      },
      async getProfileByCode(code) {
        return null;
      },
    };

    const resolvedConfigured = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 101, qty: 1 }],
      database: mockDb,
      profilesRepo: mockRepoConfigured,
    });

    assert.equal(resolvedConfigured.isGrouped, false);
    assert.equal(resolvedConfigured.isFallback, undefined);
    assert.equal(resolvedConfigured.profile.code, 'NUOC_HIEU');

    // Cleanup env
    delete process.env.PAYOS_PROFILE_NUOC_HIEU_CLIENT_ID;
    delete process.env.PAYOS_PROFILE_NUOC_HIEU_API_KEY;
    delete process.env.PAYOS_PROFILE_NUOC_HIEU_CHECKSUM_KEY;
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 5: Grouped Checkout Customer Order Service Flow & Voucher Consumption
  // ═════════════════════════════════════════════════════════════════
  it('Gate 5: Grouped Checkout validates and consumes voucher once and creates group snapshot', async () => {
    let orderCreateCount = 0;
    let groupCreateCount = 0;
    let voucherValidateCount = 0;
    let voucherConsumeCount = 0;

    const mockOrdersRepo = {
      async createPublicOrder({ input, rootCategoryId, paymentProfile }, { tx } = {}) {
        orderCreateCount++;
        return {
          id: orderCreateCount,
          order_code: `TP20260901${orderCreateCount}`,
          subtotal: input.items.reduce((s, it) => s + (it.price * it.qty), 0),
          discount_amount: input.allocatedDiscount || 0,
          total: input.items.reduce((s, it) => s + (it.price * it.qty), 0) - (input.allocatedDiscount || 0),
          root_category_id: rootCategoryId,
          payment_profile_code: paymentProfile?.code,
        };
      },
    };

    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(data, { tx } = {}) {
        groupCreateCount++;
        return {
          id: 1,
          group_code: 'GRP20260901111111',
          total_amount: data.totalAmount,
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

    const mockPromotionsRepo = {
      async validateForOrder({ code, subtotal }) {
        voucherValidateCount++;
        return {
          id: 99,
          code,
          discount_amount: 20000,
          phone: '0987654321',
        };
      },
      async consumeForOrder({ voucher, orderId }) {
        voucherConsumeCount++;
      },
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
        { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc', items: [{ product_id: 1, price: 50000, qty: 1 }] },
        { rootCategoryId: 2, rootCategoryName: 'Thời Trang', rootCategorySlug: 'ao', items: [{ product_id: 2, price: 50000, qty: 1 }] },
      ],
    });

    const mockDb = {
      async transaction(cb) {
        return cb({});
      },
    };

    const service = createCustomerOrderService({
      repository: mockOrdersRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      promotionsRepo: mockPromotionsRepo,
      resolvePaymentProfile: mockResolvePaymentProfile,
      checkPayOSConfigured: () => false, // COD path
      database: mockDb,
    });

    const result = await service.create({
      input: {
        store_id: 1,
        source: 'online',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Nguyen Van A',
        customer_phone: '0987654321',
        items: [{ product_id: 1, price: 50000, qty: 1 }, { product_id: 2, price: 50000, qty: 1 }],
        voucher_code: 'SALE20K',
      },
      userId: 123,
    });

    assert.equal(result.is_grouped, true);
    assert.equal(orderCreateCount, 2);
    assert.equal(groupCreateCount, 1);
    assert.equal(voucherValidateCount, 1);
    assert.equal(voucherConsumeCount, 1);
    assert.equal(result.total_amount, 80000); // 100k - 20k
  });

  // ═════════════════════════════════════════════════════════════════
  // Gate 6: Webhook Group Amount Verification & Idempotency
  // ═════════════════════════════════════════════════════════════════
  it('Gate 6: Webhook Group Amount Verification & CAS Idempotency', async () => {
    let groupUpdated = false;
    let childOrdersUpdated = false;
    let eventLogged = false;

    const mockDb = {
      async transaction(cb) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('INSERT INTO payment_events')) {
              eventLogged = true;
              return [[{ id: 1 }]];
            }
            if (sql.includes('SELECT id, group_code, total_amount')) {
              return [[{
                id: 10,
                group_code: 'GRP123456',
                total_amount: 150000,
                payment_status: 'unpaid',
              }]];
            }
            if (sql.includes('UPDATE checkout_groups')) {
              groupUpdated = true;
              return [[{ id: 10, group_code: 'GRP123456', total_amount: 150000 }]];
            }
            if (sql.includes('UPDATE orders')) {
              childOrdersUpdated = true;
              return [[{ id: 1 }]];
            }
            if (sql.includes('UPDATE payment_events')) {
              return [[]];
            }
            return [[]];
          },
        };
        return cb(tx);
      },
    };

    const repo = createCheckoutGroupsRepository(mockDb);

    // 1. Amount mismatch test
    const mismatchResult = await repo.processSuccessfulGroupWebhook({
      eventKey: 'evt_1',
      orderCode: 999111,
      amount: 100000, // Expected is 150000
      reference: 'ref_1',
    });
    assert.equal(mismatchResult.kind, 'amount_mismatch');
    assert.equal(groupUpdated, false);
    assert.equal(childOrdersUpdated, false);

    // 2. Exact amount test
    const exactResult = await repo.processSuccessfulGroupWebhook({
      eventKey: 'evt_2',
      orderCode: 999111,
      amount: 150000,
      reference: 'ref_2',
    });
    assert.equal(exactResult.kind, 'paid');
    assert.equal(groupUpdated, true);
    assert.equal(childOrdersUpdated, true);
  });
});
