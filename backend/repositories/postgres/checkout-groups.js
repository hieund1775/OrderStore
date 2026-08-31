import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';

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
    }) {
      return database.transaction(async (tx) => {
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
            paymentProfile.id ? Number(paymentProfile.id) : null,
            paymentProfile.code,
            Number(paymentProfile.version || 1),
            paymentProfile.bank_name || null,
            paymentProfile.account_number || null,
            paymentProfile.account_holder || null,
            Number(subtotal),
            Number(discountAmount),
            Number(shippingFee),
            Number(totalAmount),
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
              Number(alloc.allocatedSubtotal),
              Number(alloc.allocatedDiscount || 0),
              Number(alloc.allocatedShippingFee || 0),
              Number(alloc.allocatedTotal),
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
              paymentProfile.id ? Number(paymentProfile.id) : null,
              paymentProfile.code,
              Number(paymentProfile.version || 1),
              paymentProfile.bank_name || null,
              paymentProfile.account_number || null,
              paymentProfile.account_holder || null,
              Number(alloc.orderId),
            ],
          );
        }

        return {
          ...group,
          id: Number(group.id),
          allocations,
        };
      });
    },

    async reservePayOSCheckoutGroup({ groupId, payosOrderCode, paymentExpiresAt }) {
      return database.transaction(async (tx) => {
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
      });
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
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'order_id', cga.order_id,
                    'order_code', o.order_code,
                    'root_category_id', cga.root_category_id,
                    'root_category_name', cga.root_category_name,
                    'allocated_subtotal', cga.allocated_subtotal,
                    'allocated_discount', cga.allocated_discount,
                    'allocated_shipping_fee', cga.allocated_shipping_fee,
                    'allocated_total', cga.allocated_total
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

    async markGroupPaid({ groupId, reference }) {
      return database.transaction(async (tx) => {
        const [groupRows] = await tx.query(
          `UPDATE checkout_groups
           SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND payment_status = 'unpaid'
           RETURNING id, group_code, total_amount`,
          [Number(groupId)],
        );
        if (!groupRows[0]) return null;

        // Cascade to child orders
        await tx.query(
          `UPDATE orders
           SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP,
               transaction_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE checkout_group_id = $1 AND payment_status = 'unpaid'`,
          [Number(groupId), reference || null],
        );

        return groupRows[0];
      });
    },
  };
}

export const checkoutGroupsRepository = createCheckoutGroupsRepository();
export default checkoutGroupsRepository;
