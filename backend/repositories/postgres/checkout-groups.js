import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';
import { createPaymentLinkForOrder } from '../../services/payos.js';
import config from '../../config/env.js';

export class CheckoutGroupError extends Error {
  constructor(message, status = 400, code = 'CHECKOUT_GROUP_ERROR') {
    super(message);
    this.name = 'CheckoutGroupError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export function generateGroupCode(randomInt = crypto.randomInt) {
  const rand = randomInt(100000, 999999);
  return `GRP${Date.now().toString().slice(-6)}${rand}`;
}

function makePayOSCode(id) {
  return Number(`${String(Date.now()).slice(-6)}${String(Number(id) % 10000).padStart(4, '0')}`);
}

export function verifyGroupOwnership(group, { userId = null, cancelToken = null } = {}) {
  if (!group) {
    throw new CheckoutGroupError('Không tìm thấy đơn hàng gộp', 404, 'GROUP_NOT_FOUND');
  }

  // 1. Group created by logged-in user
  if (group.user_id != null) {
    if (!userId) {
      throw new CheckoutGroupError('Vui lòng đăng nhập để xem đơn hàng này', 401, 'CUSTOMER_AUTH_REQUIRED');
    }
    if (Number(group.user_id) !== Number(userId)) {
      throw new CheckoutGroupError('Bạn không có quyền truy cập đơn hàng này', 403, 'GROUP_FORBIDDEN');
    }
    return true;
  }

  // 2. Group created by guest
  if (!cancelToken || typeof cancelToken !== 'string' || !cancelToken.trim()) {
    throw new CheckoutGroupError('Yêu cầu token xác thực cho đơn hàng khách vãng lai', 401, 'GUEST_TOKEN_REQUIRED');
  }

  const providedHash = crypto.createHash('sha256').update(cancelToken.trim()).digest('hex');
  const hashes = Array.isArray(group.cancel_token_hashes) ? group.cancel_token_hashes : [];

  if (!hashes.includes(providedHash)) {
    throw new CheckoutGroupError('Token xác thực đơn hàng không hợp lệ', 403, 'GUEST_TOKEN_INVALID');
  }

  return true;
}

export function createCheckoutGroupsRepository(database = postgresDb) {
  return {
    async createCheckoutGroup({
      storeId,
      userId = null,
      subtotal,
      discountAmount = 0,
      shippingFee = 0,
      totalAmount,
      voucherCode = null,
      paymentProfile,
      allocations = [],
    }, { tx: externalTx } = {}) {
      const runner = async (tx) => {
        const paymentProfileCode = String(paymentProfile?.code || '').trim();
        if (!paymentProfileCode) {
          throw new CheckoutGroupError('Thiếu payment profile cho nhóm thanh toán', 400, 'PAYMENT_PROFILE_REQUIRED');
        }
        const groupCode = generateGroupCode();

        const [groupRows] = await tx.query(
          `INSERT INTO checkout_groups
             (group_code, store_id, user_id, payment_provider, payment_status,
              payment_profile_id, payment_profile_code, payment_profile_version,
              receiver_bank_name, receiver_account_number, receiver_account_holder,
              subtotal, discount_amount, shipping_fee, total_amount, voucher_code,
              created_at, updated_at)
           VALUES ($1, $2, $3, 'payos', 'unpaid', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            groupCode,
            Number(storeId),
            userId ? Number(userId) : null,
            paymentProfile?.id ? Number(paymentProfile.id) : null,
            paymentProfileCode,
            Number(paymentProfile?.version || 1),
            paymentProfile?.bank_name || null,
            paymentProfile?.account_number || null,
            paymentProfile?.account_holder || null,
            Math.round(Number(subtotal)),
            Math.round(Number(discountAmount)),
            Math.round(Number(shippingFee)),
            Math.round(Number(totalAmount)),
            voucherCode || null,
          ],
        );

        const group = groupRows[0];

        // Insert allocations and link child orders
        for (const alloc of allocations) {
          await tx.query(
            `INSERT INTO checkout_group_allocations
               (checkout_group_id, order_id, root_category_id, root_category_name,
                root_category_slug, allocated_subtotal, allocated_discount,
                allocated_shipping_fee, allocated_total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              group.id,
              Number(alloc.orderId),
              Number(alloc.rootCategoryId),
              alloc.rootCategoryName,
              alloc.rootCategorySlug,
              Math.round(Number(alloc.allocatedSubtotal)),
              Math.round(Number(alloc.allocatedDiscount || 0)),
              Math.round(Number(alloc.allocatedShippingFee || 0)),
              Math.round(Number(alloc.allocatedTotal)),
            ],
          );

          await tx.query(
            `UPDATE orders
             SET checkout_group_id = $1, root_category_id = $2,
                 payment_profile_id = $3, payment_profile_code = $4,
                 payment_profile_version = $5, receiver_bank_name = $6,
                 receiver_account_number = $7, receiver_account_holder = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              group.id,
              Number(alloc.rootCategoryId),
              paymentProfile?.id ? Number(paymentProfile.id) : null,
              paymentProfileCode,
              Number(paymentProfile?.version || 1),
              paymentProfile?.bank_name || null,
              paymentProfile?.account_number || null,
              paymentProfile?.account_holder || null,
              Number(alloc.orderId),
            ],
          );
        }

        return {
          ...group,
          id: Number(group.id),
          allocations,
        };
      };

      if (externalTx) {
        return runner(externalTx);
      }
      return database.transaction(runner);
    },

    async reservePayOSCheckoutGroup({ groupId, payosOrderCode, paymentExpiresAt }, { tx: externalTx } = {}) {
      const runner = async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, group_code, total_amount, payment_link_id, payos_order_code,
                  payment_checkout_url, payment_qr_code, payment_expires_at,
                  payment_profile_code, payment_profile_version
           FROM checkout_groups WHERE id = $1 AND payment_status = 'unpaid'
           FOR UPDATE`,
          [Number(groupId)],
        );
        const group = rows[0];
        if (!group) return null;
        if (group.payment_link_id || group.payos_order_code) return group;

        const [reserved] = await tx.query(
          `UPDATE checkout_groups
           SET payos_order_code = $2, payment_expires_at = $3,
               payment_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, group_code, total_amount, payment_link_id, payos_order_code,
                     payment_checkout_url, payment_qr_code, payment_expires_at,
                     payment_profile_code, payment_profile_version`,
          [Number(groupId), payosOrderCode, paymentExpiresAt],
        );
        return reserved[0];
      };

      if (externalTx) {
        return runner(externalTx);
      }
      return database.transaction(runner);
    },

    async attachPaymentLinkToGroup({
      groupId,
      paymentLinkId,
      payosOrderCode,
      paymentExpiresAt,
      checkoutUrl = null,
      qrCode = null,
    }) {
      const [rows] = await database.query(
        `UPDATE checkout_groups
         SET payment_link_id = $2, payos_order_code = $3,
             payment_checkout_url = $5, payment_qr_code = $6,
             payment_created_at = CURRENT_TIMESTAMP, payment_expires_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_status = 'unpaid'
         RETURNING id, group_code, total_amount, payment_status, payment_provider,
                   payment_link_id, payos_order_code, payment_checkout_url,
                   payment_qr_code, payment_expires_at, payment_profile_code`,
        [Number(groupId), paymentLinkId, payosOrderCode, paymentExpiresAt, checkoutUrl, qrCode],
      );
      return rows[0] || null;
    },

    async findGroupByCode(groupCode) {
      const [rows] = await database.query(
        `SELECT cg.*,
                COALESCE(
                  JSONB_AGG(o.cancel_token_hash) FILTER (WHERE o.cancel_token_hash IS NOT NULL),
                  '[]'::jsonb
                ) AS cancel_token_hashes,
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'order_id', cga.order_id,
                    'order_code', o.order_code,
                    'root_category_id', cga.root_category_id,
                    'root_category_name', COALESCE(cga.root_category_name, 'Chưa phân loại'),
                    'allocated_subtotal', cga.allocated_subtotal,
                    'allocated_discount', cga.allocated_discount,
                    'allocated_shipping_fee', cga.allocated_shipping_fee,
                    'allocated_total', cga.allocated_total,
                    'payment_status', o.payment_status,
                    'status', (
                      SELECT status FROM order_status_history osh
                      WHERE osh.order_id = o.id
                      ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1
                    ),
                    'items', COALESCE((
                      SELECT JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                          'product_id', oi.product_id,
                          'product_name', oi.product_name,
                          'quantity', oi.qty,
                          'unit_price', oi.unit_price,
                          'line_total', oi.line_total
                        )
                      ) FROM order_items oi WHERE oi.order_id = o.id
                    ), '[]'::jsonb)
                  )
                ) AS child_orders
         FROM checkout_groups cg
         LEFT JOIN checkout_group_allocations cga ON cga.checkout_group_id = cg.id
         LEFT JOIN orders o ON o.id = cga.order_id
         WHERE cg.group_code = $1
         GROUP BY cg.id`,
        [groupCode],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        ...r,
        id: Number(r.id),
        subtotal: Number(r.subtotal),
        discount_amount: Number(r.discount_amount),
        shipping_fee: Number(r.shipping_fee),
        total_amount: Number(r.total_amount),
        cancel_token_hashes: Array.isArray(r.cancel_token_hashes) ? r.cancel_token_hashes : [],
        child_orders: Array.isArray(r.child_orders) ? r.child_orders : [],
      };
    },

    async findGroupByPayOSOrderCode(payosOrderCode) {
      const [rows] = await database.query(
        `SELECT * FROM checkout_groups WHERE payos_order_code = $1 LIMIT 1`,
        [payosOrderCode],
      );
      return rows[0] || null;
    },

    async findGroupByPaymentLinkId(paymentLinkId) {
      const [rows] = await database.query(
        `SELECT * FROM checkout_groups WHERE payment_link_id = $1 LIMIT 1`,
        [paymentLinkId],
      );
      return rows[0] || null;
    },

    async processSuccessfulGroupWebhook({ eventKey, orderCode, amount, reference, paymentLinkId, payload = {} }) {
      return database.transaction(async (tx) => {
        // 1. Record event for idempotency
        const [eventRows] = await tx.query(
          `INSERT INTO payment_events (provider, provider_event_key, event_type, payload)
           VALUES ('payos', $1, 'payment.succeeded.group', $2::jsonb)
           ON CONFLICT (provider_event_key) DO NOTHING
           RETURNING id`,
          [eventKey, JSON.stringify(payload)],
        );
        if (!eventRows[0]) return { kind: 'duplicate' };
        const eventId = eventRows[0].id;

        const finishEvent = async ({ status, errorCode = null }) => {
          await tx.query(
            `UPDATE payment_events
             SET processing_status = $1, error_code = $2, processed_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [status, errorCode, eventId],
          );
        };

        // 2. Lock checkout_groups record
        const [groupRows] = await tx.query(
          `SELECT id, group_code, total_amount, payment_status, payment_provider
           FROM checkout_groups
           WHERE payos_order_code = $1 OR payment_link_id = $2
           FOR UPDATE`,
          [orderCode, paymentLinkId || null],
        );
        const group = groupRows[0];
        if (!group) {
          await finishEvent({ status: 'ignored', errorCode: 'NOT_FOUND' });
          return { kind: 'not_found', eventId };
        }

        if (group.payment_status === 'paid') {
          await finishEvent({ status: 'processed', errorCode: 'ALREADY_PAID' });
          return { kind: 'already_paid', eventId, group };
        }

        if (group.payment_status === 'expired' || group.payment_status === 'cancelled') {
          await finishEvent({ status: 'ignored', errorCode: group.payment_status.toUpperCase() });
          return { kind: group.payment_status, eventId, group };
        }

        // Amount verification
        if (Math.round(Number(group.total_amount)) !== Math.round(Number(amount))) {
          await finishEvent({ status: 'ignored', errorCode: 'AMOUNT_MISMATCH' });
          return { kind: 'amount_mismatch', eventId, group };
        }

        // CAS update checkout_groups
        const [paidRows] = await tx.query(
          `UPDATE checkout_groups
           SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND payment_status = 'unpaid' AND total_amount = $2
           RETURNING id, group_code, total_amount`,
          [group.id, amount],
        );
        if (!paidRows[0]) {
          await finishEvent({ status: 'ignored', errorCode: 'CAS_REJECTED' });
          return { kind: 'cas_rejected', eventId, group };
        }

        // Cascade to all child orders
        await tx.query(
          `UPDATE orders
           SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP,
               transaction_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE checkout_group_id = $1 AND payment_status = 'unpaid'`,
          [group.id, reference || String(orderCode)],
        );

        await finishEvent({ status: 'processed' });
        return { kind: 'paid', eventId, group };
      });
    },

    async renewGroupPayOSLink({ groupCode, userId = null, cancelToken = null }) {
      return database.transaction(async (tx) => {
        const [groupRows] = await tx.query(
          `SELECT cg.*,
                  COALESCE(
                    JSONB_AGG(o.cancel_token_hash) FILTER (WHERE o.cancel_token_hash IS NOT NULL),
                    '[]'::jsonb
                  ) AS cancel_token_hashes
           FROM checkout_groups cg
           LEFT JOIN checkout_group_allocations cga ON cga.checkout_group_id = cg.id
           LEFT JOIN orders o ON o.id = cga.order_id
           WHERE cg.group_code = $1
           GROUP BY cg.id
           FOR UPDATE`,
          [groupCode],
        );
        const group = groupRows[0];
        if (!group) throw new CheckoutGroupError('Không tìm thấy đơn hàng gộp', 404);

        // Strict ownership verification
        verifyGroupOwnership({
          ...group,
          cancel_token_hashes: Array.isArray(group.cancel_token_hashes) ? group.cancel_token_hashes : [],
        }, { userId, cancelToken });

        if (group.payment_status === 'paid') {
          throw new CheckoutGroupError('Đơn hàng đã được thanh toán từ trước', 400);
        }
        if (group.payment_status === 'cancelled') {
          throw new CheckoutGroupError('Đơn hàng đã bị hủy, không thể tạo lại thanh toán', 400);
        }

        const newPayosOrderCode = makePayOSCode(group.id);
        const timeoutMinutes = parseInt(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || '15', 10);
        const newExpiresAt = new Date(Date.now() + timeoutMinutes * 60_000);

        const link = await createPaymentLinkForOrder({
          orderId: group.id,
          orderCode: group.group_code,
          total: Number(group.total_amount),
          payosOrderCode: newPayosOrderCode,
          paymentExpiresAt: newExpiresAt,
          paymentProfileCode: group.payment_profile_code,
        });

        const [updatedRows] = await tx.query(
          `UPDATE checkout_groups
           SET payment_link_id = $2, payos_order_code = $3,
               payment_checkout_url = $4, payment_qr_code = $5,
               payment_created_at = CURRENT_TIMESTAMP, payment_expires_at = $6,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [group.id, link.paymentLinkId, newPayosOrderCode, link.checkoutUrl, link.qrCode, newExpiresAt],
        );

        return updatedRows[0];
      });
    },

    async findGroupForCustomerLookup(groupCode, { userId = null, cancelToken = null } = {}) {
      const group = await this.findGroupByCode(groupCode);
      if (!group) return null;

      // Strict ownership verification
      verifyGroupOwnership(group, { userId, cancelToken });

      const industries = (group.child_orders || []).map((co) => ({
        root_category_id: co.root_category_id ? String(co.root_category_id) : null,
        root_category_name: co.root_category_name || 'Chưa phân loại',
        order_id: String(co.order_id || ''),
        order_code: co.order_code || '',
        subtotal: Number(co.allocated_subtotal || 0),
        discount_amount: Number(co.allocated_discount || 0),
        shipping_fee: Number(co.allocated_shipping_fee || 0),
        total_amount: Number(co.allocated_total || 0),
        status: co.status || 'Đang chuẩn bị',
        payment_status: co.payment_status || group.payment_status || 'unpaid',
        items: Array.isArray(co.items) ? co.items.map((it) => ({
          product_id: String(it.product_id || ''),
          product_name: it.product_name || '',
          quantity: Number(it.quantity || it.qty || 1),
          unit_price: Number(it.unit_price || 0),
          line_total: Number(it.line_total || 0),
        })) : [],
      }));

      return {
        group_code: group.group_code,
        payment_status: group.payment_status,
        payment_provider: group.payment_provider,
        subtotal: group.subtotal,
        discount_amount: group.discount_amount,
        shipping_fee: group.shipping_fee,
        total_amount: group.total_amount,
        payment_checkout_url: group.payment_checkout_url,
        payment_qr_code: group.payment_qr_code,
        payment_expires_at: group.payment_expires_at,
        created_at: group.created_at,
        child_orders: industries.map((ind) => ({
          order_id: ind.order_id,
          order_code: ind.order_code,
          root_category_id: ind.root_category_id,
          root_category_name: ind.root_category_name,
          allocated_subtotal: ind.subtotal,
          allocated_discount: ind.discount_amount,
          allocated_shipping_fee: ind.shipping_fee,
          allocated_total: ind.total_amount,
          status: ind.status,
          payment_status: ind.payment_status,
          items: ind.items,
        })),
        payment_summary: {
          is_grouped: true,
          group_code: group.group_code,
          subtotal: Number(group.subtotal),
          discount_amount: Number(group.discount_amount),
          shipping_fee: Number(group.shipping_fee),
          total_amount: Number(group.total_amount),
          industries,
        },
      };
    },
  };
}

export const checkoutGroupsRepository = createCheckoutGroupsRepository();
export default checkoutGroupsRepository;
