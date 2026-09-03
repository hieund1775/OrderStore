import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePaymentProfileForCart } from '../services/payment-profiles/payment-profile-resolver.js';
import { createPaymentsRepository } from '../repositories/postgres/payments.js';
import { createCheckoutGroupsRepository } from '../repositories/postgres/checkout-groups.js';

function setProfileEnv(code) {
  const prefix = `PAYOS_PROFILE_${code}`;
  process.env[`${prefix}_CLIENT_ID`] = 'test-client';
  process.env[`${prefix}_API_KEY`] = 'test-api-key';
  process.env[`${prefix}_CHECKSUM_KEY`] = 'test-checksum-key';
}

function resolverDb(products) {
  return {
    async query(sql) {
      if (sql.includes('FROM products p')) return [products];
      return [[]];
    },
  };
}

describe('P0 payment routing and grouped-child safety', () => {
  it('routes multiple roots with one resolved destination profile directly', async () => {
    setProfileEnv('SHARED_PROFILE');
    const profile = { id: 7, code: 'SHARED_PROFILE', purpose: 'industry', status: 'active', version: 1 };
    const result = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 11, qty: 1 }, { product_id: 12, qty: 1 }],
      database: resolverDb([
        { product_id: 11, root_category_id: 1, root_category_name: 'Nuoc uong', root_category_slug: 'nuoc-uong' },
        { product_id: 12, root_category_id: 2, root_category_name: 'Thoi trang', root_category_slug: 'thoi-trang' },
      ]),
      profilesRepo: {
        async getMappedProfileByRootCategoryId() { return profile; },
        async getActiveFallbackProfile() { return null; },
      },
    });

    assert.equal(result.isGrouped, false);
    assert.equal(result.profile.code, 'SHARED_PROFILE');
    assert.equal(result.rootGroups.length, 2);
  });

  it('uses DEFAULT_PROFILE only for an unmapped root and rejects a mapped disabled profile', async () => {
    setProfileEnv('DEFAULT_PROFILE');
    const fallback = { id: 8, code: 'DEFAULT_PROFILE', purpose: 'fallback', status: 'active', version: 1 };
    const database = resolverDb([
      { product_id: 11, root_category_id: 1, root_category_name: 'Nuoc uong', root_category_slug: 'nuoc-uong' },
    ]);

    const fallbackResult = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 11, qty: 1 }],
      database,
      profilesRepo: {
        async getMappedProfileByRootCategoryId() { return null; },
        async getActiveFallbackProfile() { return fallback; },
      },
    });
    assert.equal(fallbackResult.profile.code, 'DEFAULT_PROFILE');

    await assert.rejects(
      () => resolvePaymentProfileForCart({
        storeId: 1,
        items: [{ product_id: 11, qty: 1 }],
        database,
        profilesRepo: {
          async getMappedProfileByRootCategoryId() {
            return { id: 9, code: 'DISABLED_INDUSTRY', purpose: 'industry', status: 'disabled', version: 1 };
          },
          async getActiveFallbackProfile() { return fallback; },
        },
      }),
      (error) => error.code === 'PAYMENT_PROFILE_UNAVAILABLE',
    );
  });

  it('requires GROUP_CHECKOUT only when resolved destination profiles differ', async () => {
    setProfileEnv('INDUSTRY_A');
    setProfileEnv('INDUSTRY_B');
    setProfileEnv('GROUP_CHECKOUT');
    const result = await resolvePaymentProfileForCart({
      storeId: 1,
      items: [{ product_id: 11, qty: 1 }, { product_id: 12, qty: 1 }],
      database: resolverDb([
        { product_id: 11, root_category_id: 1, root_category_name: 'Nuoc uong', root_category_slug: 'nuoc-uong' },
        { product_id: 12, root_category_id: 2, root_category_name: 'Thoi trang', root_category_slug: 'thoi-trang' },
      ]),
      profilesRepo: {
        async getMappedProfileByRootCategoryId(rootCategoryId) {
          return { id: rootCategoryId, code: rootCategoryId === 1 ? 'INDUSTRY_A' : 'INDUSTRY_B', purpose: 'industry', status: 'active', version: 1 };
        },
        async getActiveFallbackProfile() { return null; },
        async getActiveGroupedProfile() {
          return { id: 10, code: 'GROUP_CHECKOUT', purpose: 'grouped_checkout', status: 'active', version: 1 };
        },
      },
    });
    assert.equal(result.isGrouped, true);
    assert.equal(result.profile.code, 'GROUP_CHECKOUT');
    assert.deepEqual(result.rootGroups.map((group) => group.paymentProfile.code), ['INDUSTRY_A', 'INDUSTRY_B']);
  });

  it('rejects QR regeneration for a grouped child after ownership is verified', async () => {
    let createCalls = 0;
    const repo = createPaymentsRepository({
      transaction: async (callback) => callback({
        query: async (sql) => {
          if (sql.includes('FROM orders')) {
            return [[{
              id: 1,
              order_code: 'TP_CHILD',
              user_id: 99,
              total: 50000,
              payment_status: 'unpaid',
              payment_provider: 'payos',
              current_status: 'Đang chuẩn bị',
              checkout_group_id: 88,
              payment_profile_code: 'GROUP_CHECKOUT',
            }]];
          }
          return [[]];
        },
      }),
    });

    await assert.rejects(
      () => repo.renewPayOSOrderLink({
        orderCode: 'TP_CHILD',
        userId: 99,
        createLinkFn: async () => { createCalls += 1; return {}; },
      }),
      (error) => error.code === 'GROUP_CHILD_PAYMENT_MANAGED_BY_GROUP' && error.status === 409,
    );
    assert.equal(createCalls, 0);
  });

  it('persists original profile and allocated amount for every grouped allocation', async () => {
    const calls = [];
    const repo = createCheckoutGroupsRepository({
      transaction: async (callback) => callback({
        query: async (sql, params) => {
          calls.push({ sql, params });
          if (sql.includes('INSERT INTO checkout_groups')) return [[{ id: 22, group_code: 'GRP_SNAPSHOT' }]];
          return [[]];
        },
      }),
    });

    await repo.createCheckoutGroup({
      storeId: 1,
      subtotal: 50000,
      totalAmount: 50000,
      paymentProfile: { id: 3, code: 'GROUP_CHECKOUT', version: 1 },
      allocations: [{
        orderId: 101,
        rootCategoryId: 1,
        rootCategoryName: 'Nuoc uong',
        rootCategorySlug: 'nuoc-uong',
        allocatedSubtotal: 50000,
        allocatedDiscount: 0,
        allocatedShippingFee: 0,
        allocatedTotal: 50000,
        originalPaymentProfile: { id: 4, code: 'NUOC_UONG_DEFAULT', version: 2 },
      }],
    });

    const allocationInsert = calls.find((call) => call.sql.includes('INSERT INTO checkout_group_allocations'));
    const childUpdate = calls.find((call) => call.sql.includes('UPDATE orders'));
    assert.ok(allocationInsert.sql.includes('original_payment_profile_code'));
    assert.equal(allocationInsert.params.at(-2), 'NUOC_UONG_DEFAULT');
    assert.equal(allocationInsert.params.at(-1), 50000);
    assert.ok(childUpdate.sql.includes('group_allocated_amount'));
    assert.equal(childUpdate.params.at(-3), 'NUOC_UONG_DEFAULT');
    assert.equal(childUpdate.params.at(-2), 50000);
  });
});
