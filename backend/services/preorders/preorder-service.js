import crypto from 'node:crypto';
import postgresDb from '../../config/db-postgres.js';
import preordersRepository, { PreorderRepositoryError } from '../../repositories/postgres/preorders.js';
import fulfillmentService from '../orders/fulfillment-service.js';
import notificationsRepository from '../../repositories/postgres/notifications.js';
import usersRepository from '../../repositories/postgres/users.js';
import emailService from '../email-service.js';
import {
  evaluatePreorderCheckinWindow,
  formatVietnamBusinessDate,
  isWithinPreorderCancellationWindow,
  parseVietnamSingleDateBoundary,
  validateVietnamPreorderSlot,
} from '../business-time.js';

const TRANSITIONS = Object.freeze({
  AWAITING_PAYMENT: new Set(['PENDING_MANAGER_CONFIRMATION', 'PAYMENT_EXPIRED', 'LATE_PAID_REQUIRES_ACTION', 'CUSTOMER_CANCELLED']),
  PENDING_MANAGER_CONFIRMATION: new Set(['CONFIRMED', 'CUSTOMER_CANCELLED', 'LATE_PAID_REQUIRES_ACTION', 'NO_SHOW']),
  CONFIRMED: new Set(['CHECKED_IN', 'CUSTOMER_CANCELLED', 'NO_SHOW']),
  CHECKED_IN: new Set(['COMPLETED']),
});

export class PreorderError extends Error {
  constructor(message, status = 409, code = 'PREORDER_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.has(to)) {
    throw new PreorderError(`Không thể chuyển preorder từ ${from} sang ${to}`, 409, 'PREORDER_TRANSITION_INVALID');
  }
}

function tagCheckoutError(error, stage) {
  // Diagnostic-only metadata used by the preorder route. Preserve the original
  // error instance, status, and payment behavior.
  if (error && typeof error === 'object' && !error.preorderCheckoutStage) {
    try { error.preorderCheckoutStage = stage; } catch { /* frozen error: route uses generic stage */ }
  }
  return error;
}

function preorderCode() {
  return `PO${Date.now().toString().slice(-8)}${crypto.randomInt(1000, 10000)}`;
}

function asDate(value, field) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new PreorderError(`${field} không hợp lệ`, 400, 'PREORDER_DATE_INVALID');
  return date;
}

function isSuper(user) { return user?.role === 'super'; }
function isScopedManager(user, preorder) {
  return user?.role === 'manager' && Number(user.branch_id) === Number(preorder.store_id);
}
function assertManagerOrSuper(user, preorder) {
  if (!isSuper(user) && !isScopedManager(user, preorder)) {
    throw new PreorderError('Bạn không có quyền thao tác preorder của chi nhánh này', 403, 'PREORDER_BRANCH_FORBIDDEN');
  }
}

function listRows(result) {
  return Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : (result?.rows || []);
}

export function createPreorderService({
  repository = preordersRepository,
  orderService = null,
  fulfillment = fulfillmentService,
  notifications = notificationsRepository,
  usersRepo = usersRepository,
  email = emailService,
  database = postgresDb,
  now = () => new Date(),
} = {}) {
  async function getOrderService() {
    // Payment settlement imports this bridge. Resolve checkout lazily so the
    // bridge cannot form an ESM initialization cycle with customer orders.
    if (orderService) return orderService;
    return (await import('../orders/customer-order-service.js')).default;
  }

  async function queueRecipient(preorder, eventType, userId, tx) {
    if (!userId) return;
    const delivery = await repository.queueDelivery({ preorderId: preorder.id, eventType, recipientUserId: userId, channel: 'in_app' }, { tx });
    if (!delivery) return;
    await notifications.insertForUser({
      userId,
      type: 'order',
      title: 'Cập nhật đơn đặt trước',
      body: `Đơn đặt trước ${preorder.preorder_code} cần được theo dõi.`,
      link: `/don-dat-truoc?code=${encodeURIComponent(preorder.preorder_code)}`,
    }, { tx });
    await repository.queueDelivery({ preorderId: preorder.id, eventType, recipientUserId: userId, channel: 'email' }, { tx });
  }

  async function findGroupId(groupCode) {
    const rows = listRows(await database.query('SELECT id FROM checkout_groups WHERE group_code = $1', [groupCode]));
    return rows[0]?.id || null;
  }

  async function deliverPendingNotifications({ limit = 50 } = {}) {
    const deliveries = await database.transaction((tx) => repository.claimPendingEmailDeliveries({ limit }, { tx }));
    let sent = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await email.sendEmail({
          to: delivery.email,
          subject: 'Cập nhật đơn đặt trước TeaPlus',
          text: `Đơn đặt trước ${delivery.preorder_id} có cập nhật mới (${delivery.event_type}).`,
        });
        await repository.completeEmailDelivery(delivery.id, { sent: true });
        sent += 1;
      } catch {
        // Transport failure never rolls back a payment or lifecycle transition.
        await repository.completeEmailDelivery(delivery.id, { sent: false, errorCode: 'EMAIL_DELIVERY_FAILED' });
        failed += 1;
      }
    }
    return { claimed: deliveries.length, sent, failed };
  }

  return {
    async listStoreAvailability() {
      return repository.listPublicStoreAvailability();
    },

    async getForCustomer({ preorderCode, customerUserId }) {
      const preorder = await repository.findForCustomer(preorderCode, customerUserId);
      if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');
      return preorder;
    },

    async listForCustomer({ customerUserId, page = null, limit = null } = {}) {
      return repository.listForCustomer(customerUserId, { page, limit });
    },

    async availability({ storeId, date, now: currentNow = now() }) {
      const setting = await repository.getActiveStoreSetting(storeId);
      if (!setting) {
        throw new PreorderError('Chi nhánh chưa bật đặt trước hoặc chưa có Quản lý phó trách', 409, 'PREORDER_STORE_UNAVAILABLE');
      }
      const slots = [];
      for (let hour = 9; hour <= 22; hour += 1) {
        try {
          const slot = validateVietnamPreorderSlot({ date, hour, now: currentNow });
          slots.push({ hour, scheduled_start_at: slot.start.toISOString(), scheduled_end_at: slot.end.toISOString(), available: true });
        } catch (error) {
          if (error.code === 'PREORDER_MIN_LEAD_TIME') {
            slots.push({ hour, available: false, reason: 'MIN_LEAD_TIME' });
          } else if (error.code === 'PREORDER_MAX_HORIZON') {
            throw error;
          } else throw error;
        }
      }
      return { store_id: Number(storeId), date, slots };
    },

    async availableTables({ storeId, date, hour, now: currentNow = now() }) {
      const setting = await repository.getActiveStoreSetting(storeId);
      if (!setting) throw new PreorderError('Chi nhánh chưa sẵn sàng nhận đặt trước', 409, 'PREORDER_STORE_UNAVAILABLE');
      const slot = validateVietnamPreorderSlot({ date, hour, now: currentNow });
      const rows = listRows(await database.query(
        `SELECT t.id, t.name
         FROM tables t
         WHERE t.store_id = $1 AND t.is_active = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM preorder_table_reservations r
             WHERE r.table_id = t.id
               AND r.status IN ('pending_payment','held','checked_in')
               AND tstzrange(r.reserved_from, r.reserved_until, '[)') && tstzrange($2::timestamptz - INTERVAL '30 minutes', $2::timestamptz + INTERVAL '60 minutes', '[)')
           )
         ORDER BY t.name, t.id`, [Number(storeId), slot.start],
      ));
      return { scheduled_start_at: slot.start.toISOString(), tables: rows };
    },

    async checkout({ input, customerUserId, idempotencyKey }) {
      if (!Number.isInteger(Number(customerUserId)) || Number(customerUserId) <= 0) {
        throw new PreorderError('Vui lòng đăng nhập để đặt trước', 401, 'PREORDER_CUSTOMER_AUTH_REQUIRED');
      }
      if (!idempotencyKey || String(idempotencyKey).trim().length > 255) {
        throw new PreorderError('Thiếu Idempotency-Key hợp lệ', 400, 'PREORDER_IDEMPOTENCY_REQUIRED');
      }
      if (input && (input.table_id != null || Object.hasOwn(input, 'table_id'))) {
        throw new PreorderError('Preorder không còn hỗ trợ đặt bàn', 400, 'PREORDER_TABLE_RESERVATION_DISALLOWED');
      }
      const storeId = Number(input?.store_id);
      const setting = await repository.getActiveStoreSetting(storeId);
      if (!setting) throw new PreorderError('Chi nhánh chưa sẵn sàng nhận đặt trước', 409, 'PREORDER_STORE_UNAVAILABLE');
      if (!Array.isArray(input?.items) || input.items.some((item) => item?.store_id != null && Number(item.store_id) !== storeId)) {
        throw new PreorderError('Tất cả món preorder phải thuộc đúng một chi nhánh đã chọn', 400, 'PREORDER_SINGLE_STORE_REQUIRED');
      }
      const slot = validateVietnamPreorderSlot({ date: input?.scheduled_date, hour: input?.scheduled_hour, now: now() });

      const { table_id: _ignoredTable, ...cleanInput } = input || {};

      const existing = await repository.findByCustomerIdempotency({ customerUserId, idempotencyKey });
      if (existing) {
        // Re-enter the canonical checkout idempotency path so retry keeps the
        // existing Direct/Grouped PayOS response contract (including a
        // recoverable creating attempt) rather than returning a preorder-only
        // substitute response.
        const checkout = await (await getOrderService()).create({
          input: {
            ...cleanInput,
            store_id: storeId,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'VietQR',
            preorder_id: existing.id,
            preorder_code: existing.preorder_code,
            defer_fulfillment: true,
            checkout_channel: 'preorder',
          },
          userId: Number(customerUserId),
          idempotencyKey: String(idempotencyKey),
        });
        return { ...checkout, replay: true, preorder: existing };
      }

      let preorder;
      try {
        preorder = await database.transaction(async (tx) => {
          const lockedSetting = await repository.getActiveStoreSetting(storeId, { tx, forUpdate: true });
          if (!lockedSetting) throw new PreorderError('Chi nhánh chưa sẵn sàng nhận đặt trước', 409, 'PREORDER_STORE_UNAVAILABLE');
          return repository.createAwaitingPayment({
            preorderCode: preorderCode(), storeId, customerUserId, idempotencyKey,
            scheduledStartAt: slot.start, scheduledEndAt: slot.end,
            responsibleManagerId: lockedSetting.responsible_manager_id,
          }, { tx });
        });
      } catch (error) {
        // The unique customer/idempotency key is the race-safe boundary. A
        // concurrent request must recover canonical checkout rather than
        // create another preorder, reservation, QR, or payment attempt.
        if (error?.code !== '23505' || error?.constraint !== 'uq_preorders_customer_checkout_idempotency') {
          throw tagCheckoutError(error, 'PREORDER_CREATE');
        }
        preorder = await repository.findByCustomerIdempotency({ customerUserId, idempotencyKey });
        if (!preorder) throw new PreorderError('Cannot recover creating preorder', 409, 'PREORDER_IDEMPOTENCY_RECOVERY_FAILED');
        const checkout = await (await getOrderService()).create({
          input: {
            ...cleanInput,
            store_id: storeId,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'VietQR',
            preorder_id: preorder.id,
            preorder_code: preorder.preorder_code,
            defer_fulfillment: true,
            checkout_channel: 'preorder',
          },
          userId: Number(customerUserId),
          idempotencyKey: String(idempotencyKey),
        });
        return { ...checkout, replay: true, preorder };
      }

      try {
        const checkout = await (await getOrderService()).create({
          input: {
            ...cleanInput,
            store_id: storeId,
            source: 'online',
            order_type: 'Take-away',
            payment_method: 'VietQR',
            preorder_id: preorder.id,
            preorder_code: preorder.preorder_code,
            defer_fulfillment: true,
            checkout_channel: 'preorder',
          },
          userId: Number(customerUserId),
          idempotencyKey: String(idempotencyKey),
        });
        const groupId = checkout.group_code ? await findGroupId(checkout.group_code) : null;
        if (checkout.group_code && !groupId) throw new PreorderError('Không thể liên kết nhóm thanh toán preorder', 500, 'PREORDER_GROUP_LINK_FAILED');
        const linked = await repository.attachCheckoutTarget({ preorderId: preorder.id, checkoutGroupId: groupId });
        return { ...checkout, preorder: linked };
      } catch (error) {
        // Do not erase an order that may already own a reserved PayOS attempt.
        // A no-order placeholder is safely released and cannot become payable.
        const linkedOrders = await repository.listLinkedOrders(preorder.id);
        if (linkedOrders.length === 0) {
          await database.transaction(async (tx) => {
            await repository.releaseReservation(preorder.id, 'released', { tx });
            await repository.transition(preorder.id, { from: 'AWAITING_PAYMENT', to: 'PAYMENT_EXPIRED', fields: { payment_expired_at: now() } }, { tx });
          });
        }
        throw tagCheckoutError(
          error,
          error?.code === 'PREORDER_GROUP_LINK_FAILED' ? 'PREORDER_GROUP_LINK' : 'P1_CHECKOUT',
        );
      }
    },

    async onPaymentSettled({ orderId = null, checkoutGroupId = null, late = false }, { tx = null } = {}) {
      const runner = async (client) => {
        const preorder = await repository.findByPaymentTarget({ orderId, checkoutGroupId }, { tx: client, forUpdate: true });
        if (!preorder) return null;
        if (preorder.status === 'PAYMENT_EXPIRED' || late) {
          if (preorder.status !== 'LATE_PAID_REQUIRES_ACTION') {
            await repository.transition(preorder.id, {
              from: ['AWAITING_PAYMENT', 'PAYMENT_EXPIRED'], to: 'LATE_PAID_REQUIRES_ACTION', fields: { late_paid_at: now() },
            }, { tx: client });
          }
          return { kind: 'late_paid', preorderId: Number(preorder.id) };
        }
        if (preorder.status !== 'AWAITING_PAYMENT') return { kind: 'already_processed', preorderId: Number(preorder.id) };
        const updated = await repository.transition(preorder.id, {
          from: 'AWAITING_PAYMENT', to: 'PENDING_MANAGER_CONFIRMATION', fields: {},
        }, { tx: client });
        await repository.holdReservation(preorder.id, { tx: client });
        await repository.createConfirmationIncident(updated, { tx: client });
        await queueRecipient(updated, 'payment_success', updated.customer_user_id, client);
        await queueRecipient(updated, 'payment_success_manager', updated.responsible_manager_id, client);
        return { kind: 'pending_manager_confirmation', preorderId: Number(updated.id) };
      };
      return tx ? runner(tx) : database.transaction(runner);
    },

    async onPaymentExpired({ orderId = null, checkoutGroupId = null }, { tx = null } = {}) {
      const runner = async (client) => {
        const preorder = await repository.findByPaymentTarget({ orderId, checkoutGroupId }, { tx: client, forUpdate: true });
        if (!preorder || preorder.status !== 'AWAITING_PAYMENT') return null;
        const updated = await repository.transition(preorder.id, {
          from: 'AWAITING_PAYMENT', to: 'PAYMENT_EXPIRED', fields: { payment_expired_at: now() },
        }, { tx: client });
        await repository.releaseReservation(preorder.id, 'expired', { tx: client });
        return updated;
      };
      return tx ? runner(tx) : database.transaction(runner);
    },

    async confirm({ preorderId, actor }) {
      return database.transaction(async (tx) => {
        const preorder = await repository.findById(preorderId, { tx, forUpdate: true });
        if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');
        assertManagerOrSuper(actor, preorder);
        assertTransition(preorder.status, 'CONFIRMED');
        const updated = await repository.transition(preorder.id, {
          from: 'PENDING_MANAGER_CONFIRMATION', to: 'CONFIRMED', fields: { confirmed_by: Number(actor.sub), confirmed_at: now() },
        }, { tx });
        const linkedOrders = await repository.listLinkedOrders(preorder.id, { tx });
        for (const order of linkedOrders) {
          const itemRows = listRows(await tx.query(
            `SELECT oi.id, oi.product_id, oi.product_name, oi.qty, oi.fulfillment_lane, oi.size_label, oi.base_tea, oi.sugar_level, oi.ice_level, oi.note
             FROM order_items oi WHERE oi.order_id = $1`, [Number(order.id)],
          ));
          await fulfillment.splitAndCreateTasksForOrder({ orderId: Number(order.id), branchId: Number(preorder.store_id), items: itemRows }, tx);
        }
        await repository.updateIncident((listRows(await tx.query('SELECT id FROM preorder_confirmation_incidents WHERE preorder_id = $1 FOR UPDATE', [preorder.id]))[0] || {}).id, { confirmed_by: Number(actor.sub), resolved_at: now(), resolved_by: Number(actor.sub) }, { tx });
        await queueRecipient(updated, 'manager_confirmed', updated.customer_user_id, tx);
        return updated;
      });
    },

    async customerCheckIn({ preorderCode, customerUserId, now: checkinNow = now() }) {
      const effectiveNow = asDate(checkinNow, 'now');
      return database.transaction(async (tx) => {
        const preorderRows = listRows(await tx.query(
          'SELECT * FROM preorders WHERE preorder_code = $1 FOR UPDATE',
          [String(preorderCode)],
        ));
        const preorder = preorderRows[0];
        if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');

        if (Number(preorder.customer_user_id) !== Number(customerUserId)) {
          throw new PreorderError('Chỉ chủ đơn mới có quyền thực hiện check-in', 403, 'PREORDER_CHECKIN_FORBIDDEN');
        }

        // Idempotent duplicate check-in
        if (preorder.status === 'CHECKED_IN' || preorder.status === 'COMPLETED') {
          return { ...preorder, duplicate: true, idempotent: true };
        }

        if (preorder.status === 'PENDING_MANAGER_CONFIRMATION') {
          throw new PreorderError('Đơn đặt trước đang chờ quản lý xác nhận trước khi có thể check-in', 409, 'PREORDER_NOT_CONFIRMED');
        }

        if (preorder.status !== 'CONFIRMED') {
          throw new PreorderError('Chỉ có thể check-in khi đơn đã được xác nhận', 409, 'PREORDER_CHECKIN_STATUS_INVALID');
        }

        const windowCheck = evaluatePreorderCheckinWindow({
          scheduledStartAt: preorder.scheduled_start_at,
          now: effectiveNow,
        });

        if (!windowCheck.isOpen) {
          if (windowCheck.reason === 'EARLY_DATE') {
            throw new PreorderError(`Chưa đến ngày nhận. Check-in chỉ mở vào ngày ${windowCheck.scheduledDate}`, 409, 'PREORDER_CHECKIN_WINDOW_EARLY');
          }
          if (windowCheck.reason === 'PAST_DATE') {
            throw new PreorderError('Đã quá ngày nhận của đơn đặt trước', 409, 'PREORDER_CHECKIN_WINDOW_EXPIRED');
          }
          if (windowCheck.reason === 'BEFORE_OPERATING_HOURS') {
            throw new PreorderError('Khung giờ check-in chỉ mở từ 08:00 đến 24:00 trong ngày nhận', 409, 'PREORDER_CHECKIN_WINDOW_EARLY');
          }
          throw new PreorderError('Thời điểm hiện tại không thuộc khung giờ check-in hợp lệ', 409, 'PREORDER_CHECKIN_WINDOW_INVALID');
        }

        assertTransition(preorder.status, 'CHECKED_IN');

        const updated = await repository.transition(preorder.id, {
          from: 'CONFIRMED',
          to: 'CHECKED_IN',
          fields: {
            checked_in_at: effectiveNow,
            checked_in_by: Number(customerUserId),
          },
        }, { tx });

        await tx.query(
          "UPDATE preorder_table_reservations SET status = 'checked_in', updated_at = CURRENT_TIMESTAMP WHERE preorder_id = $1 AND status = 'held'",
          [Number(preorder.id)],
        );

        await tx.query(
          `INSERT INTO audit_logs (user_id, action, detail)
           VALUES ($1, 'PREORDER_CUSTOMER_CHECKED_IN', $2)`,
          [Number(customerUserId), JSON.stringify({ preorder_id: Number(preorder.id), preorder_code: preorder.preorder_code, checked_in_at: effectiveNow.toISOString() })],
        );

        await queueRecipient(updated, 'customer_checked_in', updated.responsible_manager_id, tx);
        return updated;
      });
    },

    async requestCheckIn({ preorderCode, customerUserId, now: requestNow = now() }) {
      return this.customerCheckIn({ preorderCode, customerUserId, now: requestNow });
    },

    async cancel({ preorderCode, customerUserId, reason = null, now: cancelNow = now() }) {
      const effectiveNow = asDate(cancelNow, 'now');
      return database.transaction(async (tx) => {
        const preorderRows = listRows(await tx.query('SELECT * FROM preorders WHERE preorder_code = $1 AND customer_user_id = $2 FOR UPDATE', [String(preorderCode), Number(customerUserId)]));
        const preorder = preorderRows[0];
        if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');

        if (preorder.checked_in_at != null || preorder.status === 'CHECKED_IN') {
          throw new PreorderError('Không thể tự hủy đơn khi đã check-in. Vui lòng liên hệ cửa hàng để được hỗ trợ', 409, 'PREORDER_CANCEL_CHECKED_IN');
        }

        if (!isWithinPreorderCancellationWindow({ scheduledStartAt: preorder.scheduled_start_at, now: effectiveNow })) {
          throw new PreorderError('Đã quá thời gian được phép hủy đơn (chỉ được hủy trước 24:00 của ngày nhận)', 409, 'PREORDER_CANCEL_WINDOW_CLOSED');
        }

        if (!['AWAITING_PAYMENT', 'PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status)) {
          throw new PreorderError('Preorder không thể hủy ở trạng thái hiện tại', 409, 'PREORDER_CANCEL_STATE_INVALID');
        }

        const updated = await repository.transition(preorder.id, {
          from: preorder.status,
          to: 'CUSTOMER_CANCELLED',
          fields: { cancelled_at: effectiveNow, cancel_reason: reason ? String(reason).slice(0, 500) : null },
        }, { tx });

        await repository.releaseReservation(preorder.id, 'cancelled', { tx });

        const linkedOrders = await repository.listLinkedOrders(preorder.id, { tx });
        for (const order of linkedOrders) {
          const cancelNote = reason ? String(reason).slice(0, 500) : 'Khách hủy đơn đặt trước';
          await tx.query(
            "INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, 'Đã hủy', $2, $3)",
            [Number(order.id), cancelNote, Number(customerUserId)],
          );
          await tx.query(
            "UPDATE orders SET cancel_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [Number(order.id), cancelNote],
          );
          await fulfillment.cancelTasksForOrder(Number(order.id), tx);
        }

        return updated;
      });
    },

    async reschedule({ preorderId, actor, date, hour, tableId = undefined, reason, customerAgreementRecordedAt = now() }) {
      if (!reason || !String(reason).trim()) throw new PreorderError('Cần lý do đổi lịch', 400, 'PREORDER_RESCHEDULE_REASON_REQUIRED');
      const slot = validateVietnamPreorderSlot({ date, hour, now: now() });
      return database.transaction(async (tx) => {
        const preorder = await repository.findById(preorderId, { tx, forUpdate: true });
        if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');
        assertManagerOrSuper(actor, preorder);
        if (!['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status) || Number(preorder.reschedule_count) >= 1) {
          throw new PreorderError('Preorder chỉ được đổi lịch một lần khi đang chờ/đã xác nhận', 409, 'PREORDER_RESCHEDULE_NOT_ALLOWED');
        }
        await repository.markCheckinRequestRescheduled({
          preorderId: preorder.id,
          oldScheduledStartAt: preorder.scheduled_start_at,
          resolvedBy: Number(actor.sub),
          resolvedAt: now(),
        }, { tx });
        if (tableId !== undefined) {
          await repository.moveReservation({ preorderId: preorder.id, tableId, scheduledStartAt: slot.start }, { tx });
        }
        await repository.addRescheduleHistory({
          preorderId: preorder.id, oldStart: preorder.scheduled_start_at, oldEnd: preorder.scheduled_end_at,
          newStart: slot.start, newEnd: slot.end, managerId: Number(actor.sub), reason: String(reason).trim(), agreementAt: customerAgreementRecordedAt,
        }, { tx });
        const rows = listRows(await tx.query(
          `UPDATE preorders SET scheduled_start_at = $2, scheduled_end_at = $3, reschedule_count = 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`, [Number(preorder.id), slot.start, slot.end],
        ));
        const updated = rows[0];
        await queueRecipient(updated, 'manager_rescheduled', updated.customer_user_id, tx);
        return updated;
      });
    },

    async confirmHandover({ preorderId, actor, now: handoverNow = now() }) {
      const effectiveNow = asDate(handoverNow, 'now');
      return database.transaction(async (tx) => {
        const preorder = await repository.findById(preorderId, { tx, forUpdate: true });
        if (!preorder) throw new PreorderError('Không tìm thấy preorder', 404, 'PREORDER_NOT_FOUND');
        assertManagerOrSuper(actor, preorder);

        // Idempotency check
        if (preorder.status === 'COMPLETED' && preorder.handover_confirmed_at != null) {
          return { ...preorder, idempotent: true };
        }

        if (preorder.status !== 'CHECKED_IN' || preorder.checked_in_at == null) {
          throw new PreorderError('Khách hàng chưa check-in, chưa thể xác nhận bàn giao', 409, 'PREORDER_HANDOVER_NOT_CHECKED_IN');
        }

        const linkedOrders = await repository.listLinkedOrders(preorder.id, { tx });
        if (!linkedOrders.length) {
          throw new PreorderError('Không tìm thấy đơn hàng liên kết cho preorder này', 409, 'PREORDER_NO_LINKED_ORDERS');
        }

        const unfinished = linkedOrders.filter((order) => {
          const status = order.latest_status || order.current_status || order.status;
          return status !== 'Hoàn thành';
        });
        if (unfinished.length > 0) {
          throw new PreorderError('Vẫn còn món hoặc đơn hàng liên kết chưa hoàn thành chế biến', 409, 'PREORDER_HANDOVER_INCOMPLETE_ORDERS');
        }

        assertTransition(preorder.status, 'COMPLETED');

        const updated = await repository.confirmHandover({
          preorderId: preorder.id,
          actorId: Number(actor.sub),
          handoverAt: effectiveNow,
        }, { tx });

        await tx.query(
          `INSERT INTO audit_logs (user_id, action, detail)
           VALUES ($1, 'PREORDER_HANDOVER_CONFIRMED', $2)`,
          [Number(actor.sub), JSON.stringify({ preorder_id: Number(preorder.id), preorder_code: preorder.preorder_code, handover_confirmed_at: effectiveNow.toISOString() })],
        );

        await queueRecipient(updated, 'handover_confirmed', updated.customer_user_id, tx);
        return updated;
      });
    },

    async checkIn() {
      throw new PreorderError('Check-in là thao tác tự phục vụ của khách hàng. Cửa hàng không cần duyệt check-in; chỉ cần xác nhận bàn giao sau khi khách có mặt và Bếp hoàn tất.', 400, 'PREORDER_CHECKIN_SELF_SERVICE_REQUIRED');
    },

    async rejectCheckIn() {
      throw new PreorderError('Check-in là thao tác tự phục vụ của khách hàng, không áp dụng từ chối check-in.', 400, 'PREORDER_CHECKIN_SELF_SERVICE_REQUIRED');
    },

    async refreshCompletion(preorderId, { tx = null } = {}) {
      // Automatic COMPLETED transition removed per PREORDER_STORE_CHECKIN_HANDOVER_SPEC:
      // Store handover is a separate confirmation and the sole action that moves preorder to COMPLETED.
      const runner = async (client) => {
        return repository.findById(preorderId, { tx: client });
      };
      return tx ? runner(tx) : database.transaction(runner);
    },

    async refreshCompletionForOrder(orderId, { tx = null } = {}) {
      const runner = async (client) => {
        const preorder = await repository.findByOrderId(orderId, { tx: client });
        if (!preorder) return null;
        return this.refreshCompletion(preorder.id, { tx: client });
      };
      return tx ? runner(tx) : database.transaction(runner);
    },

    async processDue({ now: dueNow = now() } = {}) {
      const effectiveNow = asDate(dueNow, 'now');
      const outcomes = { t60: 0, t30: 0, breached: 0, no_show: 0, overdue: 0, payment_expired: 0 };
      await database.transaction(async (tx) => {
        const expiredRows = listRows(await tx.query(
          `SELECT p.id
           FROM preorders p
           LEFT JOIN orders o ON o.preorder_id = p.id AND p.checkout_group_id IS NULL
           LEFT JOIN payment_attempts pa ON pa.id = COALESCE(o.current_payment_attempt_id, (
             SELECT cg.current_payment_attempt_id FROM checkout_groups cg WHERE cg.id = p.checkout_group_id
           ))
           WHERE p.status = 'AWAITING_PAYMENT' AND pa.status = 'expired'
           FOR UPDATE OF p`,
        ));
        for (const expired of expiredRows) {
          const updated = await repository.transition(expired.id, {
            from: 'AWAITING_PAYMENT', to: 'PAYMENT_EXPIRED', fields: { payment_expired_at: effectiveNow },
          }, { tx });
          if (updated) {
            await repository.releaseReservation(expired.id, 'expired', { tx });
            outcomes.payment_expired += 1;
          }
        }
        const due = await repository.listDue(effectiveNow, { tx });
        for (const preorder of due) {
          const start = asDate(preorder.scheduled_start_at, 'scheduled_start_at');
          if (preorder.status === 'PENDING_MANAGER_CONFIRMATION') {
            if (!preorder.reminder_t60_sent_at && effectiveNow.getTime() >= start.getTime() - 60 * 60_000) {
              await repository.updateIncident(preorder.incident_id, { reminder_t60_sent_at: effectiveNow }, { tx });
              await queueRecipient(preorder, 'confirmation_t60', preorder.responsible_manager_id, tx); outcomes.t60 += 1;
            }
            if (!preorder.urgent_t30_sent_at && effectiveNow.getTime() >= start.getTime() - 30 * 60_000) {
              await repository.updateIncident(preorder.incident_id, { urgent_t30_sent_at: effectiveNow }, { tx });
              await queueRecipient(preorder, 'confirmation_t30', preorder.responsible_manager_id, tx);
              await queueRecipient(preorder, 'customer_t30', preorder.customer_user_id, tx);
              outcomes.t30 += 1;
            }
            if (!preorder.breached_at && effectiveNow.getTime() >= start.getTime()) {
              await repository.updateIncident(preorder.incident_id, { breached_at: effectiveNow }, { tx });
              await queueRecipient(preorder, 'scheduled_start', preorder.customer_user_id, tx);
              await queueRecipient(preorder, 'confirmation_breach', preorder.responsible_manager_id, tx);
              const slotStrike = await repository.recordSlotStrikeOnce({
                preorderId: preorder.id,
                scheduledStartAt: preorder.scheduled_start_at,
                managerId: preorder.responsible_manager_id,
                strikeSource: 'CONFIRMATION_BREACH',
              }, { tx });
              if (slotStrike) {
                await repository.lockStrike(preorder.responsible_manager_id, { tx });
                const strike = await repository.incrementStrike(preorder.responsible_manager_id, { tx });
                await tx.query(
                  `INSERT INTO audit_logs (user_id, action, detail)
                   VALUES ($1, 'PREORDER_CONFIRMATION_BREACH', $2)`,
                  [Number(preorder.responsible_manager_id), JSON.stringify({ preorder_id: Number(preorder.id), strike: Number(strike.confirmed_breach_count) })],
                );
                if (Number(strike.confirmed_breach_count) >= 2) {
                  await usersRepo.updateStaffStatus(Number(preorder.responsible_manager_id), false, { tx });
                  await tx.query(
                    'UPDATE manager_preorder_strikes SET disabled_by_preorder_at = CURRENT_TIMESTAMP WHERE manager_id = $1', [Number(preorder.responsible_manager_id)],
                  );
                  await tx.query('UPDATE preorder_store_settings SET is_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE store_id = $1', [Number(preorder.store_id)]);
                  await tx.query(
                    `INSERT INTO audit_logs (user_id, action, detail)
                     VALUES ($1, 'PREORDER_MANAGER_AUTO_DISABLED', $2)`,
                    [Number(preorder.responsible_manager_id), JSON.stringify({ store_id: Number(preorder.store_id), strike: Number(strike.confirmed_breach_count) })],
                  );
                  const supers = listRows(await tx.query("SELECT id FROM users WHERE is_admin = TRUE AND admin_role = 'super' AND is_active = TRUE"));
                  for (const superUser of supers) await queueRecipient(preorder, 'manager_auto_disabled', superUser.id, tx);
                }
              }
              outcomes.breached += 1;
            }
          }

          // Closing time (24:00 of scheduled local date) evaluation
          const scheduledDayStr = formatVietnamBusinessDate(start);
          const scheduledBoundary = parseVietnamSingleDateBoundary(scheduledDayStr);
          const isClosingPassed = effectiveNow.getTime() >= scheduledBoundary.endDate.getTime();

          if (isClosingPassed) {
            if (preorder.checked_in_at == null && ['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'].includes(preorder.status)) {
              const updated = await repository.transition(preorder.id, {
                from: ['PENDING_MANAGER_CONFIRMATION', 'CONFIRMED'],
                to: 'NO_SHOW',
                fields: {},
              }, { tx });
              if (updated) {
                await repository.releaseReservation(preorder.id, 'released', { tx });
                await queueRecipient(updated, 'no_show', updated.customer_user_id, tx);
                await queueRecipient(updated, 'no_show_store', updated.responsible_manager_id, tx);
                outcomes.no_show += 1;
              }
            } else if (preorder.checked_in_at != null && preorder.completed_at == null && preorder.status === 'CHECKED_IN') {
              if (preorder.handover_overdue_at == null) {
                const updated = await repository.markHandoverOverdue({
                  preorderId: preorder.id,
                  overdueAt: effectiveNow,
                }, { tx });
                if (updated) {
                  await queueRecipient(preorder, 'handover_overdue', preorder.responsible_manager_id, tx);
                  const supers = listRows(await tx.query("SELECT id FROM users WHERE is_admin = TRUE AND admin_role = 'super' AND is_active = TRUE"));
                  for (const superUser of supers) await queueRecipient(preorder, 'handover_overdue_super', superUser.id, tx);
                  outcomes.overdue = (outcomes.overdue || 0) + 1;
                  outcomes.overdue_escalated = (outcomes.overdue_escalated || 0) + 1;
                }
              }
            }
          }
        }
      });
      const delivery = await deliverPendingNotifications();
      return { ...outcomes, delivery };
    },

    deliverPendingNotifications,
  };
}

export const preorderService = createPreorderService();
export default preorderService;
