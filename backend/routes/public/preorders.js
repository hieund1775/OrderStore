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

const SAFE_CHECKOUT_STAGES = new Set([
  'PREORDER_CHECKOUT',
  'PREORDER_CREATE',
  'P1_CHECKOUT',
  'PREORDER_GROUP_LINK',
]);

function safeSymbolicCode(value) {
  const normalized = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  return /^[A-Z0-9_]{1,80}$/.test(normalized) ? normalized : null;
}

/**
 * This metadata is limited to fixed symbols for correlation. It never
 * contains request data, PII, secrets, provider payloads, or SQL text.
 */
export function buildSafePreorderCheckoutDiagnostic(error) {
  const candidateStage = typeof error?.preorderCheckoutStage === 'string'
    ? error.preorderCheckoutStage
    : 'PREORDER_CHECKOUT';
  return {
    stage: SAFE_CHECKOUT_STAGES.has(candidateStage) ? candidateStage : 'PREORDER_CHECKOUT',
    errorName: safeSymbolicCode(error?.name) || 'Error',
    errorCode: safeSymbolicCode(error?.code),
    postgresCode: /^[0-9A-Z]{5}$/.test(String(error?.code || '')) ? String(error.code) : null,
  };
}

function sendCheckoutError(req, res, error) {
  const status = Number(error?.status || error?.statusCode || 500);
  if (status >= 500) {
    const diagnostic = buildSafePreorderCheckoutDiagnostic(error);
    res.setHeader('X-TeaPlus-Preorder-Stage', diagnostic.stage);
    console.error('[PREORDER_CHECKOUT_FAILURE]', JSON.stringify({
      requestId: req.id || 'req_unknown',
      ...diagnostic,
    }));
  }
  return sendError(res, error);
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

export function validateTablesQuery(query = {}) {
  const { storeId, date } = validateAvailabilityQuery(query);
  const rawHour = typeof query.hour === 'string' ? query.hour.trim() : '';
  if (!/^(?:9|1\d|2[0-2])$/.test(rawHour)) {
    throw invalidQuery('hour', 'PREORDER_SLOT_HOUR_INVALID');
  }
  return { storeId, date, hour: Number(rawHour) };
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

function mountTablesRoute(targetRouter, service) {
  targetRouter.get('/tables', asyncHandler(async (req, res) => {
    try {
      const { storeId, date, hour } = validateTablesQuery(req.query);
      const result = await service.availableTables({ storeId, date, hour });
      res.json(result);
    } catch (error) { sendError(res, error); }
  }));
}

export function createPublicPreordersAvailabilityRouter({ service } = {}) {
  const availabilityRouter = Router();
  const targetService = service || preorderService;
  availabilityRouter.get('/stores', asyncHandler(async (_req, res) => {
    try {
      const stores = await targetService.listStoreAvailability();
      res.json({ stores });
    } catch (error) { sendError(res, error); }
  }));
  mountAvailabilityRoute(availabilityRouter, targetService);
  mountTablesRoute(availabilityRouter, targetService);
  return availabilityRouter;
}

mountAvailabilityRoute(router, preorderService);

router.get('/stores', asyncHandler(async (_req, res) => {
  try {
    const stores = await preorderService.listStoreAvailability();
    res.json({ stores });
  } catch (error) { sendError(res, error); }
}));

mountTablesRoute(router, preorderService);

router.post('/checkout', authenticate, customerOnly, asyncHandler(async (req, res) => {
  try {
    const result = await preorderService.checkout({
      input: req.body || {}, customerUserId: Number(req.user.sub || req.user.id),
      idempotencyKey: req.headers['idempotency-key'],
    });
    res.status(result.replay ? 200 : 201).json(result);
  } catch (error) { sendCheckoutError(req, res, error); }
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
