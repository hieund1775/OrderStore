import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInventoryMovementInput } from '../validation/variant-inventory-schemas.js';
import { createVariantInventoryService } from '../services/inventory/variant-inventory-service.js';

test('Variant Inventory Validation: enforces valid movement types, quantity, and reason', () => {
  const valid = validateInventoryMovementInput({
    variant_id: 15,
    movement_type: 'receive',
    quantity: 100,
    reason: 'Nhập hàng đợt 1 từ kho tổng',
  });

  assert.equal(valid.variant_id, 15);
  assert.equal(valid.movement_type, 'receive');
  assert.equal(valid.quantity, 100);
  assert.equal(valid.reason, 'Nhập hàng đợt 1 từ kho tổng');

  // Rejects invalid movement type
  assert.throws(
    () =>
      validateInventoryMovementInput({
        variant_id: 15,
        movement_type: 'magic_create',
        quantity: 10,
        reason: 'test',
      }),
    /movement_type không hợp lệ/,
  );

  // Rejects empty reason
  assert.throws(
    () =>
      validateInventoryMovementInput({
        variant_id: 15,
        movement_type: 'adjust',
        quantity: -5,
        reason: '',
      }),
    /lý do điều chỉnh/,
  );
});

test('Variant Inventory Service: delegates balance retrieval and stock adjustment to repository', async () => {
  const fakeRepo = {
    async getInventoryBalance(storeId, variantId) {
      return { store_id: storeId, variant_id: variantId, on_hand: 50, reserved: 5, available_quantity: 45 };
    },
    async recordMovement(storeId, data, context) {
      return {
        inventory: { store_id: storeId, variant_id: data.variant_id, on_hand: 60, reserved: 5 },
        movement: { id: 1, ...data, ...context },
      };
    },
  };

  const service = createVariantInventoryService(fakeRepo);

  const balance = await service.getInventoryBalance(1, 10);
  assert.equal(balance.on_hand, 50);
  assert.equal(balance.reserved, 5);
  assert.equal(balance.available_quantity, 45);

  const result = await service.adjustStock(
    1,
    {
      variant_id: 10,
      movement_type: 'receive',
      quantity: 10,
      reason: 'Nhập bổ sung',
    },
    { createdBy: 1 },
  );

  assert.equal(result.inventory.on_hand, 60);
  assert.equal(result.movement.quantity, 10);
});
