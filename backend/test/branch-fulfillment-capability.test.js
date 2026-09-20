import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchOfferService } from '../services/catalog/branch-offer-service.js';
import { createBranchOffersRepository } from '../repositories/postgres/branch-offers.js';
import { createFulfillmentCapabilitiesRepository } from '../repositories/postgres/fulfillment-capabilities.js';

test('Branch Fulfillment Capability & Offer Validation Suite', async (t) => {
  await t.test('branch lacking the resolved lane capability cannot enable a branch offer', async () => {
    let upsertCalled = false;
    const repository = {
      async getVariantFulfillmentContext(variantId) {
        assert.equal(variantId, 101);
        return { variant_id: 101, product_id: 20, fulfillment_lane: 'kitchen' };
      },
      async hasFulfillmentCapability(storeId, lane) {
        assert.equal(storeId, 2);
        assert.equal(lane, 'kitchen');
        return false;
      },
      async upsertBranchOffer() {
        upsertCalled = true;
        return { id: 1 };
      },
    };
    const service = createBranchOfferService(repository);

    await assert.rejects(
      () => service.setBranchOffer(2, {
        variant_id: 101,
        price: 35000,
        is_available: true,
      }),
      (err) => err?.status === 409 && err?.code === 'BRANCH_CAPABILITY_REQUIRED',
    );
    assert.equal(upsertCalled, false, 'Invalid offer must be rejected before it is persisted');
  });

  await t.test('hasFulfillmentCapability respects LEFT JOIN with default enabled when unseeded', async () => {
    let executedSql = '';
    let executedParams = [];
    const mockDb = {
      async query(sql, params) {
        executedSql = sql;
        executedParams = params;
        // Return 1 row representing matching active lane with COALESCE(bfc.is_enabled, TRUE) = TRUE
        return [[{ '?column?': 1 }]];
      },
    };
    const repo = createBranchOffersRepository(mockDb);
    const hasCap = await repo.hasFulfillmentCapability(1, 'packing');
    assert.equal(hasCap, true);
    assert.ok(executedSql.includes('fulfillment_lane_registry flr'));
    assert.ok(executedSql.includes('LEFT JOIN branch_fulfillment_capabilities bfc'));
    assert.ok(executedSql.includes('COALESCE(bfc.is_enabled, TRUE) = TRUE'));
    assert.deepEqual(executedParams, [1, 'packing']);
  });

  await t.test('listCapabilities defaults is_enabled to true when unseeded', async () => {
    let executedSql = '';
    const mockDb = {
      async query(sql) {
        executedSql = sql;
        return [[
          { lane_code: 'kitchen', display_name: 'Pha chế / Bếp', is_enabled: true },
          { lane_code: 'packing', display_name: 'Soạn hàng / Đóng gói', is_enabled: true },
        ]];
      },
    };
    const repo = createFulfillmentCapabilitiesRepository(mockDb);
    const caps = await repo.listCapabilities(1);
    assert.equal(caps.length, 2);
    assert.equal(caps[0].is_enabled, true);
    assert.equal(caps[1].is_enabled, true);
    assert.ok(executedSql.includes('COALESCE(bfc.is_enabled, TRUE) AS is_enabled'));
  });

  await t.test('disabling a capability with active offers reports blockers', async () => {
    const mockDb = {
      async query(sql) {
        if (sql.includes('countActiveOffersByLane') || sql.includes('COUNT(*)::int AS count') && sql.includes('branch_variant_offers')) {
          return [[{ count: 5 }]];
        }
        return [[]];
      },
    };
    const repo = createFulfillmentCapabilitiesRepository(mockDb);
    const count = await repo.countActiveOffersByLane(1, 'kitchen');
    assert.equal(count, 5);
  });

  await t.test('disabling a capability with active tasks reports blockers', async () => {
    const mockDb = {
      async query(sql) {
        if (sql.includes('fulfillment_tasks') && sql.includes('COUNT(*)::int AS count')) {
          return [[{ count: 3 }]];
        }
        return [[]];
      },
    };
    const repo = createFulfillmentCapabilitiesRepository(mockDb);
    const count = await repo.countPendingTasksByLane(1, 'kitchen');
    assert.equal(count, 3);
  });
});
