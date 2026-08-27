import { createBranchOffersRepository } from '../../repositories/postgres/branch-offers.js';
import { validateBranchOfferInput } from '../../validation/branch-offer-schemas.js';

export function createBranchOfferService(repository = createBranchOffersRepository()) {
  return {
    async listBranchOffers(storeId, filters) {
      if (!storeId || Number(storeId) <= 0) {
        throw new Error('store_id không hợp lệ');
      }
      return await repository.listBranchOffers(Number(storeId), filters);
    },

    async getBranchOffer(storeId, variantId) {
      return await repository.getBranchOffer(Number(storeId), Number(variantId));
    },

    async setBranchOffer(storeId, input) {
      if (!storeId || Number(storeId) <= 0) {
        throw new Error('store_id không hợp lệ');
      }
      const validated = validateBranchOfferInput(input);
      return await repository.upsertBranchOffer(Number(storeId), validated);
    },

    async batchSetAvailability(storeId, variantIds, isAvailable) {
      if (!storeId || Number(storeId) <= 0) {
        throw new Error('store_id không hợp lệ');
      }
      return await repository.batchSetAvailability(Number(storeId), variantIds, Boolean(isAvailable));
    },
  };
}
