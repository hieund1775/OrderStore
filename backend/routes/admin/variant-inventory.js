import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createVariantInventoryService } from '../../services/inventory/variant-inventory-service.js';

const router = Router();
const service = createVariantInventoryService();

router.get('/movements', requireRole('super', 'manager', 'packing'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.query.store_id);
  const movements = await service.listMovements(storeId, {
    variantId: req.query.variant_id,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0,
  });
  res.json(movements);
}));

router.get('/:variant_id', requireRole('super', 'manager', 'packing'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.query.store_id);
  const balance = await service.getInventoryBalance(storeId, req.params.variant_id);
  res.json(balance);
}));

router.post('/adjust', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.body.store_id || req.query.store_id);
  const result = await service.adjustStock(
    storeId,
    {
      variant_id: req.body.variant_id,
      movement_type: req.body.movement_type || 'adjust',
      quantity: req.body.quantity,
      reason: req.body.reason,
      reference_type: req.body.reference_type,
      reference_id: req.body.reference_id,
    },
    { createdBy: req.user.sub },
  );

  await logAudit(
    req.user.sub,
    'Điều chỉnh tồn kho SKU',
    `Store: ${storeId}, Variant: ${req.body.variant_id}, Type: ${req.body.movement_type}, Qty: ${req.body.quantity}`,
    req,
  );
  res.status(201).json(result);
}));

export default router;
