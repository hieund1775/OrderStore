import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { resolveStoreScope } from '../../middleware/branch-scope.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { orderErrorStatus, isOrderBusinessError } from '../../services/orders/order-errors.js';
import { validateCreateOrderInput } from '../../validation/order-schemas.js';
import customerOrderService from '../../services/orders/customer-order-service.js';
import defaultPostgresDb from '../../config/db-postgres.js';
import { logAudit } from '../../services/audit.js';

/**
 * Internal POS boundary.  It deliberately reuses customerOrderService so
 * pricing, stock, order snapshots and P1 payment-attempt behavior remain
 * canonical, while keeping the selected store server-authoritative.
 */
export function createAdminPosRouter({
  orderService = customerOrderService,
  auditLogger = logAudit,
  database = defaultPostgresDb,
} = {}) {
  const router = Router();

  router.post('/orders', requireRole('super', 'manager', 'cashier'), asyncHandler(async (req, res) => {
    try {
      // Super may select a branch. Manager/Cashier must match the branch in
      // their authenticated identity; a spoofed store_id is rejected here.
      const storeId = resolveStoreScope(req.user, req.body?.store_id);

      // POS only serves kitchen lane items
      if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
        const productIds = req.body.items.map((it) => Number(it.product_id || it.id)).filter(Boolean);
        if (productIds.length > 0) {
          const [forbiddenRows] = await database.query(
            `SELECT p.id, p.name
             FROM products p
             JOIN categories c ON c.id = p.category_id
             WHERE p.id = ANY($1) AND COALESCE(p.fulfillment_lane, c.default_fulfillment_lane, 'kitchen') = 'packing'`,
            [productIds],
          );
          if (forbiddenRows && forbiddenRows.length > 0) {
            const forbiddenNames = forbiddenRows.map((r) => r.name).join(', ');
            return res.status(400).json({
              error: `Màn hình POS chỉ phục vụ các món thuộc khu vực Bếp pha chế. Không thể gọi món đóng gói: ${forbiddenNames}`,
              code: 'POS_ONLY_KITCHEN_ALLOWED',
            });
          }
        }
      }

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
