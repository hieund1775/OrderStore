import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { resolveStoreScope } from '../middleware/branch-scope.js';
import { logAudit } from '../services/audit.js';
import { VALID_STATUSES } from '../services/order-transition-policy.js';
import { parseSingleDateBoundary, parseDateRangeBoundaries } from '../services/date-range.js';
import { decodeCursor, validatePaginationLimit } from '../services/cursor-pagination.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { orderErrorStatus } from '../services/orders/order-errors.js';
import { validateOrderFilters, validateOrderId, validateOrderMutationInput, validateOrderStatus } from '../validation/order-schemas.js';

import adminOrderService from '../services/orders/admin-order-service.js';
import adminOrdersRouter, { updateOrderStatus } from './admin/orders.js';
import adminKitchenRouter from './admin/kitchen.js';
import adminMenuRouter from './admin/menu.js';
import adminCatalogRepository from '../repositories/postgres/admin-catalog.js';
import adminStoresRepository from '../repositories/postgres/admin-stores.js';
import adminPromotionsRepository from '../repositories/postgres/admin-promotions.js';
import adminInventoryRepository from '../repositories/postgres/admin-inventory.js';
import adminReportsRepository from '../repositories/postgres/admin-reports.js';
import adminManagementRepository from '../repositories/postgres/admin-management.js';

const router = Router();

// Toàn bộ /admin/* cần JWT + RBAC
router.use(authenticate, requireRole('super', 'manager', 'kitchen', 'cashier'));

// ═══════════ DASHBOARD ═══════════

router.get('/dashboard/kpi', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const kpi = await adminReportsRepository.getKPI({ scopedStoreId });
    res.json(kpi);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/dashboard/urgent', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const urgent = await adminReportsRepository.getUrgent({ scopedStoreId });
    res.json(urgent);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/dashboard/revenue-by-hour', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await adminReportsRepository.getRevenueByHour({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/dashboard/revenue-by-category', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    let dateFrom;
    let dateTo;
    if (req.query.from && req.query.to) {
      const { start, end } = parseDateRangeBoundaries(req.query.from, req.query.to);
      dateFrom = start;
      dateTo = end;
    }
    const rows = await adminReportsRepository.getRevenueByCategory({ scopedStoreId, dateFrom, dateTo });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/dashboard/revenue-by-branch', requireRole('super', 'manager'), async (req, res) => {
  try {
    let dateFrom;
    let dateTo;
    if (req.query.from && req.query.to) {
      const { start, end } = parseDateRangeBoundaries(req.query.from, req.query.to);
      dateFrom = start;
      dateTo = end;
    }
    const rows = await adminReportsRepository.getRevenueByBranch({ dateFrom, dateTo });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/dashboard/top-products', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await adminReportsRepository.getTopProducts({ scopedStoreId, limit: 10 });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ ORDERS, KITCHEN & MENU DOMAINS ═══════════
router.use('/orders', adminOrdersRouter);
router.use('/kitchen', adminKitchenRouter);
router.use('/menu', adminMenuRouter);
export { updateOrderStatus };

// ═══════════ CUSTOMERS ═══════════

router.get('/customers', requireRole('super', 'manager', 'cashier'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const { search, tier, limit, offset } = req.query;
    const rows = await adminManagementRepository.listCustomers({
      scopedStoreId,
      search,
      tier,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/customers/:id', requireRole('super', 'manager', 'cashier'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const customer = await adminManagementRepository.getCustomerDetail(req.params.id, { scopedStoreId });
    res.json(customer);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ BRANCHES ═══════════

router.get('/branches', requireRole('super', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await adminStoresRepository.listBranches({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/branches', requireRole('super'), async (req, res) => {
  try {
    const { name, city, district, address, phone } = req.body;
    if (!name || !city || !district || !address || !phone) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (name, city, district, address, phone)' });
    }
    const created = await adminStoresRepository.createBranch(req.body);
    await logAudit(req.user.sub, 'Tạo chi nhánh', name, req);
    res.status(201).json(created);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.put('/branches/:id', requireRole('super', 'manager'), async (req, res) => {
  try {
    resolveStoreScope(req.user, req.params.id);
    const updated = await adminStoresRepository.updateBranch(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
    await logAudit(req.user.sub, `Cập nhật chi nhánh #${req.params.id}`, req.body.name || '', req);
    res.json({ message: 'Đã cập nhật chi nhánh' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/branches/:id', requireRole('super'), async (req, res) => {
  try {
    await adminStoresRepository.deleteBranch(req.params.id);
    await logAudit(req.user.sub, `Xóa chi nhánh #${req.params.id}`, '', req);
    res.json({ message: 'Đã xóa chi nhánh' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ PROMOTIONS ═══════════

router.get('/promotions', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await adminPromotionsRepository.listPromotions({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/promotions', requireRole('super'), async (req, res) => {
  try {
    const { title, type, start_date, end_date } = req.body;
    if (!title || !type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    const created = await adminPromotionsRepository.createPromotion(req.body);
    await logAudit(req.user.sub, 'Tạo khuyến mãi', title, req);
    res.status(201).json(created);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.put('/promotions/:id', requireRole('super'), async (req, res) => {
  try {
    const updated = await adminPromotionsRepository.updatePromotion(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    await logAudit(req.user.sub, `Cập nhật khuyến mãi #${req.params.id}`, req.body.title || '', req);
    res.json({ message: 'Đã cập nhật khuyến mãi' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ INVENTORY ═══════════

router.get('/inventory', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user, req.query.store_id);
    const rows = await adminInventoryRepository.listInventory({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.put('/inventory/:id', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { stock, safe_level } = req.body;
    const scopedStoreId = resolveStoreScope(req.user);
    await adminInventoryRepository.updateInventory(req.params.id, { stock, safe_level, scopedStoreId });
    await logAudit(req.user.sub, `Cập nhật tồn kho #${req.params.id}`, `stock: ${stock}`, req);
    res.json({ message: 'Đã cập nhật tồn kho' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/inventory/:id/log', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { change_amount, reason, reference } = req.body;
    if (change_amount === undefined || !reason) {
      return res.status(400).json({ error: 'Thiếu change_amount hoặc reason' });
    }
    const scopedStoreId = resolveStoreScope(req.user);
    const result = await adminInventoryRepository.logInventory(req.params.id, {
      change_amount,
      reason,
      reference,
      created_by: req.user.sub,
      scopedStoreId,
    });
    await logAudit(req.user.sub, `Nhập/xuất kho #${req.params.id}`, `${change_amount > 0 ? '+' : ''}${change_amount} (${reason})`, req);
    res.json({ message: 'Đã ghi nhận thay đổi', ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ REPORTS ═══════════

router.get('/reports/kpi-summary', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { from, to, store_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Thiếu from hoặc to' });
    const { start, end } = parseDateRangeBoundaries(from, to);
    const scopedStoreId = resolveStoreScope(req.user, store_id);
    const summary = await adminReportsRepository.getReportsKPISummary({ dateFrom: start, dateTo: end, scopedStoreId });
    res.json(summary);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/reports/summary', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { from, to, store_id } = req.query;
    const scopedStoreId = resolveStoreScope(req.user, store_id);
    const df = from || '2020-01-01';
    const dt = to || '2099-12-31';
    const { start, end } = parseDateRangeBoundaries(df, dt);
    const summary = await adminReportsRepository.getReportsSummary({ dateFrom: start, dateTo: end, scopedStoreId });
    res.json(summary);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ SETTINGS ═══════════

router.get('/settings/accounts', requireRole('super'), async (req, res) => {
  try {
    const rows = await adminManagementRepository.listAccounts();
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/settings/audit-logs', requireRole('super'), async (req, res) => {
  try {
    const rows = await adminManagementRepository.listAuditLogs({ limit: 100 });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ NOTIFICATIONS ═══════════

router.get('/notifications', requireRole('super', 'manager', 'cashier', 'kitchen'), async (req, res) => {
  try {
    const rows = await adminManagementRepository.listNotifications({
      userId: req.user.sub,
      role: req.user.role,
      limit: 50,
    });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/notifications', requireRole('super'), async (req, res) => {
  try {
    const { user_id, type, title, body, link } = req.body;
    const created = await adminManagementRepository.createNotification({ user_id, type, title, body, link });
    await logAudit(req.user.sub, 'Gửi thông báo', title, req);
    res.status(201).json({ id: created.id, message: 'Đã gửi thông báo' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// ═══════════ TABLES & QR (CRUD) ═══════════

router.get('/tables', requireRole('super', 'manager', 'cashier'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user, req.query.store_id);
    const rows = await adminStoresRepository.listTables({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/tables', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { store_id, name } = req.body;
    const targetStoreId = resolveStoreScope(req.user, store_id);
    const created = await adminStoresRepository.createTable({ store_id: targetStoreId, name });
    await logAudit(req.user.sub, 'Tạo vị trí bàn', `${name} (store ${targetStoreId})`, req);
    res.status(201).json(created);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

router.put('/tables/:id', requireRole('super', 'manager'), async (req, res) => {
  try {
    const { name, is_active } = req.body;
    const scopedStoreId = resolveStoreScope(req.user);
    await adminStoresRepository.updateTable(req.params.id, { name, is_active, scopedStoreId });
    await logAudit(req.user.sub, `Cập nhật vị trí bàn #${req.params.id}`, name || '', req);
    res.json({ message: 'Đã cập nhật bàn' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/tables/:id', requireRole('super', 'manager'), async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    await adminStoresRepository.deleteTable(req.params.id, { scopedStoreId });
    await logAudit(req.user.sub, `Xóa vị trí bàn #${req.params.id}`, '', req);
    res.json({ message: 'Đã xóa bàn' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

export default router;
