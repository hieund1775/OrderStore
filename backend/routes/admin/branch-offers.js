import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { createBranchOfferService } from '../../services/catalog/branch-offer-service.js';

import { isPaginationRequested, validatePage, validateLimit, buildOffsetPagination } from '../../services/offset-pagination.js';

const router = Router();
const service = createBranchOfferService();

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.query.store_id);
  const offers = await service.listBranchOffers(storeId, {
    categoryId: req.query.category_id,
    isAvailable: req.query.is_available !== undefined ? req.query.is_available === 'true' : undefined,
    search: req.query.search,
  });
  const isPaginated = isPaginationRequested(req.query);
  if (isPaginated) {
    const page = validatePage(req.query.page, 1);
    const limit = validateLimit(req.query.limit, 5, 50);
    const totalItems = offers.length;
    const items = offers.slice((page - 1) * limit, page * limit);
    const pagination = buildOffsetPagination({ totalItems, page, limit });
    return res.json({ items, pagination });
  }
  res.json(offers);
}));

router.put('/:variant_id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.body.store_id || req.query.store_id);
  const offer = await service.setBranchOffer(storeId, {
    variant_id: req.params.variant_id,
    price: req.body.price,
    compare_at_price: req.body.compare_at_price,
    is_available: req.body.is_available,
  });
  await logAudit(req.user.sub, 'Cập nhật giá SKU chi nhánh', `Store: ${storeId}, Variant: ${req.params.variant_id}`, req);
  res.json(offer);
}));

router.post('/batch-availability', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const storeId = resolveStoreScope(req.user, req.body.store_id || req.query.store_id);
  const { variant_ids, is_available } = req.body;
  const updated = await service.batchSetAvailability(storeId, variant_ids, is_available);
  await logAudit(req.user.sub, 'Đổi trạng thái bán SKU hàng loạt', `Store: ${storeId}, Count: ${variant_ids?.length}`, req);
  res.json(updated);
}));

export default router;
