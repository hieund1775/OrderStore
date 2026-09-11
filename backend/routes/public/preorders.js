import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { isValidDateString } from '../../services/business-time.js';
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

function invalidQuery(field, code) {
  const error = new Error(`${field} khÃ´ng há»£p lá»‡`);
  error.status = 400;
  error.code = code;
  return error;
}

export function validateAvailabilityQuery(query = {}) {
  const rawStoreId = typeof query.store_id === 'string' ? query.store_id.trim() : '';
  if (!/^[1-9]\d*$/.test(rawStoreId)) {
    throw invalidQuery('store_id', 'PREORDER_STORE_ID_INVALID');
  }
  const storeId = Number(rawStoreId);
  if (!Number.isSafeInteger(storeId)) {
    throw invalidQuery('store_id', 'PREORDER_STORE_ID_INVALID');
  }

  const date = typeof query.date === 'string' ? query.date.trim() : '';
  if (!isValidDateString(date)) {
    throw invalidQuery('date', 'PREORDER_DATE_INVALID');
  }
  return { storeId, date };
}

function mountAvailabilityRoute(targetRouter, service) {
  targetRouter.get('/availability', asyncHandler(async (req, res) => {
    try {
      const { storeId, date } = validateAvailabilityQuery(req.query);
      const result = await service.availability({ storeId, date });
      res.json(result);
    } catch (error) { sendError(res, error); }
  }));
}

export function createPublicPreordersAvailabilityRouter({ service } = {}) {
  const availabilityRouter = Router();
  mountAvailabilityRoute(availabilityRouter, service || preorderService);
  return availabilityRouter;
}

mountAvailabilityRoute(router, preorderService);

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
