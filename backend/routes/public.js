import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { decodeCursor, validatePaginationLimit } from '../services/cursor-pagination.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { orderErrorStatus } from '../services/orders/order-errors.js';
import customerOrderService from '../services/orders/customer-order-service.js';
import { toCustomerOrderListItemDto } from '../dto/order-dto.js';
import { validateOrderId } from '../validation/order-schemas.js';

import publicOrdersRouter, { handleCustomerCancelOrder } from './public/orders.js';
import publicCatalogRouter from './public/catalog.js';
import publicCatalogV2Router from './public/catalog-v2.js';
import publicStoresRouter from './public/stores.js';
import publicPromotionsRouter from './public/promotions.js';
import publicEngagementRouter from './public/engagement.js';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Products]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Server is running
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TeaPlus API (PostgreSQL)', timestamp: new Date().toISOString() });
});

// ═══════════ DOMAIN ROUTERS ═══════════
router.use('/', publicCatalogRouter);
router.use('/catalog', publicCatalogV2Router);
router.use('/', publicStoresRouter);
router.use('/', publicPromotionsRouter);
router.use('/', publicEngagementRouter);
router.use('/orders', publicOrdersRouter);

function requireCustomerSelf(req, res, next) {
  const requestedId = Number(req.params.id);
  const authUserId = Number(req.user?.id || req.user?.sub);
  if (!authUserId) {
    return res.status(401).json({ error: 'Chưa xác thực người dùng' });
  }
  if (requestedId !== authUserId && req.user?.role !== 'super') {
    return res.status(403).json({ error: 'Không có quyền truy cập dữ liệu của người dùng khác' });
  }
  next();
}

// ═══════════ CUSTOMER ORDER HISTORY ═══════════
router.get('/users/:id/orders', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const requestedId = validateOrderId(req.params.id);
    const limit = validatePaginationLimit(req.query.limit, 50, 100);
    const cursor = decodeCursor(req.query.cursor);
    const paginated = req.query.cursor !== undefined || req.query.limit !== undefined;
    const result = await customerOrderService.listCustomerHistory({
      userId: requestedId,
      limit,
      cursor,
      paginated,
    });
    if (Array.isArray(result)) {
      return res.json(result.map(toCustomerOrderListItemDto));
    }
    res.json({
      ...result,
      orders: result.orders.map(toCustomerOrderListItemDto),
    });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export { handleCustomerCancelOrder };
export default router;
