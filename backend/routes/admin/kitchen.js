import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus } from '../../services/orders/order-errors.js';
import adminOrderService from '../../services/orders/admin-order-service.js';
import { toKitchenOrderDto } from '../../dto/order-dto.js';

const router = Router();

router.get('/orders', requireRole('super', 'manager', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const orders = await adminOrderService.listKitchen({ storeId: scopedStoreId });
    res.json(orders.map(toKitchenOrderDto));
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export default router;
