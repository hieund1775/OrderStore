/**
 * Variant Inventory Validation Schemas
 */

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function validateInventoryMovementInput(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Payload inventory movement phải là một object');
  }

  const variantId = Number(input.variant_id);
  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw badRequest('variant_id phải là số nguyên dương');
  }

  const movementType = String(input.movement_type || '').trim();
  if (!['receive', 'adjust', 'reserve', 'release', 'sale', 'cancel_restock', 'return_restock'].includes(movementType)) {
    throw badRequest('movement_type không hợp lệ (hỗ trợ receive, adjust, reserve, release, sale, cancel_restock, return_restock)');
  }

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw badRequest('Số lượng quantity phải là số nguyên khác 0');
  }

  const reason = String(input.reason || '').trim();
  if (!reason || reason.length < 2) {
    throw badRequest('Vui lòng nhập lý do điều chỉnh tồn kho (reason)');
  }

  return {
    variant_id: variantId,
    movement_type: movementType,
    quantity,
    reason,
    reference_type: input.reference_type ? String(input.reference_type).trim() : null,
    reference_id: input.reference_id ? String(input.reference_id).trim() : null,
  };
}
