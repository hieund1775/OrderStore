import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreService } from '../services/stores/store-service.js';
import { createAdminStoreService } from '../services/stores/admin-store-service.js';
import { createPromotionService } from '../services/promotions/promotion-service.js';
import { createAdminPromotionService } from '../services/promotions/admin-promotion-service.js';
import { createAdminInventoryService } from '../services/inventory/admin-inventory-service.js';

describe('Phase 3 Stores, Promotions & Inventory Service Unit Tests', () => {
  it('delegates store and promotion public service calls', async () => {
    const storeService = createStoreService({
      async listActiveStores() { return [{ id: 1 }]; },
      async listStoreDistricts() { return [{ district: 'Q1' }]; },
      async resolveTable(id) { return { id: Number(id) }; },
    });

    assert.equal((await storeService.listActiveStores()).length, 1);
    assert.equal((await storeService.resolveTable('3')).id, 3);
    assert.equal(await storeService.resolveTable(null), null);

    const promoService = createPromotionService({
      async listActivePromotions() { return [{ id: 10 }]; },
      async preview(input) { return { discount_amount: 15000 }; },
    });

    assert.equal((await promoService.listActivePromotions()).length, 1);
    assert.equal((await promoService.previewVoucher({ code: 'TEST' })).discount_amount, 15000);
  });

  it('delegates admin stores, promotions, and inventory mutations', async () => {
    let branchData = null;
    let promoData = null;
    let logData = null;

    const adminStore = createAdminStoreService({
      async listBranches() { return []; },
      async createBranch(data) { branchData = data; return { id: 1, ...data }; },
      async updateBranch(id, data) { return { id, ...data }; },
      async deleteBranch(id) { return true; },
      async listAllTables() { return []; },
      async createTable(data) { return { id: 1, ...data }; },
      async updateTable(id, data) { return { id, ...data }; },
      async deleteTable(id) { return true; },
    });

    await adminStore.createBranch({ name: 'Chi nhánh 1' });
    assert.equal(branchData.name, 'Chi nhánh 1');

    const adminPromo = createAdminPromotionService({
      async listPromotions() { return []; },
      async createPromotion(data) { promoData = data; return { id: 1, ...data }; },
      async updatePromotion(id, data) { return { id, ...data }; },
      async deletePromotion(id) { return true; },
    });

    await adminPromo.createPromotion({ title: 'Khuyến mãi hè' });
    assert.equal(promoData.title, 'Khuyến mãi hè');

    const adminInv = createAdminInventoryService({
      async listInventory() { return []; },
      async updateInventory(id, data) { return { id, ...data }; },
      async logInventory(id, data) { logData = data; return { id, ...data }; },
    });

    await adminInv.logInventory(2, { change_amount: 10, reason: 'Nhập kho' });
    assert.equal(logData.change_amount, 10);
  });
});
