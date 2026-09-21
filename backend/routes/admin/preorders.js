import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import preorderService from '../../services/preorders/preorder-service.js';
import preordersRepository from '../../repositories/postgres/preorders.js';
import postgresDb from '../../config/db-postgres.js';
import { getTodayBoundaries } from '../../services/business-time.js';
import { isPaginationRequested, validatePage, validateLimit, buildOffsetPagination } from '../../services/offset-pagination.js';

const ARCHIVE_VALID_STATUSES = Object.freeze(new Set([
  'COMPLETED',
  'CUSTOMER_CANCELLED',
  'NO_SHOW',
]));

function errorResponse(res, error) {
  return res.status(error?.status || 500).json({ error: error?.message || 'Không thể xử lý preorder' });
}

export function createAdminPreordersRouter({
  service = preorderService,
  repository = preordersRepository,
  database = postgresDb,
} = {}) {
  const router = Router();

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const storeId = resolveStoreScope(req.user, req.query.store_id);
    const today = getTodayBoundaries();
    const view = String(req.query.view || 'pending');

    let statuses;
    let from = null;
    let to = null;
    let includeReviews = false;

    if (view === 'pending') {
      statuses = ['PENDING_MANAGER_CONFIRMATION'];
    } else if (view === 'check-in' || view === 'checked-in') {
      statuses = ['CHECKED_IN'];
    } else if (view === 'today') {
      statuses = ['CONFIRMED', 'CHECKED_IN'];
      from = today.start;
      to = today.end;
    } else if (view === 'upcoming') {
      statuses = ['CONFIRMED', 'PENDING_MANAGER_CONFIRMATION'];
      from = today.end;
    } else if (view === 'archive') {
      includeReviews = true;
      const requestedStatus = req.query.status ? String(req.query.status).trim() : '';
      if (requestedStatus === 'all' || requestedStatus === 'ALL') {
        statuses = ['COMPLETED', 'CUSTOMER_CANCELLED', 'NO_SHOW'];
      } else if (ARCHIVE_VALID_STATUSES.has(requestedStatus)) {
        statuses = [requestedStatus];
      } else {
        statuses = ['COMPLETED'];
      }
    } else {
      statuses = ['PENDING_MANAGER_CONFIRMATION'];
    }

    const isPaginated = isPaginationRequested(req.query);
    const orderBy = view === 'archive' ? 'archive' : 'active';

    if (isPaginated) {
      const page = validatePage(req.query.page, 1);
      const limit = validateLimit(req.query.limit, 6, 50);
      const { items, totalItems } = await repository.list({
        storeId,
        statuses,
        from,
        to,
        includeReviews,
        page,
        limit,
        orderBy,
      });
      const pagination = buildOffsetPagination({ totalItems, page, limit });
      return res.json({ items, pagination });
    }

    const rows = await repository.list({
      storeId,
      statuses,
      from,
      to,
      includeReviews,
      orderBy,
    });
    res.json(rows);
  } catch (error) { errorResponse(res, error); }
}));

// Kitchen may see a confirmed preorder in its dedicated upcoming queue, but
// the normal KDS queue never receives its linked orders until check-in.
router.get('/kitchen/confirmed', requireRole('super', 'manager', 'kitchen', 'packing'), asyncHandler(async (req, res) => {
  try {
    const storeId = resolveStoreScope(req.user, req.query.store_id);
    const lane = req.query.lane ? String(req.query.lane).trim() : null;
    if (req.query.limit !== undefined) {
      const limit = validateLimit(req.query.limit, 6, 50);
      const result = await repository.list({
        storeId,
        status: 'CONFIRMED',
        kitchenUpcomingOnly: true,
        lane,
        page: 1,
        limit,
        orderBy: 'active',
      });
      const items = Array.isArray(result) ? result : (result?.items || []);
      return res.json(items);
    }
    const rows = await repository.list({
      storeId,
      status: 'CONFIRMED',
      kitchenUpcomingOnly: true,
      lane,
      orderBy: 'active',
    });
    return res.json(Array.isArray(rows) ? rows : (rows?.items || []));
  } catch (error) { return errorResponse(res, error); }
}));

// Store configuration is deliberately Super-only: a Manager cannot assign
// themselves, another branch, or re-enable preorder after a strike.
router.get('/settings', requireRole('super'), asyncHandler(async (_req, res) => {
  try {
    return res.json({ stores: await repository.listStoreSettingsForSuper() });
  } catch (error) { return errorResponse(res, error); }
}));

router.put('/settings/:storeId', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const enabled = req.body?.is_enabled === true;
    const managerId = req.body?.responsible_manager_id;
    if (enabled && !Number.isInteger(Number(managerId))) {
      return res.status(400).json({ error: 'Cần chọn Manager phụ trách đang hoạt động để bật đặt trước' });
    }
    const setting = await repository.setStoreSetting({
      storeId: Number(req.params.storeId), enabled, responsibleManagerId: managerId ?? null,
    });
    if (!setting) return res.status(404).json({ error: 'Không tìm thấy cấu hình preorder của cửa hàng' });
    return res.json(setting);
  } catch (error) { return errorResponse(res, error); }
}));

router.post('/:id/confirm', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try { res.json(await service.confirm({ preorderId: req.params.id, actor: req.user })); } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/handover', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    res.json(await service.confirmHandover({ preorderId: req.params.id, actor: req.user }));
  } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/reschedule', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    res.json(await service.reschedule({
      preorderId: req.params.id, actor: req.user, date: req.body?.scheduled_date, hour: req.body?.scheduled_hour,
      tableId: Object.hasOwn(req.body || {}, 'table_id') ? req.body.table_id : undefined,
      reason: req.body?.reason, customerAgreementRecordedAt: new Date(),
    }));
  } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/check-in', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    res.json(await service.checkIn({
      preorderId: req.params.id,
      actor: req.user,
      lateConfirmationReason: req.body?.late_confirmation_reason || null,
    }));
  } catch (error) { errorResponse(res, error); }
}));

router.post('/:id/check-in/reject', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    res.json(await service.rejectCheckIn({
      preorderId: req.params.id,
      actor: req.user,
      reason: req.body?.reason,
    }));
  } catch (error) { errorResponse(res, error); }
}));

router.get('/incidents/list', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const result = await database.query(
      `SELECT i.*, p.preorder_code, p.status FROM preorder_confirmation_incidents i
       JOIN preorders p ON p.id = i.preorder_id ORDER BY i.scheduled_start_at DESC LIMIT 200`,
    );
    res.json(Array.isArray(result[0]) ? result[0] : result.rows || result);
  } catch (error) { errorResponse(res, error); }
}));

router.post('/managers/:id/preorder-strikes/reset', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const result = await database.query(
      `UPDATE manager_preorder_strikes
       SET confirmed_breach_count = 0, reset_by = $2, reset_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE manager_id = $1 RETURNING *`, [Number(req.params.id), Number(req.user.sub)],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result.rows || [];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy strike của Manager' });
    return res.json(rows[0]);
  } catch (error) { return errorResponse(res, error); }
}));

  return router;
}

export default createAdminPreordersRouter();
