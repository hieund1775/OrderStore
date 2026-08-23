import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus } from '../../services/orders/order-errors.js';
import adminOrderService from '../../services/orders/admin-order-service.js';
import { toKitchenOrderDto } from '../../dto/order-dto.js';
import { noCache } from '../../middleware/no-cache.js';

const router = Router();

router.get('/orders', noCache, requireRole('super', 'manager', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    // KDS is a realtime view; never let browser/proxy validators turn a poll into 304.
    const scopedStoreId = resolveStoreScope(req.user, req.query.store_id);
    const orders = await adminOrderService.listKitchen({ storeId: scopedStoreId });
    res.json(orders.map(toKitchenOrderDto));
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export default router;
