import { Router } from 'express';
import fulfillmentService from '../../services/orders/fulfillment-service.js';
import adminOrderService from '../../services/orders/admin-order-service.js';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateOrderMutationInput } from '../../validation/order-schemas.js';

const router = Router();

// Allowed roles for fulfillment operations
const requireFulfillmentRole = requireRole('super', 'manager', 'kitchen', 'packing');

/**
 * GET /api/admin/fulfillment/tasks
 * List fulfillment tasks filtered by user role, lane, branch, and status
 */
router.get(
  '/tasks',
  requireFulfillmentRole,
  asyncHandler(async (req, res) => {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const lane = req.query.lane ? String(req.query.lane) : null;
    const statusParam = req.query.status;
    const statuses = statusParam
      ? (Array.isArray(statusParam) ? statusParam : String(statusParam).split(','))
      : null;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const tasks = await fulfillmentService.listTasks({
      user: req.user,
      branchId,
      lane,
      statuses,
      limit,
    });

    res.json({ tasks });
  }),
);

/**
 * GET /api/admin/fulfillment/tasks/:id
 * Get single task details
 */
router.get(
  '/tasks/:id',
  requireFulfillmentRole,
  asyncHandler(async (req, res) => {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ error: 'Mã nhiệm vụ không hợp lệ' });
    }

    try {
      const task = await fulfillmentService.getTaskDetails({
        taskId,
        user: req.user,
      });
      res.json({ task });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  }),
);

/**
 * PATCH /api/admin/fulfillment/tasks/:id/status
 * Update fulfillment task status ('pending' -> 'preparing' -> 'ready' / 'completed' / 'cancelled')
 */
router.patch(
  '/tasks/:id/status',
  requireFulfillmentRole,
  asyncHandler(async (req, res) => {
    const taskId = Number(req.params.id);
    const { status, notes } = req.body || {};

    if (!taskId || !status) {
      return res.status(400).json({ error: 'Thiếu mã nhiệm vụ hoặc trạng thái cập nhật' });
    }

    try {
      const result = await fulfillmentService.updateTaskStatus({
        taskId,
        user: req.user,
        status: String(status).trim(),
        notes: notes ? String(notes).trim() : null,
      });

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái nhiệm vụ sang "${status}"`,
        ...result,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  }),
);

router.post(
  '/orders/:id/handover',
  requireFulfillmentRole,
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Mã đơn hàng không hợp lệ' });
    }
    try {
      const input = validateOrderMutationInput({
        driver_name: req.body?.driver_name,
        driver_phone: req.body?.driver_phone,
        tracking_url: req.body?.tracking_url,
      });
      const ready = await fulfillmentService.prepareHandoverToShipper({ orderId, user: req.user });
      const result = await adminOrderService.updateStatus({
        orderId,
        // Legacy orders can legitimately predate fulfillment tasks. Preserve
        // normal branch scoping for those orders instead of turning `null`
        // into an unscoped manager mutation.
        storeId: ready.branchId ?? resolveStoreScope(req.user),
        status: 'Đang giao',
        note: req.body?.note ? String(req.body.note).trim() : null,
        actor: { id: req.user.sub, role: req.user.role },
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        trackingUrl: input.trackingUrl,
      });
      await fulfillmentService.completeReadyTasksForOrder(orderId);
      res.json({ ...result, message: 'Đã bàn giao đơn hàng cho shipper' });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
  }),
);

export default router;
