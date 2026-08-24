import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { logAudit } from '../../services/audit.js';
import { VALID_STATUSES } from '../../services/order-transition-policy.js';
import { parseSingleDateBoundary, parseDateRangeBoundaries } from '../../services/date-range.js';
import { decodeCursor, validatePaginationLimit } from '../../services/cursor-pagination.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus } from '../../services/orders/order-errors.js';
import { validateOrderFilters, validateOrderId, validateOrderMutationInput, validateOrderStatus } from '../../validation/order-schemas.js';
import adminOrderService from '../../services/orders/admin-order-service.js';
import { toAdminOrderListItemDto, toAdminOrderDetailDto } from '../../dto/order-dto.js';

const router = Router();

router.get('/', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const { status, store_id, date_from, date_to, search, cursor: rawCursor, limit: rawLimit } = req.query;
    validateOrderFilters({ status, store_id, search });
    const scopedStoreId = resolveStoreScope(req.user, store_id);
    const limit = validatePaginationLimit(rawLimit, 50, 100);
    const cursor = decodeCursor(rawCursor);

    let dateFrom;
    let dateTo;
    if (date_from && date_to) {
      const { start, end } = parseDateRangeBoundaries(date_from, date_to);
      dateFrom = start;
      dateTo = end;
    } else if (date_from) {
      const { start } = parseSingleDateBoundary(date_from);
      dateFrom = start;
    } else if (date_to) {
      const { end } = parseSingleDateBoundary(date_to);
      dateTo = end;
    }

    const result = await adminOrderService.list({
      status, storeId: scopedStoreId, dateFrom, dateTo, search, cursor, limit,
      paginated: rawCursor !== undefined || rawLimit !== undefined,
    });
    if (Array.isArray(result)) {
      return res.json(result.map(toAdminOrderListItemDto));
    }
    res.json({
      ...result,
      orders: result.orders.map(toAdminOrderListItemDto),
    });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

router.get('/:id', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    validateOrderId(req.params.id);
    const scopedStoreId = resolveStoreScope(req.user);
    const order = await adminOrderService.getDetail({ orderId: req.params.id, storeId: scopedStoreId });
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    res.json(toAdminOrderDetailDto(order));
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export const updateOrderStatus = async (req, res) => {
  const { status, note, driver_name, driver_phone, tracking_url } = req.body;
  try {
    validateOrderId(req.params.id);
    validateOrderStatus(status, VALID_STATUSES);
    const validatedInput = validateOrderMutationInput({ note, driver_name, driver_phone, tracking_url });
    const scopedStoreId = resolveStoreScope(req.user);
    const result = await adminOrderService.updateStatus({
      orderId: req.params.id,
      storeId: scopedStoreId,
      status,
      note: validatedInput.note,
      actor: { id: req.user.sub, role: req.user.role },
      driverName: validatedInput.driverName,
      driverPhone: validatedInput.driverPhone,
      trackingUrl: validatedInput.trackingUrl,
    });
    await logAudit(req.user.sub, `Cập nhật trạng thái đơn #${req.params.id}`, `→ ${status}`, req);
    res.json({ ...result, message: `Đơn hàng → ${status}` });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
};

router.put('/:id/status', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(updateOrderStatus));
router.patch('/:id/status', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(updateOrderStatus));

router.put('/:id/cancel', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;
    validateOrderId(req.params.id);
    validateOrderMutationInput({ reason });
    const scopedStoreId = resolveStoreScope(req.user);
    const result = await adminOrderService.cancel({
      orderId: req.params.id,
      storeId: scopedStoreId,
      reason,
      actor: { id: req.user.sub, role: req.user.role },
    });
    await logAudit(req.user.sub, `Hủy đơn #${req.params.id}`, reason || `Hủy bởi ${req.user.role}`, req);
    res.json({ ...result, message: 'Đơn hàng đã bị hủy' });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

router.put('/:id/payment/confirm', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
  try {
    validateOrderId(req.params.id);
    const scopedStoreId = resolveStoreScope(req.user);
    const result = await adminOrderService.confirmPayment({
      orderId: req.params.id,
      storeId: scopedStoreId,
      actor: { id: req.user.sub, role: req.user.role },
    });
    await logAudit(req.user.sub, `Xác nhận thanh toán đơn #${req.params.id}`, '', req);
    res.json({
      message: result.alreadyPaid ? 'Đơn hàng đã được xác nhận thanh toán trước đó' : 'Đã xác nhận thanh toán thành công',
      payment_status: 'paid',
    });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

router.post('/:id/print', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    validateOrderId(req.params.id);
    const scopedStoreId = resolveStoreScope(req.user);
    const marked = await adminOrderService.markPrinted({ orderId: req.params.id, storeId: scopedStoreId });
    if (!marked) return res.status(404).json({ error: 'Không tìm thấy đơn hàng hoặc không có quyền thao tác' });
    await logAudit(req.user.sub, `In hóa đơn đơn #${req.params.id}`, '', req);
    res.json({ message: 'Đã đánh dấu in hóa đơn' });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

export default router;
