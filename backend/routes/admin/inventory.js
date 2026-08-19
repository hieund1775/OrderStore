import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateIngredientId, validateStockAdjustmentInput } from '../../validation/inventory-schemas.js';
import adminInventoryService from '../../services/inventory/admin-inventory-service.js';

const router = Router();

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user, req.query.store_id);
    const rows = await adminInventoryService.listInventory({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateIngredientId(req.params.id);
    const { stock, safe_level } = req.body;
    const scopedStoreId = resolveStoreScope(req.user);
    await adminInventoryService.updateInventory(id, { stock, safe_level, scopedStoreId });
    await logAudit(req.user.sub, `Cập nhật tồn kho #${id}`, `stock: ${stock}`, req);
    res.json({ message: 'Đã cập nhật tồn kho' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/:id/log', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const id = validateIngredientId(req.params.id);
    const validated = validateStockAdjustmentInput(req.body);
    const scopedStoreId = resolveStoreScope(req.user);
    const result = await adminInventoryService.logInventory(id, {
      change_amount: validated.change_amount,
      reason: validated.reason,
      reference: req.body.reference,
      created_by: req.user.sub,
      scopedStoreId,
    });
    await logAudit(req.user.sub, `Nhập/xuất kho #${id}`, `${validated.change_amount > 0 ? '+' : ''}${validated.change_amount} (${validated.reason})`, req);
    res.json({ message: 'Đã ghi nhận thay đổi', ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
