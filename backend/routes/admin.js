import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

import adminOrdersRouter, { updateOrderStatus } from './admin/orders.js';
import adminKitchenRouter from './admin/kitchen.js';
import adminMenuRouter from './admin/menu.js';
import { branchesRouter, tablesRouter } from './admin/stores.js';
import adminPromotionsRouter from './admin/promotions.js';
import adminInventoryRouter from './admin/inventory.js';
import { dashboardRouter, reportsRouter } from './admin/reports.js';
import adminCustomersRouter from './admin/customers.js';
import adminSettingsRouter from './admin/settings.js';
import adminNotificationsRouter from './admin/notifications.js';

const router = Router();

// Toàn bộ /admin/* cần JWT + RBAC
router.use(authenticate, requireRole('super', 'manager', 'kitchen', 'cashier'));

// ═══════════ DOMAIN ROUTERS ═══════════
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportsRouter);
router.use('/orders', adminOrdersRouter);
router.use('/kitchen', adminKitchenRouter);
router.use('/menu', adminMenuRouter);
router.use('/branches', branchesRouter);
router.use('/tables', tablesRouter);
router.use('/promotions', adminPromotionsRouter);
router.use('/inventory', adminInventoryRouter);
router.use('/customers', adminCustomersRouter);
router.use('/settings', adminSettingsRouter);
router.use('/notifications', adminNotificationsRouter);

export { updateOrderStatus };
export default router;
