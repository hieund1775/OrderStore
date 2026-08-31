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
import adminRecruitmentRouter from './admin/recruitment.js';
import adminCatalogV2Router from './admin/catalog-v2.js';
import branchOffersRouter from './admin/branch-offers.js';
import variantInventoryRouter from './admin/variant-inventory.js';
import adminFulfillmentRouter from './admin/fulfillment.js';
import { createFulfillmentCapabilitiesRoutes } from './admin/fulfillment-capabilities.js';
import adminPaymentProfilesRouter from './admin/payment-profiles.js';

const router = Router();
router.use(authenticate, requireRole('super', 'manager', 'kitchen', 'cashier', 'packing'));

// ═══════════ DOMAIN ROUTERS ═══════════
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportsRouter);
router.use('/orders', adminOrdersRouter);
router.use('/kitchen', adminKitchenRouter);
router.use('/fulfillment', adminFulfillmentRouter);
router.use('/menu', adminMenuRouter);
router.use('/catalog', adminCatalogV2Router);
router.use('/branch-offers', branchOffersRouter);
router.use('/variant-inventory', variantInventoryRouter);
router.use('/payment-profiles', adminPaymentProfilesRouter);
router.use('/branches', branchesRouter);
router.use('/tables', tablesRouter);
router.use('/', createFulfillmentCapabilitiesRoutes());
router.use('/promotions', adminPromotionsRouter);
// Recruitment router owns the explicit /jobs and /job-applications paths.
router.use('/', adminRecruitmentRouter);
router.use('/inventory', adminInventoryRouter);
router.use('/customers', adminCustomersRouter);
router.use('/settings', adminSettingsRouter);
router.use('/notifications', adminNotificationsRouter);

export { updateOrderStatus };
export default router;
