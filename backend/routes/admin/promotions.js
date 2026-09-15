import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validatePromotionId, validatePromotionInput } from '../../validation/promotion-schemas.js';
import { toPromotionDto } from '../../dto/promotion-dto.js';
import adminPromotionService from '../../services/promotions/admin-promotion-service.js';
import { isPaginationRequested, validatePage, validateLimit, buildOffsetPagination } from '../../services/offset-pagination.js';

const router = Router();

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
    const isPaginated = isPaginationRequested(req.query);

    if (isPaginated) {
      const page = validatePage(req.query.page, 1);
      const limit = validateLimit(req.query.limit, 5, 50);
      const result = await adminPromotionService.listPromotions({ scopedStoreId, page, limit });
      const items = (result.items || []).map(toPromotionDto);
      const pagination = buildOffsetPagination({ totalItems: result.totalItems, page, limit });
      return res.json({ items, pagination });
    }

    const rows = await adminPromotionService.listPromotions({ scopedStoreId });
    res.json(rows.map(toPromotionDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validatePromotionInput(req.body, { isUpdate: false });
    const created = await adminPromotionService.createPromotion(validated);
    await logAudit(req.user.sub, 'Tạo khuyến mãi', validated.title, req);
    res.status(201).json(toPromotionDto(created));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.put('/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validatePromotionId(req.params.id);
    const validated = validatePromotionInput(req.body, { isUpdate: true });
    const updated = await adminPromotionService.updatePromotion(id, validated);
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    await logAudit(req.user.sub, `Cập nhật khuyến mãi #${id}`, validated.title || '', req);
    res.json({ message: 'Đã cập nhật khuyến mãi' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/:id', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const id = validatePromotionId(req.params.id);
    const deleted = await adminPromotionService.deletePromotion(id);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    await logAudit(req.user.sub, `Xóa khuyến mãi #${id}`, '', req);
    res.json({ message: 'Đã xóa khuyến mãi thành công' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
