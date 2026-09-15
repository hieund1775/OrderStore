import postgresDb from '../../config/db-postgres.js';
import { batchLoadPostgresOrderDetails } from '../../services/order-batch-loader.js';

export const PREORDER_STATUSES = Object.freeze([
  'AWAITING_PAYMENT',
  'PENDING_MANAGER_CONFIRMATION',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CUSTOMER_CANCELLED',
  'NO_SHOW',
  'PAYMENT_EXPIRED',
  'LATE_PAID_REQUIRES_ACTION',
]);

export class PreorderRepositoryError extends Error {
  constructor(message, status = 409, code = 'PREORDER_REPOSITORY_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function rowsOf(result) {
  return Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : (result?.rows || []);
}

async function inTransaction(database, tx, runner) {
  return tx ? runner(tx) : database.transaction(runner);
}

export function createPreordersRepository(database = postgresDb) {
  // 0033 adds customer check-in requests.  Runtime can be deployed ahead of
  // that additive migration, so read paths must not reference its table until
  // PostgreSQL confirms that it exists.  This is deliberately read-only and
  // preserves the full check-in projection once 0033 is present.
  async function checkinProjection(executor = database) {
    const availability = rowsOf(await executor.query(
      "SELECT to_regclass('preorder_checkin_requests') IS NOT NULL AS available",
    ));
    const isAvailable = availability[0]?.available === true;
    if (!isAvailable) {
      return {
        columns: `NULL::bigint AS checkin_request_id,
                  NULL::varchar AS checkin_request_status,
                  NULL::timestamptz AS checkin_requested_at,
                  NULL::varchar AS checkin_late_confirmation_reason,
                  NULL::varchar AS checkin_rejection_reason`,
        join: '',
      };
    }

    return {
      columns: `checkin.id AS checkin_request_id,
                checkin.status AS checkin_request_status,
                checkin.requested_at AS checkin_requested_at,
                checkin.late_confirmation_reason AS checkin_late_confirmation_reason,
                checkin.rejection_reason AS checkin_rejection_reason`,
      join: `LEFT JOIN LATERAL (
               SELECT pcr.id, pcr.status, pcr.requested_at, pcr.late_confirmation_reason, pcr.rejection_reason
               FROM preorder_checkin_requests pcr
               WHERE pcr.preorder_id = p.id AND pcr.scheduled_start_at = p.scheduled_start_at
               ORDER BY pcr.id DESC LIMIT 1
             ) checkin ON TRUE`,
    };
  }

  async function attachLinkedOrders(preorders) {
    if (!preorders.length) return preorders;
    const preorderIds = preorders.map((preorder) => Number(preorder.id));
    const orders = rowsOf(await database.query(
      `SELECT o.id, o.preorder_id, o.order_code, o.order_type, o.payment_status,
              o.subtotal, o.discount_amount, o.total,
              latest.status AS current_status
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT status FROM order_status_history osh
            WHERE osh.order_id = o.id
            ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1
         ) latest ON TRUE
        WHERE o.preorder_id = ANY($1::bigint[])
        ORDER BY o.preorder_id, o.id`,
      [preorderIds],
    ));
    await batchLoadPostgresOrderDetails(orders, database.query.bind(database));
    const ordersByPreorder = new Map();
    for (const order of orders) {
      const key = String(order.preorder_id);
      const list = ordersByPreorder.get(key) || [];
      list.push(order);
      ordersByPreorder.set(key, list);
    }
    return preorders.map((preorder) => ({
      ...preorder,
      orders: ordersByPreorder.get(String(preorder.id)) || [],
    }));
  }

  async function attachReviewsToPreorders(preorders) {
    if (!preorders.length) return preorders;
    const itemIds = [];
    for (const p of preorders) {
      for (const o of p.orders || []) {
        for (const it of o.items || []) {
          if (it.id) itemIds.push(Number(it.id));
        }
      }
    }
    if (!itemIds.length) return preorders;
    const reviews = rowsOf(await database.query(
      `SELECT r.id, r.order_item_id, r.user_id, r.reply_comment, r.reply_at,
              rev.rating, rev.comment, rev.created_at
       FROM reviews r
       LEFT JOIN review_revisions rev ON rev.id = r.current_revision_id
       WHERE r.order_item_id = ANY($1::bigint[])`,
      [itemIds],
    ));
    const reviewsByItemId = new Map();
    for (const r of reviews) {
      reviewsByItemId.set(String(r.order_item_id), {
        id: Number(r.id),
        rating: Number(r.rating || 0),
        comment: r.comment || '',
        created_at: r.created_at,
        reply_comment: r.reply_comment || null,
        reply_at: r.reply_at || null,
      });
    }
    for (const p of preorders) {
      const pReviews = [];
      for (const o of p.orders || []) {
        for (const it of o.items || []) {
          const rev = reviewsByItemId.get(String(it.id));
          if (rev) {
            it.review = rev;
            pReviews.push({
              order_item_id: it.id,
              product_id: it.product_id,
              product_name: it.product_name,
              ...rev,
            });
          }
        }
      }
      p.reviews = pReviews;
    }
    return preorders;
  }

  async function loadCustomerPreorders(customerUserId, preorderCode = null, { page = null, limit = null } = {}) {
    const values = [Number(customerUserId)];
    const codeFilter = preorderCode == null
      ? " AND p.status NOT IN ('AWAITING_PAYMENT', 'PAYMENT_EXPIRED')"
      : ` AND p.preorder_code = $${values.push(String(preorderCode))}`;
    const checkin = await checkinProjection(database);

    const isPaginated = page != null && limit != null;
    let countColumn = '';
    let paginationClause = '';
    if (isPaginated) {
      countColumn = ', COUNT(*) OVER() AS total_count';
      paginationClause = ` LIMIT $${values.push(limit)} OFFSET $${values.push((page - 1) * limit)}`;
    }

    const preorders = rowsOf(await database.query(
      `SELECT p.*, s.name AS store_name,
              r.table_id, t.name AS table_name, r.status AS reservation_status,
              r.reserved_from, r.reserved_until,
              ${checkin.columns}
              ${countColumn}
         FROM preorders p
         JOIN stores s ON s.id = p.store_id
         LEFT JOIN preorder_table_reservations r ON r.preorder_id = p.id
         LEFT JOIN tables t ON t.id = r.table_id
         ${checkin.join}
        WHERE p.customer_user_id = $1${codeFilter}
        ORDER BY p.scheduled_start_at DESC, p.id DESC
        ${paginationClause}`,
      values,
    ));

    let totalItems = 0;
    if (isPaginated) {
      if (preorders.length > 0) {
        totalItems = Number(preorders[0].total_count) || 0;
      } else if (page > 1) {
        const countRes = rowsOf(await database.query(
          `SELECT COUNT(*)::int AS total FROM preorders p WHERE p.customer_user_id = $1${codeFilter}`,
          [Number(customerUserId)],
        ));
        totalItems = Number(countRes[0]?.total) || 0;
      }
    }

    if (!preorders.length) return isPaginated ? { items: [], totalItems } : [];

    const mapped = preorders.map((p) => ({
      ...p,
      checkin_request: p.checkin_request_id ? {
        id: Number(p.checkin_request_id),
        status: p.checkin_request_status,
        requested_at: p.checkin_requested_at,
        late_confirmation_reason: p.checkin_late_confirmation_reason,
        rejection_reason: p.checkin_rejection_reason,
      } : null,
    }));

    const items = await attachLinkedOrders(mapped);
    return isPaginated ? { items, totalItems } : items;
  }

  return {
    async getActiveStoreSetting(storeId, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `SELECT pss.store_id, pss.is_enabled, pss.responsible_manager_id,
                u.is_active AS manager_is_active, u.admin_role, u.admin_branch_id,
                s.is_active AS store_is_active
         FROM preorder_store_settings pss
         JOIN stores s ON s.id = pss.store_id
         LEFT JOIN users u ON u.id = pss.responsible_manager_id
         WHERE pss.store_id = $1${forUpdate ? ' FOR UPDATE OF pss' : ''}`,
        [Number(storeId)],
      ));
      const setting = rows[0] || null;
      if (!setting || setting.is_enabled !== true || setting.store_is_active !== true
        || setting.manager_is_active !== true || setting.admin_role !== 'manager'
        || Number(setting.admin_branch_id) !== Number(storeId)) {
        return null;
      }
      return setting;
    },

    // Public configuration state only. It intentionally exposes neither the
    // responsible Manager nor any staff data; checkout revalidates the same
    // conditions inside its transaction.
    async listPublicStoreAvailability() {
      const rows = rowsOf(await database.query(
        `SELECT s.id AS store_id,
                (pss.is_enabled = TRUE
                 AND u.is_active = TRUE
                 AND u.admin_role = 'manager'
                 AND u.admin_branch_id = s.id) AS is_available
           FROM stores s
           LEFT JOIN preorder_store_settings pss ON pss.store_id = s.id
           LEFT JOIN users u ON u.id = pss.responsible_manager_id
          WHERE s.is_active = TRUE
          ORDER BY s.id`,
      ));
      return rows.map((row) => ({
        store_id: Number(row.store_id),
        is_available: row.is_available === true,
      }));
    },

    async setStoreSetting({ storeId, enabled, responsibleManagerId }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_store_settings (store_id, is_enabled, responsible_manager_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (store_id) DO UPDATE
           SET is_enabled = EXCLUDED.is_enabled,
               responsible_manager_id = EXCLUDED.responsible_manager_id,
               updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [Number(storeId), Boolean(enabled), responsibleManagerId == null ? null : Number(responsibleManagerId)],
      ));
      return rows[0] || null;
    },

    // This view is intentionally for Super configuration only. The eligible
    // Manager list is assembled by the database from canonical staff fields,
    // rather than trusting a client-provided branch or role.
    async listStoreSettingsForSuper() {
      const rows = rowsOf(await database.query(
        `SELECT s.id AS store_id,
                s.name AS store_name,
                s.is_active AS store_is_active,
                COALESCE(pss.is_enabled, FALSE) AS is_enabled,
                pss.responsible_manager_id,
                COALESCE(managers.eligible_managers, '[]'::jsonb) AS eligible_managers
         FROM stores s
         LEFT JOIN preorder_store_settings pss ON pss.store_id = s.id
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(
                    jsonb_build_object('id', u.id, 'fullname', u.fullname)
                    ORDER BY u.fullname, u.id
                  ) AS eligible_managers
           FROM users u
           WHERE u.admin_role = 'manager'
             AND u.admin_branch_id = s.id
             AND u.is_active = TRUE
         ) managers ON TRUE
         WHERE s.is_active = TRUE
         ORDER BY s.name, s.id`,
      ));
      return rows.map((row) => ({
        ...row,
        eligible_managers: Array.isArray(row.eligible_managers) ? row.eligible_managers : [],
      }));
    },

    async findByCustomerIdempotency({ customerUserId, idempotencyKey }, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `SELECT p.* FROM preorders p
         WHERE p.customer_user_id = $1 AND p.checkout_idempotency_key = $2${forUpdate ? ' FOR UPDATE' : ''}`,
        [Number(customerUserId), String(idempotencyKey)],
      ));
      return rows[0] || null;
    },

    async createAwaitingPayment({ preorderCode, storeId, customerUserId, idempotencyKey, scheduledStartAt, scheduledEndAt, responsibleManagerId }, { tx = null } = {}) {
      return inTransaction(database, tx, async (runner) => {
        const rows = rowsOf(await runner.query(
          `INSERT INTO preorders
             (preorder_code, store_id, customer_user_id, checkout_idempotency_key,
              scheduled_start_at, scheduled_end_at, status, responsible_manager_id)
           VALUES ($1,$2,$3,$4,$5,$6,'AWAITING_PAYMENT',$7)
           RETURNING *`,
          [preorderCode, Number(storeId), Number(customerUserId), String(idempotencyKey), scheduledStartAt, scheduledEndAt, Number(responsibleManagerId)],
        ));
        const preorder = rows[0];
        if (!preorder) throw new PreorderRepositoryError('Không thể tạo đơn đặt trước', 500, 'PREORDER_CREATE_FAILED');
        return preorder;
      });
    },

    async attachCheckoutTarget({ preorderId, checkoutGroupId = null }, { tx = null } = {}) {
      return inTransaction(database, tx, async (runner) => {
        const rows = rowsOf(await runner.query(
          `UPDATE preorders
           SET checkout_group_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [Number(preorderId), checkoutGroupId == null ? null : Number(checkoutGroupId)],
        ));
        return rows[0] || null;
      });
    },

    async findById(preorderId, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      const checkin = await checkinProjection(executor);
      const rows = rowsOf(await executor.query(
        `SELECT p.*, pss.is_enabled AS preorder_enabled,
                r.id AS reservation_id, r.table_id, r.status AS reservation_status,
                r.reserved_from, r.reserved_until,
                ${checkin.columns}
         FROM preorders p
         LEFT JOIN preorder_store_settings pss ON pss.store_id = p.store_id
         LEFT JOIN preorder_table_reservations r ON r.preorder_id = p.id
         ${checkin.join}
         WHERE p.id = $1${forUpdate ? ' FOR UPDATE OF p' : ''}`,
        [Number(preorderId)],
      ));
      const row = rows[0] || null;
      if (!row) return null;
      return {
        ...row,
        checkin_request: row.checkin_request_id ? {
          id: Number(row.checkin_request_id),
          status: row.checkin_request_status,
          requested_at: row.checkin_requested_at,
          late_confirmation_reason: row.checkin_late_confirmation_reason,
          rejection_reason: row.checkin_rejection_reason,
        } : null,
      };
    },

    async findForCustomer(code, customerUserId) {
      const rows = await loadCustomerPreorders(customerUserId, code);
      return rows[0] || null;
    },

    async listForCustomer(customerUserId, options = {}) {
      return loadCustomerPreorders(customerUserId, null, options);
    },

    async list({
      storeId = null,
      status = null,
      statuses = null,
      from = null,
      to = null,
      includePendingOnly = false,
      includeReviews = false,
      page = null,
      limit = null,
      orderBy = 'active',
    } = {}) {
      const values = [];
      const where = [];
      const add = (value) => { values.push(value); return `$${values.length}`; };
      if (storeId != null) where.push(`p.store_id = ${add(Number(storeId))}`);
      if (status) where.push(`p.status = ${add(String(status))}`);
      if (Array.isArray(statuses) && statuses.length) where.push(`p.status = ANY(${add(statuses.map(String))}::varchar[])`);
      if (from) where.push(`p.scheduled_start_at >= ${add(from)}`);
      if (to) where.push(`p.scheduled_start_at < ${add(to)}`);
      if (includePendingOnly) where.push("p.status = 'PENDING_MANAGER_CONFIRMATION'");
      const checkin = await checkinProjection(database);

      const isPaginated = page != null && limit != null;
      let countColumn = '';
      let paginationClause = '';
      if (isPaginated) {
        countColumn = ', COUNT(*) OVER() AS total_count';
        paginationClause = ` LIMIT $${values.push(limit)} OFFSET $${values.push((page - 1) * limit)}`;
      } else if (limit != null) {
        paginationClause = ` LIMIT $${values.push(Number(limit))}`;
      }

      const sortSql = orderBy === 'archive'
        ? 'ORDER BY COALESCE(p.handover_confirmed_at, p.updated_at, p.created_at) DESC, p.id DESC'
        : 'ORDER BY p.scheduled_start_at ASC, p.id ASC';

      const rows = rowsOf(await database.query(
        `SELECT p.*, s.name AS store_name, u.fullname AS customer_name,
                EXISTS (SELECT 1 FROM preorder_table_reservations r WHERE r.preorder_id = p.id AND r.status IN ('pending_payment','held','checked_in')) AS has_active_table_reservation,
                ${checkin.columns}
                ${countColumn}
         FROM preorders p
         JOIN stores s ON s.id = p.store_id
         JOIN users u ON u.id = p.customer_user_id
         ${checkin.join}
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ${sortSql}
         ${paginationClause}`,
        values,
      ));

      let totalItems = 0;
      if (isPaginated) {
        if (rows.length > 0) {
          totalItems = Number(rows[0].total_count) || 0;
        } else if (page > 1) {
          const countValues = [];
          const countWhere = [];
          const addC = (val) => { countValues.push(val); return `$${countValues.length}`; };
          if (storeId != null) countWhere.push(`p.store_id = ${addC(Number(storeId))}`);
          if (status) countWhere.push(`p.status = ${addC(String(status))}`);
          if (Array.isArray(statuses) && statuses.length) countWhere.push(`p.status = ANY(${addC(statuses.map(String))}::varchar[])`);
          if (from) countWhere.push(`p.scheduled_start_at >= ${addC(from)}`);
          if (to) countWhere.push(`p.scheduled_start_at < ${addC(to)}`);
          if (includePendingOnly) countWhere.push("p.status = 'PENDING_MANAGER_CONFIRMATION'");
          const countRes = rowsOf(await database.query(
            `SELECT COUNT(*)::int AS total FROM preorders p ${countWhere.length ? `WHERE ${countWhere.join(' AND ')}` : ''}`,
            countValues,
          ));
          totalItems = Number(countRes[0]?.total) || 0;
        }
      }

      if (!rows.length) return isPaginated ? { items: [], totalItems } : [];

      const mapped = rows.map((p) => ({
        ...p,
        checkin_request: p.checkin_request_id ? {
          id: Number(p.checkin_request_id),
          status: p.checkin_request_status,
          requested_at: p.checkin_requested_at,
          late_confirmation_reason: p.checkin_late_confirmation_reason,
          rejection_reason: p.checkin_rejection_reason,
        } : null,
      }));
      const attached = await attachLinkedOrders(mapped);
      const items = includeReviews ? await attachReviewsToPreorders(attached) : attached;
      return isPaginated ? { items, totalItems } : items;
    },

    async findByPaymentTarget({ orderId = null, checkoutGroupId = null }, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      if ((orderId == null) === (checkoutGroupId == null)) {
        throw new PreorderRepositoryError('Payment target preorder khÃ´ng há»£p lá»‡', 400, 'PREORDER_TARGET_REQUIRED');
      }
      const sql = checkoutGroupId != null
        ? `SELECT p.* FROM preorders p WHERE p.checkout_group_id = $1${forUpdate ? ' FOR UPDATE' : ''}`
        : `SELECT p.* FROM preorders p JOIN orders o ON o.preorder_id = p.id WHERE o.id = $1${forUpdate ? ' FOR UPDATE OF p' : ''}`;
      const rows = rowsOf(await executor.query(sql, [Number(checkoutGroupId ?? orderId)]));
      return rows[0] || null;
    },

    async findByOrderId(orderId, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `SELECT p.*
         FROM preorders p
         JOIN orders o ON o.preorder_id = p.id
         WHERE o.id = $1${forUpdate ? ' FOR UPDATE OF p' : ''}`,
        [Number(orderId)],
      ));
      return rows[0] || null;
    },

    async transition(preorderId, { from, to, fields = {} }, { tx = null } = {}) {
      if (!PREORDER_STATUSES.includes(to)) throw new PreorderRepositoryError('Tráº¡ng thÃ¡i preorder khÃ´ng há»£p lá»‡', 400, 'PREORDER_STATUS_INVALID');
      return inTransaction(database, tx, async (runner) => {
        const keys = Object.keys(fields);
        const values = [Number(preorderId), to];
        const setters = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
        for (const key of keys) {
          if (!/^[a-z_]+$/.test(key)) throw new PreorderRepositoryError('TrÆ°á»ng preorder khÃ´ng há»£p lá»‡', 400, 'PREORDER_FIELD_INVALID');
          values.push(fields[key]);
          setters.push(`${key} = $${values.length}`);
        }
        let where = 'id = $1';
        if (from) {
          const accepted = Array.isArray(from) ? from : [from];
          values.push(accepted);
          where += ` AND status = ANY($${values.length}::varchar[])`;
        }
        const rows = rowsOf(await runner.query(
          `UPDATE preorders SET ${setters.join(', ')} WHERE ${where} RETURNING *`, values,
        ));
        return rows[0] || null;
      });
    },

    async releaseReservation(preorderId, status, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_table_reservations
         SET status = $2, released_at = COALESCE(released_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE preorder_id = $1 AND status IN ('pending_payment','held')
         RETURNING *`,
        [Number(preorderId), status],
      ));
      return rows[0] || null;
    },

    async holdReservation(preorderId, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_table_reservations SET status = 'held', updated_at = CURRENT_TIMESTAMP
         WHERE preorder_id = $1 AND status = 'pending_payment' RETURNING *`, [Number(preorderId)],
      ));
      return rows[0] || null;
    },

    async moveReservation({ preorderId, tableId = null, scheduledStartAt }, { tx = null } = {}) {
      return inTransaction(database, tx, async (runner) => {
        const existingRows = rowsOf(await runner.query(
          'SELECT * FROM preorder_table_reservations WHERE preorder_id = $1 FOR UPDATE', [Number(preorderId)],
        ));
        const existing = existingRows[0] || null;
        if (tableId == null) {
          if (existing && ['pending_payment', 'held'].includes(existing.status)) await this.releaseReservation(preorderId, 'released', { tx: runner });
          return null;
        }
        if (existing) {
          const rows = rowsOf(await runner.query(
            `UPDATE preorder_table_reservations
             SET table_id = $2, reserved_from = $3::timestamptz - INTERVAL '30 minutes', reserved_until = $3::timestamptz + INTERVAL '60 minutes',
                 status = CASE WHEN status IN ('released','cancelled','expired') THEN 'held' ELSE status END,
                 released_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE preorder_id = $1 RETURNING *`,
            [Number(preorderId), Number(tableId), scheduledStartAt],
          ));
          return rows[0] || null;
        }
        const rows = rowsOf(await runner.query(
           `INSERT INTO preorder_table_reservations (preorder_id,table_id,reserved_from,reserved_until,status)
           VALUES ($1,$2,$3::timestamptz - INTERVAL '30 minutes',$3::timestamptz + INTERVAL '60 minutes','held') RETURNING *`,
          [Number(preorderId), Number(tableId), scheduledStartAt],
        ));
        return rows[0] || null;
      });
    },

    async addRescheduleHistory({ preorderId, oldStart, oldEnd, newStart, newEnd, managerId, reason, agreementAt }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_reschedule_history
           (preorder_id,old_scheduled_start_at,old_scheduled_end_at,new_scheduled_start_at,new_scheduled_end_at,manager_id,reason,customer_agreement_recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [Number(preorderId), oldStart, oldEnd, newStart, newEnd, Number(managerId), String(reason), agreementAt],
      ));
      return rows[0] || null;
    },

    async createConfirmationIncident(preorder, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_confirmation_incidents
           (preorder_id,store_id,responsible_manager_id,scheduled_start_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT (preorder_id) DO NOTHING RETURNING *`,
        [Number(preorder.id), Number(preorder.store_id), Number(preorder.responsible_manager_id), preorder.scheduled_start_at],
      ));
      return rows[0] || null;
    },

    async queueDelivery({ preorderId, eventType, recipientUserId, channel }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_notification_deliveries (preorder_id,event_type,recipient_user_id,channel)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (preorder_id,event_type,recipient_user_id,channel) DO NOTHING
         RETURNING *`,
        [Number(preorderId), String(eventType), Number(recipientUserId), String(channel)],
      ));
      return rows[0] || null;
    },

    // Claim work transactionally, then let the service call the mail adapter
    // after commit. A stale claim is eligible again after fifteen minutes.
    async claimPendingEmailDeliveries({ limit = 50 }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `WITH candidates AS (
           SELECT d.id
           FROM preorder_notification_deliveries d
           WHERE d.channel = 'email'
             AND (d.status IN ('pending', 'failed')
               OR (d.status = 'processing' AND d.processing_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
           ORDER BY d.created_at ASC, d.id ASC
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE preorder_notification_deliveries d
         SET status = 'processing', processing_at = CURRENT_TIMESTAMP,
             attempt_count = d.attempt_count + 1, updated_at = CURRENT_TIMESTAMP
         FROM candidates c
         JOIN users u ON u.id = d.recipient_user_id
         WHERE d.id = c.id
         RETURNING d.*, u.email, u.fullname`, [Math.min(Math.max(1, Number(limit) || 50), 100)],
      ));
      return rows;
    },

    async completeEmailDelivery(deliveryId, { sent, errorCode = null }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_notification_deliveries
         SET status = $2,
             sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
             processing_at = NULL,
             last_error_code = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'processing'
         RETURNING *`,
        [Number(deliveryId), sent ? 'sent' : 'failed', errorCode ? String(errorCode).slice(0, 80) : null],
      ));
      return rows[0] || null;
    },

    async listDue(now, { tx = null } = {}) {
      const executor = tx || database;
      return rowsOf(await executor.query(
        `SELECT p.*, i.id AS incident_id, i.reminder_t60_sent_at, i.urgent_t30_sent_at, i.breached_at
         FROM preorders p
         LEFT JOIN preorder_confirmation_incidents i ON i.preorder_id = p.id
         WHERE (p.status IN ('PENDING_MANAGER_CONFIRMATION','CONFIRMED')
                OR (p.status = 'CHECKED_IN' AND p.completed_at IS NULL))
           AND p.scheduled_start_at <= $1 + INTERVAL '1 day'
         ORDER BY p.scheduled_start_at ASC FOR UPDATE OF p`, [now],
      ));
    },

    async updateIncident(incidentId, fields, { tx = null } = {}) {
      const executor = tx || database;
      const entries = Object.entries(fields);
      if (!entries.length) return null;
      const values = [Number(incidentId)];
      const setters = entries.map(([key, value]) => {
        if (!/^[a-z_]+$/.test(key)) throw new PreorderRepositoryError('TrÆ°á»ng incident khÃ´ng há»£p lá»‡', 400, 'PREORDER_INCIDENT_FIELD_INVALID');
        values.push(value);
        return `${key} = $${values.length}`;
      });
      const rows = rowsOf(await executor.query(`UPDATE preorder_confirmation_incidents SET ${setters.join(', ')} WHERE id = $1 RETURNING *`, values));
      return rows[0] || null;
    },

    async lockStrike(managerId, { tx = null } = {}) {
      const executor = tx || database;
      await executor.query(
        `INSERT INTO manager_preorder_strikes (manager_id) VALUES ($1) ON CONFLICT (manager_id) DO NOTHING`, [Number(managerId)],
      );
      const rows = rowsOf(await executor.query('SELECT * FROM manager_preorder_strikes WHERE manager_id = $1 FOR UPDATE', [Number(managerId)]));
      return rows[0] || null;
    },

    async incrementStrike(managerId, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `UPDATE manager_preorder_strikes
         SET confirmed_breach_count = confirmed_breach_count + 1,
             last_confirmed_breach_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE manager_id = $1 RETURNING *`, [Number(managerId)],
      ));
      return rows[0] || null;
    },

    async listLinkedOrders(preorderId, { tx = null } = {}) {
      const executor = tx || database;
      return rowsOf(await executor.query(
        `SELECT o.id, o.store_id,
                (SELECT status FROM order_status_history h WHERE h.order_id = o.id ORDER BY h.created_at DESC, h.id DESC LIMIT 1) AS latest_status
         FROM orders o WHERE o.preorder_id = $1 ORDER BY o.id`, [Number(preorderId)],
      ));
    },

    async findCurrentCheckinRequest(preorderId, scheduledStart, { tx = null, forUpdate = false } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `SELECT *
         FROM preorder_checkin_requests
         WHERE preorder_id = $1 AND scheduled_start_at = $2
         ORDER BY id DESC LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
        [Number(preorderId), scheduledStart],
      ));
      return rows[0] || null;
    },

    async createOrGetCheckinRequest({ preorderId, storeId, customerUserId, scheduledStartAt, scheduledEndAt, requestedAt = null }, { tx = null } = {}) {
      const executor = tx || database;
      const reqTime = requestedAt ? new Date(requestedAt) : new Date();
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_checkin_requests
           (preorder_id, store_id, customer_user_id, scheduled_start_at, scheduled_end_at, requested_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         ON CONFLICT (preorder_id, scheduled_start_at) DO UPDATE
           SET updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [Number(preorderId), Number(storeId), Number(customerUserId), scheduledStartAt, scheduledEndAt, reqTime],
      ));
      return rows[0] || null;
    },

    async confirmCheckinRequest({ requestId, actorId, resolvedAt = null, lateConfirmationReason = null }, { tx = null } = {}) {
      const executor = tx || database;
      const resTime = resolvedAt ? new Date(resolvedAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_checkin_requests
         SET status = 'CONFIRMED',
             resolved_by = $2,
             resolved_at = $3,
             late_confirmation_reason = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [Number(requestId), Number(actorId), resTime, lateConfirmationReason ? String(lateConfirmationReason).trim() : null],
      ));
      return rows[0] || null;
    },

    async rejectCheckinRequest({ requestId, actorId, resolvedAt = null, reason }, { tx = null } = {}) {
      const executor = tx || database;
      const resTime = resolvedAt ? new Date(resolvedAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_checkin_requests
         SET status = 'REJECTED',
             resolved_by = $2,
             resolved_at = $3,
             rejection_reason = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [Number(requestId), Number(actorId), resTime, String(reason).trim()],
      ));
      return rows[0] || null;
    },

    async markCheckinRequestRescheduled({ preorderId, oldScheduledStartAt, resolvedBy = null, resolvedAt = null }, { tx = null } = {}) {
      const executor = tx || database;
      const resTime = resolvedAt ? new Date(resolvedAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_checkin_requests
         SET status = 'RESCHEDULED',
             resolved_by = $3,
             resolved_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE preorder_id = $1 AND scheduled_start_at = $2 AND status = 'PENDING'
         RETURNING *`,
        [Number(preorderId), oldScheduledStartAt, resolvedBy ? Number(resolvedBy) : null, resTime],
      ));
      return rows;
    },

    async recordSlotStrikeOnce({ preorderId, scheduledStartAt, managerId, strikeSource }, { tx = null } = {}) {
      const executor = tx || database;
      const rows = rowsOf(await executor.query(
        `INSERT INTO preorder_slot_strike_events
           (preorder_id, scheduled_start_at, manager_id, strike_source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (preorder_id, scheduled_start_at) DO NOTHING
         RETURNING *`,
        [Number(preorderId), scheduledStartAt, Number(managerId), String(strikeSource)],
      ));
      return rows[0] || null;
    },

    async markCheckinManagerBreachOnce({ requestId, breachedAt = null }, { tx = null } = {}) {
      const executor = tx || database;
      const time = breachedAt ? new Date(breachedAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorder_checkin_requests
         SET manager_breach_recorded_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND manager_breach_recorded_at IS NULL
         RETURNING *`,
        [Number(requestId), time],
      ));
      return rows[0] || null;
    },

    async confirmHandover({ preorderId, actorId, handoverAt = new Date() }, { tx = null } = {}) {
      const executor = tx || database;
      const time = handoverAt ? new Date(handoverAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorders
         SET status = 'COMPLETED',
             handover_confirmed_at = $2,
             handover_confirmed_by = $3,
             completed_at = COALESCE(completed_at, $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [Number(preorderId), time, Number(actorId)],
      ));
      return rows[0] || null;
    },

    async markHandoverOverdue({ preorderId, overdueAt = new Date() }, { tx = null } = {}) {
      const executor = tx || database;
      const time = overdueAt ? new Date(overdueAt) : new Date();
      const rows = rowsOf(await executor.query(
        `UPDATE preorders
         SET handover_overdue_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND handover_overdue_at IS NULL
         RETURNING *`,
        [Number(preorderId), time],
      ));
      return rows[0] || null;
    },
  };
}

export const preordersRepository = createPreordersRepository();
export default preordersRepository;
