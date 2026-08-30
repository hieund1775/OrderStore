import express from 'express';
import { createFulfillmentCapabilitiesRepository } from '../../repositories/postgres/fulfillment-capabilities.js';
import { validateCapabilityInput } from '../../validation/fulfillment-capability-schemas.js';
import { requireRole } from '../../middleware/auth.js';

export function createFulfillmentCapabilitiesRoutes({
  repository = createFulfillmentCapabilitiesRepository(),
} = {}) {
  const router = express.Router();

  // GET /api/admin/branches/:storeId/capabilities
  router.get('/branches/:storeId/capabilities', requireRole('super', 'manager', 'kitchen', 'packing'), async (req, res, next) => {
    try {
      const storeId = Number(req.params.storeId);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ error: 'Mã chi nhánh không hợp lệ' });
      }

      // Every non-super operator is restricted to their assigned store.
      if (req.user?.admin_role !== 'super' && Number(req.user?.admin_branch_id) !== storeId) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xem khả năng vận hành của chi nhánh mình' });
      }

      if (!await repository.storeExists(storeId)) {
        return res.status(404).json({ error: 'Không tìm thấy chi nhánh', code: 'STORE_NOT_FOUND' });
      }

      const capabilities = await repository.listCapabilities(storeId);
      res.json({ data: capabilities });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/admin/branches/:storeId/capabilities
  router.put('/branches/:storeId/capabilities', requireRole('super'), async (req, res, next) => {
    try {
      const storeId = Number(req.params.storeId);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ error: 'Mã chi nhánh không hợp lệ' });
      }

      const { lane_code, is_enabled } = validateCapabilityInput(req.body);

      const result = await repository.setCapabilitySafely({
        storeId,
        laneCode: lane_code,
        isEnabled: is_enabled,
        updatedBy: req.user?.id || req.user?.sub || null,
      });
      if (result.notFound === 'store') {
        return res.status(404).json({ error: 'Không tìm thấy chi nhánh', code: 'STORE_NOT_FOUND' });
      }
      if (result.notFound === 'lane') {
        return res.status(409).json({ error: 'Luồng xử lý không tồn tại hoặc đang tạm ngừng', code: 'FULFILLMENT_LANE_INACTIVE' });
      }
      if (result.blocked) {
        return res.status(409).json({
          error: 'Không thể tắt luồng khi vẫn còn hàng đang mở bán hoặc nhiệm vụ đang xử lý',
          code: 'BRANCH_CAPABILITY_HAS_BLOCKERS',
          blockers: {
            active_offers: result.activeOffers,
            active_tasks: result.pendingTasks,
          },
        });
      }

      res.json({ data: result.capability, message: 'Cập nhật khả năng vận hành chi nhánh thành công' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
