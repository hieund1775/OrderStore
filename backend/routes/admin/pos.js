import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus, isOrderBusinessError } from '../../services/orders/order-errors.js';
import { validateCreateOrderInput } from '../../validation/order-schemas.js';
import customerOrderService from '../../services/orders/customer-order-service.js';
import { logAudit } from '../../services/audit.js';

/**
 * Internal POS boundary.  It deliberately reuses customerOrderService so
 * pricing, stock, order snapshots and P1 payment-attempt behavior remain
 * canonical, while keeping the selected store server-authoritative.
 */
export function createAdminPosRouter({
  orderService = customerOrderService,
  auditLogger = logAudit,
} = {}) {
  const router = Router();

  router.post('/orders', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
    try {
      // Super may select a branch. Manager/Cashier must match the branch in
      // their authenticated identity; a spoofed store_id is rejected here.
      const storeId = resolveStoreScope(req.user, req.body?.store_id);

      // POS is counter COD only. Do not let an internal client turn this
      // endpoint into customer Delivery/online checkout by changing fields.
      const validated = validateCreateOrderInput({
        ...req.body,
        store_id: storeId,
        source: 'pos',
        order_type: 'POS',
        payment_method: 'COD',
      });
      const input = {
        ...req.body,
        store_id: validated.storeId,
        table_id: validated.tableId,
        table_token: null,
        source: 'pos',
        order_type: 'POS',
        payment_method: 'COD',
        customer_name: validated.customerName,
        customer_phone: validated.customerPhone,
        note: validated.note,
        delivery_addr: null,
      };
      const order = await orderService.create({
        input,
        // A staff account is never attached to the POS order as a customer.
        userId: null,
        idempotencyKey: String(req.headers['idempotency-key'] || ''),
      });

      await auditLogger(req.user.sub, 'Tạo đơn POS', `store_id=${storeId}`, req);
      return res.status(order.replay ? 200 : 201).json(order);
    } catch (err) {
      return res.status(orderErrorStatus(err)).json({
        error: err.message,
        code: err.code || (isOrderBusinessError(err) ? 'POS_ORDER_BUSINESS_RULE' : 'INTERNAL_SERVER_ERROR'),
      });
    }
  }));

  return router;
}

export default createAdminPosRouter();
