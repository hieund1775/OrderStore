import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBranchOfferInput } from '../validation/branch-offer-schemas.js';
import { createBranchOfferService } from '../services/catalog/branch-offer-service.js';

test('Branch Offer Validation: strictly enforces valid variant ID and non-negative pricing', () => {
  const valid = validateBranchOfferInput({
    variant_id: 10,
    price: 45000,
    compare_at_price: 50000,
    is_available: true,
  });

  assert.equal(valid.variant_id, 10);
  assert.equal(valid.price, 45000);
  assert.equal(valid.compare_at_price, 50000);
  assert.equal(valid.is_available, true);

  // Rejects negative price
  assert.throws(
    () => validateBranchOfferInput({ variant_id: 10, price: -5000 }),
    /không âm/,
  );

  // Rejects invalid variant_id
  assert.throws(
    () => validateBranchOfferInput({ variant_id: 0, price: 45000 }),
    /số nguyên dương/,
  );
});

test('Branch Offer Service: delegates upsert to repository', async () => {
  const fakeRepo = {
    async getVariantFulfillmentContext() {
      return { variant_id: 20, fulfillment_lane: 'kitchen' };
    },
    async hasFulfillmentCapability() {
      return true;
    },
    async upsertBranchOffer(storeId, data) {
      return { id: 1, store_id: storeId, ...data };
    },
  };

  const service = createBranchOfferService(fakeRepo);
  const result = await service.setBranchOffer(1, {
    variant_id: 20,
    price: 35000,
    is_available: true,
  });

  assert.equal(result.store_id, 1);
  assert.equal(result.variant_id, 20);
  assert.equal(result.price, 35000);
});
