import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentProfilesRepository, maskAccountNumber, generateEnvPrefix } from '../repositories/postgres/payment-profiles.js';
import { createCheckoutGroupsRepository } from '../repositories/postgres/checkout-groups.js';
import {
  resolvePaymentProfileForCart,
  allocateVoucherDiscount,
} from '../services/payment-profiles/payment-profile-resolver.js';
import { requireSuperAdmin } from '../routes/admin/payment-profiles.js';
import { createCustomerOrderService } from '../services/orders/customer-order-service.js';

test('Payment Profiles & Grouped Checkout Comprehensive Acceptance Suite', async (t) => {
  await t.test('Gate 1 & 2: RBAC & Secret Safety', async () => {
    // 1. Super Admin Middleware Check
    let allowed = false;
    const reqSuper = { user: { id: 1, role: 'super_admin' } };
    const resMock = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    requireSuperAdmin(reqSuper, resMock, () => {
      allowed = true;
    });
    assert.equal(allowed, true, 'super_admin must be allowed through');

    // 2. Manager / Branch Admin role is strictly forbidden (403)
    let managerAllowed = false;
    const reqManager = { user: { id: 2, role: 'manager' } };
    const resManager = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    requireSuperAdmin(reqManager, resManager, () => {
      managerAllowed = true;
    });
    assert.equal(managerAllowed, false, 'manager must be rejected');
    assert.equal(resManager.statusCode, 403, 'manager must receive 403 Forbidden');

    // 3. Masking & ENV prefix generation
    assert.equal(maskAccountNumber('0987654321'), '******4321');
    assert.equal(maskAccountNumber('1234'), '1234');
    assert.equal(generateEnvPrefix('nuoc_hieu'), 'PAYOS_PROFILE_NUOC_HIEU');
    assert.equal(generateEnvPrefix('LONG_GROUPED_CHECKOUT'), 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT');
  });

  await t.test('Gate 5: Voucher Rounding & Exact Remainder Allocation', async () => {
    // 3 categories with subtotals 33,333, 33,333, and 33,334 (Total: 100,000)
    // Voucher discount: 10,000 (10%)
    const rootGroups = [
      { rootCategoryId: 1, rootCategoryName: 'Ngành A', rootCategorySlug: 'nganh-a', subtotal: 33333, items: [] },
      { rootCategoryId: 2, rootCategoryName: 'Ngành B', rootCategorySlug: 'nganh-b', subtotal: 33333, items: [] },
      { rootCategoryId: 3, rootCategoryName: 'Ngành C', rootCategorySlug: 'nganh-c', subtotal: 33334, items: [] },
    ];

    const result = allocateVoucherDiscount({
      rootGroupsWithSubtotal: rootGroups,
      voucherDiscount: 10000,
      shippingFee: 15000,
    });

    assert.equal(result.subtotal, 100000);
    assert.equal(result.discountAmount, 10000);
    assert.equal(result.shippingFee, 15000);

    const sumAllocatedDiscount = result.allocations.reduce((sum, a) => sum + a.allocatedDiscount, 0);
    assert.equal(sumAllocatedDiscount, 10000, 'Sum of allocated discounts must strictly equal group voucher discount (10,000)');

    const sumAllocatedTotal = result.allocations.reduce((sum, a) => sum + a.allocatedTotal, 0);
    const expectedTotal = 100000 - 10000 + 15000;
    assert.equal(sumAllocatedTotal, expectedTotal, 'Sum of allocated totals must strictly equal grand total');

    // Verify individual allocations
    assert.equal(result.allocations[0].allocatedDiscount, 3333);
    assert.equal(result.allocations[1].allocatedDiscount, 3333);
    assert.equal(result.allocations[2].allocatedDiscount, 3334, 'Last allocation takes the 1-dong remainder');
  });

  await t.test('Gate 3, 4, 6: Cart Payment Profile Resolver (Single Industry vs Multi-industry vs Fallback)', async () => {
    const mockDb = {
      async query(sql, params) {
        // Mock product to category lookup
        if (sql.includes('FROM products p')) {
          const productIds = params[0];
          const rows = [];
          for (const pid of productIds) {
            if (pid === 101) {
              // Nuoc Uong
              rows.push({
                product_id: 101,
                product_name: 'Trà Sữa Oolong',
                price: 35000,
                category_id: 11,
                category_name: 'Trà Sữa',
                depth: 1,
                parent_id: 1,
                root_category_id: 1,
                root_category_name: 'Nước Uống',
                root_category_slug: 'nuoc-uong',
              });
            } else if (pid === 102) {
              // Nuoc Uong
              rows.push({
                product_id: 102,
                product_name: 'Cà Phê Sữa',
                price: 30000,
                category_id: 12,
                category_name: 'Cà Phê',
                depth: 1,
                parent_id: 1,
                root_category_id: 1,
                root_category_name: 'Nước Uống',
                root_category_slug: 'nuoc-uong',
              });
            } else if (pid === 201) {
              // Thoi Trang
              rows.push({
                product_id: 201,
                product_name: 'Áo Phông Cotton',
                price: 150000,
                category_id: 21,
                category_name: 'Áo Nam',
                depth: 1,
                parent_id: 2,
                root_category_id: 2,
                root_category_name: 'Thời Trang',
                root_category_slug: 'thoi-trang',
              });
            }
          }
          return [rows];
        }
        return [[]];
      },
    };

    const mockProfilesRepo = {
      async getActiveProfileByRootCategoryId(rootId) {
        if (rootId === 1) {
          return {
            id: 10,
            code: 'NUOC_HIEU',
            display_name: 'Nước Uống - Hiếu',
            env_prefix: 'PAYOS_PROFILE_NUOC_HIEU',
            status: 'active',
            version: 1,
            bank_name: 'MB Bank',
            account_number: '0987654321',
          };
        }
        return null;
      },
      async getProfileByCode(code) {
        if (code === 'LONG_GROUPED_CHECKOUT') {
          return {
            id: 1,
            code: 'LONG_GROUPED_CHECKOUT',
            display_name: 'Long - Grouped Checkout',
            env_prefix: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT',
            status: 'active',
            version: 1,
            bank_name: 'Vietcombank',
            account_number: '1122334455',
          };
        }
        return null;
      },
    };

    // 1. Single Industry: Cart with only Nuoc Uong items -> NUOC_HIEU
    const singleCart = [{ product_id: 101, qty: 2 }, { product_id: 102, qty: 1 }];
    const singleResolved = await resolvePaymentProfileForCart({
      storeId: 1,
      items: singleCart,
      database: mockDb,
      profilesRepo: mockProfilesRepo,
    });

    assert.equal(singleResolved.isGrouped, false);
    assert.equal(singleResolved.profile.code, 'NUOC_HIEU');
    assert.equal(singleResolved.rootCategory.rootCategoryName, 'Nước Uống');

    // 2. Multi-industry: Cart with Nuoc Uong + Thoi Trang -> LONG_GROUPED_CHECKOUT
    const mixedCart = [{ product_id: 101, qty: 1 }, { product_id: 201, qty: 1 }];
    const mixedResolved = await resolvePaymentProfileForCart({
      storeId: 1,
      items: mixedCart,
      database: mockDb,
      profilesRepo: mockProfilesRepo,
    });

    assert.equal(mixedResolved.isGrouped, true);
    assert.equal(mixedResolved.profile.code, 'LONG_GROUPED_CHECKOUT');
    assert.equal(mixedResolved.rootGroups.length, 2);

    // 3. Fallback: Cart with unmapped root category (Thoi Trang only) -> Falls back to Long with isFallback = true
    const unmappedCart = [{ product_id: 201, qty: 2 }];
    const fallbackResolved = await resolvePaymentProfileForCart({
      storeId: 1,
      items: unmappedCart,
      database: mockDb,
      profilesRepo: mockProfilesRepo,
    });

    assert.equal(fallbackResolved.isGrouped, false);
    assert.equal(fallbackResolved.isFallback, true);
    assert.equal(fallbackResolved.profile.code, 'LONG_GROUPED_CHECKOUT');
  });

  await t.test('Gate 4 & 7: Customer Order Service Grouped Flow and Snapshot Creation', async () => {
    const createdOrders = [];
    const mockRepo = {
      async createPublicOrder(args) {
        const order = {
          id: createdOrders.length + 1,
          order_code: `TP20260901${createdOrders.length + 1}`,
          subtotal: 50000,
          total: 50000,
          payment_status: 'unpaid',
          root_category_id: args.rootCategoryId,
          payment_profile_code: args.paymentProfile?.code,
        };
        createdOrders.push(order);
        return order;
      },
    };

    let groupCreated = null;
    const mockCheckoutGroupsRepo = {
      async createCheckoutGroup(args) {
        groupCreated = {
          id: 1,
          group_code: 'GRP123456',
          total_amount: args.totalAmount,
          allocations: args.allocations,
          payment_profile_code: args.paymentProfile.code,
        };
        return groupCreated;
      },
      async reservePayOSCheckoutGroup() {
        return { payos_order_code: 9876543210, payment_expires_at: new Date() };
      },
      async attachPaymentLinkToGroup(args) {
        return {
          payment_link_id: args.paymentLinkId,
          payos_order_code: args.payosOrderCode,
          payment_expires_at: args.paymentExpiresAt,
        };
      },
    };

    const mockResolveProfile = async () => ({
      isGrouped: true,
      profile: { code: 'LONG_GROUPED_CHECKOUT', version: 1, bank_name: 'VCB' },
      rootGroups: [
        { rootCategoryId: 1, rootCategoryName: 'Nước Uống', rootCategorySlug: 'nuoc-uong', items: [{ product_id: 101, qty: 1 }] },
        { rootCategoryId: 2, rootCategoryName: 'Thời Trang', rootCategorySlug: 'thoi-trang', items: [{ product_id: 201, qty: 1 }] },
      ],
    });

    const orderService = createCustomerOrderService({
      repository: mockRepo,
      checkoutGroupsRepo: mockCheckoutGroupsRepo,
      resolvePaymentProfile: mockResolveProfile,
      checkPayOSConfigured: () => false, // COD mode
    });

    const result = await orderService.create({
      input: {
        store_id: 1,
        source: 'pos',
        order_type: 'Take-away',
        payment_method: 'COD',
        customer_name: 'Test Customer',
        customer_phone: '0901234567',
        items: [{ product_id: 101, qty: 1 }, { product_id: 201, qty: 1 }],
      },
    });

    assert.equal(result.is_grouped, true);
    assert.equal(result.group_code, 'GRP123456');
    assert.equal(result.child_orders.length, 2);
    assert.equal(createdOrders[0].payment_profile_code, 'LONG_GROUPED_CHECKOUT');
    assert.equal(createdOrders[1].payment_profile_code, 'LONG_GROUPED_CHECKOUT');
    assert.equal(groupCreated.payment_profile_code, 'LONG_GROUPED_CHECKOUT');
  });
});
