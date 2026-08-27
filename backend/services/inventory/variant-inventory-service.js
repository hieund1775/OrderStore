import { createVariantInventoryRepository } from '../../repositories/postgres/variant-inventory.js';
import { validateInventoryMovementInput } from '../../validation/variant-inventory-schemas.js';
import { CatalogV2Error } from '../../repositories/postgres/catalog-v2.js';

export function createVariantInventoryService(repository = createVariantInventoryRepository()) {
  return {
    async getInventoryBalance(storeId, variantId) {
      if (!storeId || Number(storeId) <= 0) throw new CatalogV2Error('store_id không hợp lệ', 400);
      return await repository.getInventoryBalance(Number(storeId), Number(variantId));
    },

    async adjustStock(storeId, input, context = {}) {
      if (!storeId || Number(storeId) <= 0) throw new CatalogV2Error('store_id không hợp lệ', 400);
      const validated = validateInventoryMovementInput(input);
      return await repository.recordMovement(Number(storeId), validated, context);
    },

    async listMovements(storeId, filters) {
      if (!storeId || Number(storeId) <= 0) throw new CatalogV2Error('store_id không hợp lệ', 400);
      return await repository.listMovements(Number(storeId), filters);
    },
  };
}
