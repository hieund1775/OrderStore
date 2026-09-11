import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import preorderService from '../../services/preorders/preorder-service.js';
import preordersRepository from '../../repositories/postgres/preorders.js';
import postgresDb from '../../config/db-postgres.js';
import { getTodayBoundaries } from '../../services/business-time.js';

const router = Router();

function errorResponse(res, error) {
  return res.status(error?.status || 500).json({ error: error?.message || 'KhÃ´ng thá»ƒ xá»­ lÃ½ preorder' });
}

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const storeId = resolveStoreScope(req.user, req.query.store_id);
    const today = getTodayBoundaries();
    const view = req.query.view;
    const rows = await preordersRepository.list({
      storeId, status: req.query.status || null,
      includePendingOnly: view === 'pending',
      from: view === 'today' ? today.start : view === 'upcoming' ? today.end : null,
      to: view === 'today' ? today.end : null,
    });
    res.json(rows);
  } catch (error) { errorResponse(res, error); }
}));

// Kitchen receives only confirmed operational work; unpaid and merely paid
// preorders remain invisible until a Manager/Super confirms them.
router.get('/kitchen/confirmed', requireRole('super', 'manager', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const storeId = resolveStoreScope(req.user, req.query.store_id);
    const rows = await preordersRepository.list({ storeId, status: 'CONFIRMED' });
    return res.json(rows);
  } catch (error) { return errorResponse(res, error); }
}));

// Store configuration is deliberately Super-only: a Manager cannot assign
// themselves, another branch, or re-enable preorder after a strike.
router.put('/settings/:storeId', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const enabled = req.body?.is_enabled === true;
    const managerId = req.body?.responsible_manager_id;
    if (enabled && !Number.isInteger(Number(managerId))) {
      return res.status(400).json({ error: 'Cần chọn Manager phụ trách đang hoạt động để bật đặt trước' });
    }
    const setting = await preordersRepository.setStoreSetting({
      storeId: Number(req.params.storeId), enabled, responsibleManagerId: managerId ?? null,
    });
    if (!setting) return res.status(404).json({ error: 'Không tìm thấy cấu hình preorder của cửa hàng' });
    return res.json(setting);
  } catch (error) { return errorResponse(res, error); }
}));

router.post('/:id/confirm', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try { res.json(await preorderService.confirm({ preorderId: req.params.id, actor: req.user })); } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/reschedule', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    res.json(await preorderService.reschedule({
      preorderId: req.params.id, actor: req.user, date: req.body?.scheduled_date, hour: req.body?.scheduled_hour,
      tableId: Object.hasOwn(req.body || {}, 'table_id') ? req.body.table_id : undefined,
      reason: req.body?.reason, customerAgreementRecordedAt: new Date(),
    }));
  } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/check-in', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try { res.json(await preorderService.checkIn({ preorderId: req.params.id, actor: req.user })); } catch (error) { errorResponse(res, error); }
}));

router.get('/incidents/list', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const result = await postgresDb.query(
      `SELECT i.*, p.preorder_code, p.status FROM preorder_confirmation_incidents i
       JOIN preorders p ON p.id = i.preorder_id ORDER BY i.scheduled_start_at DESC LIMIT 200`,
    );
    res.json(Array.isArray(result[0]) ? result[0] : result.rows || result);
  } catch (error) { errorResponse(res, error); }
}));

router.post('/managers/:id/preorder-strikes/reset', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const result = await postgresDb.query(
      `UPDATE manager_preorder_strikes
       SET confirmed_breach_count = 0, reset_by = $2, reset_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE manager_id = $1 RETURNING *`, [Number(req.params.id), Number(req.user.sub)],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result.rows || [];
    if (!rows[0]) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y strike cá»§a Manager' });
    return res.json(rows[0]);
  } catch (error) { return errorResponse(res, error); }
}));

export default router;
