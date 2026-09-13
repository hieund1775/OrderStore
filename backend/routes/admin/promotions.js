import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validatePromotionId, validatePromotionInput } from '../../validation/promotion-schemas.js';
import { toPromotionDto } from '../../dto/promotion-dto.js';
import adminPromotionService from '../../services/promotions/admin-promotion-service.js';

const router = Router();

router.get('/', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const scopedStoreId = resolveStoreScope(req.user);
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

router.post('/:id/assign', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const promotionId = validatePromotionId(req.params.id);
    const { user_id, user_ids, code, expires_at } = req.body || {};
    const targetUserIds = Array.isArray(user_ids) ? user_ids : (user_id ? [user_id] : []);
    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'Thiếu user_id để cấp voucher' });
    }
    const results = [];
    for (const uId of targetUserIds) {
      const assigned = await adminPromotionService.assignPromotionToUser({
        promotionId,
        userId: Number(uId),
        code,
        expiresAt: expires_at,
      });
      results.push(assigned);
    }
    await logAudit(req.user.sub, `Cấp voucher #${promotionId} cho user`, String(targetUserIds.join(', ')), req);
    res.status(201).json({ success: true, count: results.length, data: results });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/assign', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  try {
    const { promotion_id, user_id, user_ids, code, expires_at } = req.body || {};
    const promotionId = validatePromotionId(promotion_id);
    const targetUserIds = Array.isArray(user_ids) ? user_ids : (user_id ? [user_id] : []);
    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'Thiếu user_id để cấp voucher' });
    }
    const results = [];
    for (const uId of targetUserIds) {
      const assigned = await adminPromotionService.assignPromotionToUser({
        promotionId,
        userId: Number(uId),
        code,
        expiresAt: expires_at,
      });
      results.push(assigned);
    }
    await logAudit(req.user.sub, `Cấp voucher #${promotionId} cho user`, String(targetUserIds.join(', ')), req);
    res.status(201).json({ success: true, count: results.length, data: results });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;
