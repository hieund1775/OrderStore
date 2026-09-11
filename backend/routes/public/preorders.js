import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import preorderService from '../../services/preorders/preorder-service.js';

const router = Router();

function customerOnly(req, res, next) {
  if (req.user?.role !== 'customer' || !Number(req.user?.sub || req.user?.id)) {
    return res.status(401).json({ error: 'Vui lÃ²ng Ä‘Äƒng nháº­p tÃ i khoáº£n khÃ¡ch hÃ ng' });
  }
  return next();
}

function sendError(res, error) {
  return res.status(error?.status || 500).json({ error: error?.message || 'KhÃ´ng thá»ƒ xá»­ lÃ½ preorder' });
}

router.get('/availability', asyncHandler(async (req, res) => {
  try {
    const result = await preorderService.availability({ storeId: req.query.store_id, date: req.query.date });
    res.json(result);
  } catch (error) { sendError(res, error); }
}));

router.get('/tables', asyncHandler(async (req, res) => {
  try {
    const result = await preorderService.availableTables({
      storeId: req.query.store_id, date: req.query.date, hour: req.query.hour,
    });
    res.json(result);
  } catch (error) { sendError(res, error); }
}));

router.post('/checkout', authenticate, customerOnly, asyncHandler(async (req, res) => {
  try {
    const result = await preorderService.checkout({
      input: req.body || {}, customerUserId: Number(req.user.sub || req.user.id),
      idempotencyKey: req.headers['idempotency-key'],
    });
    res.status(result.replay ? 200 : 201).json(result);
  } catch (error) { sendError(res, error); }
}));

router.get('/:code', authenticate, customerOnly, asyncHandler(async (req, res) => {
  try {
    const preorder = await preorderService.getForCustomer({ preorderCode: req.params.code, customerUserId: Number(req.user.sub || req.user.id) });
    return res.json(preorder);
  } catch (error) { return sendError(res, error); }
}));

router.post('/:code/cancel', authenticate, customerOnly, asyncHandler(async (req, res) => {
  try {
    const preorder = await preorderService.cancel({
      preorderCode: req.params.code, customerUserId: Number(req.user.sub || req.user.id), reason: req.body?.reason || null,
    });
    res.json(preorder);
  } catch (error) { sendError(res, error); }
}));

export default router;
