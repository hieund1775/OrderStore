import { createBranchOffersRepository } from '../../repositories/postgres/branch-offers.js';
import { validateBranchOfferInput } from '../../validation/branch-offer-schemas.js';
import { CatalogV2Error } from '../../repositories/postgres/catalog-v2.js';

export function createBranchOfferService(repository = createBranchOffersRepository()) {
  return {
    async listBranchOffers(storeId, filters) {
      if (!storeId || Number(storeId) <= 0) {
        throw new CatalogV2Error('store_id không hợp lệ', 400);
      }
      return await repository.listBranchOffers(Number(storeId), filters);
    },

    async getBranchOffer(storeId, variantId) {
      return await repository.getBranchOffer(Number(storeId), Number(variantId));
    },

    async setBranchOffer(storeId, input) {
      if (!storeId || Number(storeId) <= 0) {
        throw new CatalogV2Error('store_id không hợp lệ', 400);
      }
      const validated = validateBranchOfferInput(input);

      if (validated.is_available) {
        if (typeof repository.getVariantFulfillmentContext === 'function' && typeof repository.hasFulfillmentCapability === 'function') {
          const ctx = await repository.getVariantFulfillmentContext(validated.variant_id);
          if (ctx?.fulfillment_lane) {
            const hasCap = await repository.hasFulfillmentCapability(Number(storeId), ctx.fulfillment_lane);
            if (!hasCap) {
              const err = new CatalogV2Error(
                `Chi nhánh #${storeId} không hỗ trợ luồng vận hành "${ctx.fulfillment_lane}" cho sản phẩm này`,
                409,
              );
              err.code = 'BRANCH_CAPABILITY_REQUIRED';
              throw err;
            }
          }
        }
      }

      return await repository.upsertBranchOffer(Number(storeId), validated);
    },

    async batchSetAvailability(storeId, variantIds, isAvailable) {
      if (!storeId || Number(storeId) <= 0) {
        throw new CatalogV2Error('store_id không hợp lệ', 400);
      }
      if (!Array.isArray(variantIds) || variantIds.length === 0 || variantIds.length > 500) {
        throw new CatalogV2Error('variant_ids phải chứa từ 1 đến 500 SKU', 400);
      }
      const normalizedVariantIds = variantIds.map(Number);
      if (normalizedVariantIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new CatalogV2Error('variant_ids chứa mã SKU không hợp lệ', 400);
      }
      if (typeof isAvailable !== 'boolean') {
        throw new CatalogV2Error('is_available phải là boolean', 400);
      }
      return await repository.batchSetAvailability(
        Number(storeId),
        [...new Set(normalizedVariantIds)],
        isAvailable,
      );
    },
  };
}
