import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';

export function createPaymentsRepository(database = postgresDb) {
  return {
    async reservePayOSOrder({ orderId, payosOrderCode, paymentExpiresAt }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, order_code, total, payment_link_id, payos_order_code,
                  payment_checkout_url, payment_qr_code, payment_expires_at, checkout_group_id
           FROM orders WHERE id = $1 AND payment_provider = 'payos' AND payment_status = 'unpaid'
             AND checkout_group_id IS NULL
           FOR UPDATE`,
          [orderId],
        );
        const order = rows[0];
        if (!order) return null;
        if (order.payment_link_id || order.payos_order_code) return order;
        const [reserved] = await tx.query(
          `UPDATE orders SET payos_order_code = $2, payment_expires_at = $3,
             payment_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND checkout_group_id IS NULL RETURNING id, order_code, total, payment_link_id, payos_order_code,
             payment_checkout_url, payment_qr_code, payment_expires_at`,
          [orderId, payosOrderCode, paymentExpiresAt],
        );
        return reserved[0];
      });
    },

    async attachPaymentLink({ orderId, paymentLinkId, payosOrderCode, paymentExpiresAt, checkoutUrl = null, qrCode = null }) {
      const [rows] = await database.query(
        `UPDATE orders
         SET payment_link_id = $2, payos_order_code = $3,
             payment_checkout_url = $5, payment_qr_code = $6,
             payment_created_at = CURRENT_TIMESTAMP, payment_expires_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_provider = 'payos' AND payment_status = 'unpaid'
           AND checkout_group_id IS NULL
         RETURNING id, order_code, total, payment_status, payment_provider,
                   payment_link_id, payos_order_code, payment_checkout_url,
                   payment_qr_code, payment_expires_at`,
        [orderId, paymentLinkId, payosOrderCode, paymentExpiresAt, checkoutUrl, qrCode],
      );
      return rows[0] || null;
    },

    async findStatusByOrderCode(orderCode) {
      const [rows] = await database.query(
        `SELECT id, order_code, total, payment_status, payment_provider, paid_at,
                payment_expires_at, payment_link_id, payos_order_code, payment_profile_code
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

    async renewPayOSOrderLink({
      orderCode,
      userId = null,
      cancelToken = null,
      returnUrl = null,
      cancelUrl = null,
      createLinkFn = null,
    }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, order_code, user_id, customer_phone, total,
                  payment_status, payment_provider, current_status, cancel_token_hash,
                  payos_order_code, payment_link_id, payment_checkout_url,
                  payment_qr_code, payment_expires_at, checkout_group_id, payment_profile_code
           FROM orders
           WHERE order_code = $1
           FOR UPDATE`,
          [orderCode],
        );
        const order = rows[0];
        if (!order) {
          const err = new Error('Không tìm thấy đơn hàng');
          err.status = 404;
          throw err;
        }

        const isOwnerByUserId = userId != null && Number(order.user_id) === Number(userId);
        const isOwnerByCancelToken = (() => {
          if (!cancelToken || typeof cancelToken !== 'string' || !order.cancel_token_hash) return false;
          const providedHash = crypto.createHash('sha256').update(cancelToken).digest();
          const storedHash = Buffer.from(String(order.cancel_token_hash).trim(), 'hex');
          return providedHash.length === storedHash.length && crypto.timingSafeEqual(providedHash, storedHash);
        })();

        if (!isOwnerByUserId && !isOwnerByCancelToken) {
          const err = new Error('Bạn không có quyền thao tác trên đơn hàng này');
          err.status = 403;
          throw err;
        }

        if (order.checkout_group_id != null) {
          const err = new Error('Don con trong thanh toan gop khong co QR rieng; hay thanh toan bang ma cua don gop');
          err.status = 409;
          err.code = 'GROUP_CHILD_PAYMENT_MANAGED_BY_GROUP';
          throw err;
        }

        if (order.current_status === 'Đã hủy') {
          const err = new Error('Đơn hàng đã bị hủy, không thể tạo lại mã thanh toán');
          err.status = 400;
          throw err;
        }

        if (order.payment_status === 'paid') {
          const err = new Error('Đơn hàng đã được thanh toán thành công');
          err.status = 400;
          throw err;
        }

        if (order.payment_provider !== 'payos') {
          const err = new Error('Đơn hàng không sử dụng PayOS');
          err.status = 400;
          throw err;
        }

        // A retry after the first regeneration must reuse the active link.
        if (order.payment_link_id && order.payment_expires_at && new Date(order.payment_expires_at).getTime() > Date.now()) {
          return {
            id: order.id,
            order_code: order.order_code,
            total: order.total,
            payment_status: order.payment_status,
            payment_provider: order.payment_provider,
            payment_link_id: order.payment_link_id,
            payos_order_code: order.payos_order_code,
            payment_checkout_url: order.payment_checkout_url,
            payment_qr_code: order.payment_qr_code,
            payment_expires_at: order.payment_expires_at,
          };
        }

        function appendOrderCodeToUrl(baseUrlString, code) {
          if (!baseUrlString || typeof baseUrlString !== 'string') return null;
          try {
            const url = new URL(baseUrlString);
            url.searchParams.set('code', code);
            return url.toString();
          } catch {
            return baseUrlString.includes('?') ? `${baseUrlString}&code=${encodeURIComponent(code)}` : `${baseUrlString}?code=${encodeURIComponent(code)}`;
          }
        }

        const timePart = String(Date.now()).slice(-6);
        const idPart = String(order.id % 10000).padStart(4, '0');
        const newPayosOrderCode = Number(`${timePart}${idPart}`);

        const effectiveReturnUrl = appendOrderCodeToUrl(returnUrl, order.order_code) || returnUrl;
        const effectiveCancelUrl = appendOrderCodeToUrl(cancelUrl, order.order_code) || cancelUrl;

        const createPaymentLink = createLinkFn || (await import('../../services/payos.js')).createPaymentLinkForOrder;
        const payosResult = await createPaymentLink({
          orderId: order.id,
          orderCode: order.order_code,
          total: Number(order.total),
          payosOrderCode: newPayosOrderCode,
          returnUrl: effectiveReturnUrl,
          cancelUrl: effectiveCancelUrl,
          paymentProfileCode: order.payment_profile_code || null,
        });

        const [updatedRows] = await tx.query(
          `UPDATE orders
           SET payos_order_code = $2,
               payment_link_id = $3,
               payment_checkout_url = $4,
               payment_qr_code = $5,
               payment_expires_at = $6,
               payment_status = 'unpaid',
               payment_provider = 'payos',
               payment_created_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND checkout_group_id IS NULL
             AND payment_status != 'paid' AND current_status != 'Đã hủy'
           RETURNING id, order_code, total, payment_status, payment_provider,
                     payment_link_id, payos_order_code, payment_checkout_url,
                     payment_qr_code, payment_expires_at`,
          [
            order.id,
            payosResult.payosOrderCode,
            payosResult.paymentLinkId,
            payosResult.checkoutUrl,
            payosResult.qrCode,
            payosResult.paymentExpiresAt,
          ],
        );

        if (!updatedRows[0]) {
          const err = new Error('Không thể cập nhật mã thanh toán mới');
          err.status = 409;
          throw err;
        }

        return updatedRows[0];
      });
    },

    async simulatePaymentSuccess({ orderCode }) {
      return database.transaction(async (tx) => {
        const [orderRows] = await tx.query(
          `SELECT id, order_code, total, payment_status, payment_provider, current_status
           FROM orders
           WHERE order_code = $1 AND payment_provider = 'payos'
           FOR UPDATE`,
          [orderCode],
        );
        const order = orderRows[0];
        if (!order) {
          const err = new Error('Không tìm thấy đơn hàng');
          err.status = 404;
          throw err;
        }
        if (order.current_status === 'Đã hủy') {
          const err = new Error('Đơn hàng đã bị hủy');
          err.status = 400;
          throw err;
        }
        if (order.payment_provider !== 'payos') {
          const err = new Error('Đơn hàng không sử dụng PayOS');
          err.status = 400;
          throw err;
        }
        if (order.payment_status === 'paid') {
          return { ok: true, message: 'Đơn hàng đã thanh toán từ trước', order };
        }
        const [paidRows] = await tx.query(
          `UPDATE orders
           SET payment_status = 'paid',
               payment_provider = 'payos',
               paid_at = CURRENT_TIMESTAMP,
               transaction_id = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, order_code, total, payment_status, payment_provider, paid_at`,
          [order.id, `SIM_${Date.now()}`],
        );
        return { ok: true, message: 'Thanh toán giả lập thành công', order: paidRows[0] };
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
