import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateCustomerId } from '../../validation/customer-schemas.js';
import { toCustomerDto } from '../../dto/customer-dto.js';
import customerService from '../../services/customers/customer-service.js';

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

export default router;
