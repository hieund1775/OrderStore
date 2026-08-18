import postgresDb from '../../config/db-postgres.js';

export function createPaymentsRepository(database = postgresDb) {
  return {
    async reservePayOSOrder({ orderId, payosOrderCode, paymentExpiresAt }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, order_code, total, payment_link_id, payos_order_code, payment_expires_at
           FROM orders WHERE id = $1 AND payment_provider = 'payos' AND payment_status = 'unpaid'
           FOR UPDATE`,
          [orderId],
        );
        const order = rows[0];
        if (!order) return null;
        if (order.payment_link_id || order.payos_order_code) return order;
        const [reserved] = await tx.query(
          `UPDATE orders SET payos_order_code = $2, payment_expires_at = $3,
             payment_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING id, order_code, total, payment_link_id, payos_order_code, payment_expires_at`,
          [orderId, payosOrderCode, paymentExpiresAt],
        );
        return reserved[0];
      });
    },

    async attachPaymentLink({ orderId, paymentLinkId, payosOrderCode, paymentExpiresAt }) {
      const [rows] = await database.query(
        `UPDATE orders
         SET payment_link_id = $2, payos_order_code = $3,
             payment_created_at = CURRENT_TIMESTAMP, payment_expires_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_provider = 'payos' AND payment_status = 'unpaid'
         RETURNING id, order_code, total, payment_status, payment_provider,
                   payment_link_id, payos_order_code, payment_expires_at`,
        [orderId, paymentLinkId, payosOrderCode, paymentExpiresAt],
      );
      return rows[0] || null;
    },

    async findStatusByOrderCode(orderCode) {
      const [rows] = await database.query(
        `SELECT id, order_code, total, payment_status, payment_provider, paid_at,
                payment_expires_at, payment_link_id, payos_order_code
         FROM orders WHERE order_code = $1 LIMIT 1`,
        [orderCode],
      );
      return rows[0] || null;
    },

    async processSuccessfulWebhook({ eventKey, orderCode, amount, reference, paymentLinkId, payload = {} }) {
      return database.transaction(async (tx) => {
        const [eventRows] = await tx.query(
          `INSERT INTO payment_events (provider, provider_event_key, event_type, payload)
           VALUES ('payos', $1, 'payment.succeeded', $2::jsonb)
           ON CONFLICT (provider_event_key) DO NOTHING
           RETURNING id`,
          [eventKey, JSON.stringify(payload)],
        );
        if (!eventRows[0]) return { kind: 'duplicate' };
        const eventId = eventRows[0].id;
        const finishEvent = async ({ orderId = null, status, errorCode = null }) => {
          await tx.query(
            `UPDATE payment_events
             SET order_id = $1, processing_status = $2, error_code = $3,
                 processed_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [orderId, status, errorCode, eventId],
          );
        };

        const [orderRows] = await tx.query(
          `SELECT id, order_code, total, payment_status, payment_provider
           FROM orders
           WHERE payos_order_code = $1 OR payment_link_id = $2
           FOR UPDATE`,
          [orderCode, paymentLinkId || null],
        );
        const order = orderRows[0];
        if (!order) {
          await finishEvent({ status: 'ignored', errorCode: 'NOT_FOUND' });
          return { kind: 'not_found', eventId };
        }
        if (order.payment_status === 'paid') {
          await finishEvent({ orderId: order.id, status: 'processed', errorCode: 'ALREADY_PAID' });
          return { kind: 'already_paid', eventId, order };
        }
        if (order.payment_status === 'expired') {
          await finishEvent({ orderId: order.id, status: 'ignored', errorCode: 'EXPIRED' });
          return { kind: 'expired', eventId, order };
        }
        if (order.payment_provider !== 'payos') {
          await finishEvent({ orderId: order.id, status: 'ignored', errorCode: 'WRONG_PROVIDER' });
          return { kind: 'wrong_provider', eventId, order };
        }
        if (Number(order.total) !== Number(amount)) {
          await finishEvent({ orderId: order.id, status: 'ignored', errorCode: 'AMOUNT_MISMATCH' });
          return { kind: 'amount_mismatch', eventId, order };
        }

        const [paidRows] = await tx.query(
          `UPDATE orders
           SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP,
               transaction_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND payment_provider = 'payos'
             AND payment_status = 'unpaid' AND total = $3
           RETURNING id`,
          [order.id, reference || String(orderCode), amount],
        );
        if (!paidRows[0]) {
          await finishEvent({ orderId: order.id, status: 'ignored', errorCode: 'CAS_REJECTED' });
          return { kind: 'cas_rejected', eventId, order };
        }
        await finishEvent({ orderId: order.id, status: 'processed' });
        return { kind: 'paid', eventId, order };
      });
    },

    async expireUnpaidPayOSOrders(limit = 100) {
      const batchSize = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 1000);
      return database.transaction(async (tx) => {
        await tx.query("SELECT pg_advisory_xact_lock(hashtext('teaplus_payos_expiry'))");
        const [rows] = await tx.query(
          `WITH due AS (
             SELECT id FROM orders
             WHERE payment_provider = 'payos' AND payment_status = 'unpaid'
               AND payment_expires_at IS NOT NULL AND payment_expires_at < CURRENT_TIMESTAMP
             ORDER BY payment_expires_at ASC
             LIMIT $1 FOR UPDATE SKIP LOCKED
           )
           UPDATE orders o SET payment_status = 'expired', updated_at = CURRENT_TIMESTAMP
           FROM due WHERE o.id = due.id
           RETURNING o.id, o.order_code`,
          [batchSize],
        );
        return rows;
      });
    },
  };
}

export const paymentsRepository = createPaymentsRepository();
export default paymentsRepository;
