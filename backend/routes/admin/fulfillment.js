import { Router } from 'express';
import fulfillmentService from '../../services/orders/fulfillment-service.js';
import { requireAdminRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';

const router = Router();

// Allowed roles for fulfillment operations
const requireFulfillmentRole = requireAdminRoles('super', 'manager', 'kitchen', 'packing');

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

export default router;
