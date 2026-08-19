import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateVoucherApplyInput } from '../../validation/promotion-schemas.js';
import { toPromotionDto } from '../../dto/promotion-dto.js';
import promotionService from '../../services/promotions/promotion-service.js';

const router = Router();

router.get('/promotions', asyncHandler(async (req, res) => {
  const rows = await promotionService.listActivePromotions(req.query);
  res.json(rows.map(toPromotionDto));
}));

router.post('/vouchers/apply', asyncHandler(async (req, res) => {
  try {
    const validated = validateVoucherApplyInput(req.body);
    const { discount_amount } = await promotionService.previewVoucher({
      code: validated.code,
      subtotal: validated.subtotal,
      phone: validated.phone,
      storeId: validated.storeId,
    });
    res.json({ valid: true, discount_amount, code: validated.code, message: 'Áp dụng thành công' });
  } catch (err) {
    res.status(400).json({ valid: false, message: err.message });
  }
}));

export default router;
