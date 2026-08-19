import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { parseDateRangeBoundaries } from '../../services/date-range.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import reportService from '../../services/reports/report-service.js';

export const dashboardRouter = Router();
export const reportsRouter = Router();

// ═══════════ DASHBOARD ═══════════

dashboardRouter.get('/kpi', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const kpi = await reportService.getKPI({ scopedStoreId });
    res.json(kpi);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

dashboardRouter.get('/urgent', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const urgent = await reportService.getUrgent({ scopedStoreId });
    res.json(urgent);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

dashboardRouter.get('/revenue-by-hour', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await reportService.getRevenueByHour({ scopedStoreId });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

dashboardRouter.get('/revenue-by-category', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    let dateFrom;
    let dateTo;
    if (req.query.from && req.query.to) {
      const { start, end } = parseDateRangeBoundaries(req.query.from, req.query.to);
      dateFrom = start;
      dateTo = end;
    }
    const rows = await reportService.getRevenueByCategory({ scopedStoreId, dateFrom, dateTo });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

dashboardRouter.get('/revenue-by-branch', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    let dateFrom;
    let dateTo;
    if (req.query.from && req.query.to) {
      const { start, end } = parseDateRangeBoundaries(req.query.from, req.query.to);
      dateFrom = start;
      dateTo = end;
    }
    const rows = await reportService.getRevenueByBranch({ dateFrom, dateTo });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

dashboardRouter.get('/top-products', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const rows = await reportService.getTopProducts({ scopedStoreId, limit: 10 });
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ REPORTS ═══════════

reportsRouter.get('/kpi-summary', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const { from, to, store_id } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Thiếu from hoặc to' });
    const { start, end } = parseDateRangeBoundaries(from, to);
    const scopedStoreId = resolveStoreScope(req.user, store_id);
    const summary = await reportService.getReportsKPISummary({ dateFrom: start, dateTo: end, scopedStoreId });
    res.json(summary);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

reportsRouter.get('/summary', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const { from, to, store_id } = req.query;
    const scopedStoreId = resolveStoreScope(req.user, store_id);
    const df = from || '2020-01-01';
    const dt = to || '2099-12-31';
    const { start, end } = parseDateRangeBoundaries(df, dt);
    const summary = await reportService.getReportsSummary({ dateFrom: start, dateTo: end, scopedStoreId });
    res.json(summary);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default reportsRouter;
