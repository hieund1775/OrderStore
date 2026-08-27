import { createVariantInventoryRepository } from '../../repositories/postgres/variant-inventory.js';
import { validateInventoryMovementInput } from '../../validation/variant-inventory-schemas.js';

export function createVariantInventoryService(repository = createVariantInventoryRepository()) {
  return {
    async getInventoryBalance(storeId, variantId) {
      if (!storeId || Number(storeId) <= 0) throw new Error('store_id không hợp lệ');
      return await repository.getInventoryBalance(Number(storeId), Number(variantId));
    },

    async adjustStock(storeId, input, context = {}) {
      if (!storeId || Number(storeId) <= 0) throw new Error('store_id không hợp lệ');
      const validated = validateInventoryMovementInput(input);
      return await repository.recordMovement(Number(storeId), validated, context);
    },

    async listMovements(storeId, filters) {
      if (!storeId || Number(storeId) <= 0) throw new Error('store_id không hợp lệ');
      return await repository.listMovements(Number(storeId), filters);
    },
  };
}
