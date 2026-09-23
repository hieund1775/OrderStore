import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBranchOfferInput } from '../validation/branch-offer-schemas.js';

test('Branch Offer Price Validation Suite', async (t) => {
  await t.test('rejects empty price string, null or undefined', () => {
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1, price: '' }),
      (err) => err?.status === 400 && err.message.includes('không được để trống'),
    );
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1, price: null }),
      (err) => err?.status === 400 && err.message.includes('không được để trống'),
    );
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1 }),
      (err) => err?.status === 400 && err.message.includes('không được để trống'),
    );
  });

  await t.test('rejects price = 0, negative prices, or prices below 1,000đ', () => {
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1, price: 0 }),
      (err) => err?.status === 400 && err.message.includes('từ 1.000đ trở lên'),
    );
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1, price: -1000 }),
      (err) => err?.status === 400 && err.message.includes('từ 1.000đ trở lên'),
    );
    assert.throws(
      () => validateBranchOfferInput({ variant_id: 1, price: 999 }),
      (err) => err?.status === 400 && err.message.includes('từ 1.000đ trở lên'),
    );
  });

  await t.test('accepts valid integer prices >= 1,000đ', () => {
    const minOffer = validateBranchOfferInput({ variant_id: 1, price: 1000 });
    assert.equal(minOffer.price, 1000);

    const normalOffer = validateBranchOfferInput({ variant_id: 2, price: 35000 });
    assert.equal(normalOffer.price, 35000);
  });
});
