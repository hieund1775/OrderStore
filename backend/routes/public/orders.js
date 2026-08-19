import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/env.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus } from '../../services/orders/order-errors.js';
import { validateCreateOrderInput, validateOrderId, validateOrderMutationInput, validateOrderReference } from '../../validation/order-schemas.js';
import customerOrderService from '../../services/orders/customer-order-service.js';

const router = Router();

function extractCustomerUserId(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.role === 'customer' && (decoded.id || decoded.sub)) {
        return Number(decoded.id || decoded.sub);
      }
    } catch {}
  }
  return null;
}

function extractCustomerToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.role === 'customer') {
        return decoded;
      }
    } catch {}
  }
  return null;
}

router.get('/lookup', asyncHandler(async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Thiếu mã đơn' });

    const decodedToken = extractCustomerToken(req);
    const result = await customerOrderService.lookup({ code, tokenUser: decodedToken });
    res.json(result);
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export const handleCustomerCancelOrder = async (req, res) => {
  try {
    const { reason, cancel_token } = req.body || {};
    const orderIdentifier = req.params.id || req.body?.order_id || req.body?.order_code;
    if (req.params.id || req.body?.order_code) validateOrderReference(orderIdentifier);
    if (req.body?.order_id) validateOrderId(req.body.order_id);
    validateOrderMutationInput({ reason });
    const rawCancelToken = (req.headers['x-cancel-token'] || cancel_token || '').trim();
    const authUserId = extractCustomerUserId(req);

    const result = await customerOrderService.cancel({
      identifier: orderIdentifier,
      userId: authUserId,
      cancelToken: rawCancelToken,
      reason,
    });

    res.json(result);
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
};

router.post('/:id/cancel', asyncHandler(handleCustomerCancelOrder));
router.post('/cancel', asyncHandler(handleCustomerCancelOrder));

router.post('/', asyncHandler(async (req, res) => {
  try {
    validateCreateOrderInput(req.body);
    const customerUserId = extractCustomerUserId(req);
    const idempotencyKey = String(req.headers['idempotency-key'] || '');
    const order = await customerOrderService.create({
      input: req.body,
      userId: customerUserId,
      idempotencyKey,
    });

    res.status(order.replay ? 200 : 201).json(order);
  } catch (err) {
    res.status(orderErrorStatus(err)).json({ error: err.message });
  }
}));

export default router;
