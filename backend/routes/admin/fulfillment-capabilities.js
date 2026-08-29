import express from 'express';
import { createFulfillmentCapabilitiesRepository } from '../../repositories/postgres/fulfillment-capabilities.js';
import { validateCapabilityInput } from '../../validation/fulfillment-capability-schemas.js';
import { requireAdminRole } from '../../middleware/auth.js';

export function createFulfillmentCapabilitiesRoutes({
  repository = createFulfillmentCapabilitiesRepository(),
} = {}) {
  const router = express.Router();

  // GET /api/admin/branches/:storeId/capabilities
  router.get('/branches/:storeId/capabilities', requireAdminRole(['super', 'manager']), async (req, res, next) => {
    try {
      const storeId = Number(req.params.storeId);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ error: 'Mã chi nhánh không hợp lệ' });
      }

      // Manager can only view their own store
      if (req.user?.admin_role === 'manager' && Number(req.user?.admin_branch_id) !== storeId) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xem khả năng vận hành của chi nhánh mình' });
      }

      const capabilities = await repository.listCapabilities(storeId);
      res.json({ data: capabilities });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/admin/branches/:storeId/capabilities
  router.put('/branches/:storeId/capabilities', requireAdminRole(['super']), async (req, res, next) => {
    try {
      const storeId = Number(req.params.storeId);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ error: 'Mã chi nhánh không hợp lệ' });
      }

      const { lane_code, is_enabled } = validateCapabilityInput(req.body);

      // If disabling capability, check blockers
      if (!is_enabled) {
        const activeOffers = await repository.countActiveOffersByLane(storeId, lane_code);
        if (activeOffers > 0) {
          return res.status(409).json({
            error: `Không thể tắt luồng "${lane_code}" vì chi nhánh vẫn còn ${activeOffers} sản phẩm đang mở bán`,
            code: 'BRANCH_CAPABILITY_BLOCKED_BY_OFFERS',
          });
        }

        const pendingTasks = await repository.countPendingTasksByLane(storeId, lane_code);
        if (pendingTasks > 0) {
          return res.status(409).json({
            error: `Không thể tắt luồng "${lane_code}" vì vẫn còn ${pendingTasks} nhiệm vụ đang xử lý`,
            code: 'BRANCH_CAPABILITY_BLOCKED_BY_TASKS',
          });
        }
      }

      const updated = await repository.upsertCapability({
        storeId,
        laneCode: lane_code,
        isEnabled: is_enabled,
        updatedBy: req.user?.id || null,
      });

      res.json({ data: updated, message: 'Cập nhật khả năng vận hành chi nhánh thành công' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
