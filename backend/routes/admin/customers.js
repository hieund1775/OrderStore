import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateCustomerId } from '../../validation/customer-schemas.js';
import { toCustomerDto } from '../../dto/customer-dto.js';
import customerService from '../../services/customers/customer-service.js';
import adminPromotionService from '../../services/promotions/admin-promotion-service.js';

const router = Router();

router.get('/', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const { search, tier, limit, offset } = req.query;
    const rows = await customerService.listCustomers({
      scopedStoreId,
      search,
      tier,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    res.json(rows.map(toCustomerDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/:id', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.params.id);
    const scopedStoreId = resolveStoreScope(req.user);
    const customer = await customerService.getCustomerDetail(id, { scopedStoreId });
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    res.json(toCustomerDto(customer));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/:id/vouchers', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const userId = validateCustomerId(req.params.id);
    const { promotion_id, code, expires_at } = req.body || {};
    const promotionId = Number(promotion_id);
    if (!Number.isInteger(promotionId) || promotionId <= 0) {
      return res.status(400).json({ error: 'ID khuyến mãi không hợp lệ' });
    }
    const assigned = await adminPromotionService.assignPromotionToUser({
      promotionId,
      userId,
      code,
      expiresAt: expires_at,
    });
    res.status(201).json(assigned);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
