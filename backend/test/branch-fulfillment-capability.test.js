import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchOfferService } from '../services/catalog/branch-offer-service.js';
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
