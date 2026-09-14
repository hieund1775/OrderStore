import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPreorderService, PreorderError } from '../services/preorders/preorder-service.js';

// Base time: 2026-09-15 19:00:00 local time (12:00 UTC)
const baseTime = new Date('2026-09-15T12:00:00.000Z');

function createHarness(overrides = {}) {
  const calls = {
    transitions: [],
    releases: [],
    queues: [],
    strikes: [],
    disabledStaff: [],
    checkinRequests: [],
    slotStrikes: [],
  };

  const requests = new Map();
  const slotStrikes = new Map();

  const repo = {
    async findById(id) {
      return {
        id: Number(id),
        preorder_code: 'PO123',
        store_id: 1,
        customer_user_id: 5,
        responsible_manager_id: 9,
        scheduled_start_at: baseTime.toISOString(),
        scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
        status: 'CONFIRMED',
        reschedule_count: 0,
        checked_in_at: null,
        handover_confirmed_at: null,
        handover_overdue_at: null,
        ...overrides.preorder,
      };
    },
    async findCurrentCheckinRequest(preorderId, scheduledStart) {
      const key = `${preorderId}:${new Date(scheduledStart).toISOString()}`;
      return requests.get(key) || overrides.currentCheckinRequest || null;
    },
    async createOrGetCheckinRequest(data) {
      calls.checkinRequests.push(data);
      const key = `${data.preorderId}:${new Date(data.scheduledStartAt).toISOString()}`;
      if (!requests.has(key)) {
        requests.set(key, {
          id: 101,
          status: 'PENDING',
          requested_at: data.requestedAt || new Date(),
          ...data,
        });
      }
      return requests.get(key);
    },
    async confirmCheckinRequest(data) {
      calls.checkinRequests.push({ type: 'confirm', ...data });
      return { id: data.requestId, status: 'CONFIRMED', ...data };
    },
    async rejectCheckinRequest(data) {
      calls.checkinRequests.push({ type: 'reject', ...data });
      return { id: data.requestId, status: 'REJECTED', ...data };
    },
    async markCheckinRequestRescheduled(data) {
      calls.transitions.push({ type: 'markCheckinRequestRescheduled', ...data });
      calls.checkinRequests.push({ type: 'rescheduled', ...data });
      return [];
    },
    async recordSlotStrikeOnce(data) {
      calls.slotStrikes.push(data);
      const key = `${data.preorderId}:${new Date(data.scheduledStartAt).toISOString()}`;
      if (slotStrikes.has(key)) return null;
      slotStrikes.set(key, data);
      return { id: 201, ...data };
    },
    async markCheckinManagerBreachOnce(data) {
      return { id: data.requestId, manager_breach_recorded_at: data.breachedAt };
    },
    async transition(id, { from, to, fields = {} }) {
      calls.transitions.push({ id, from, to, fields });
      return { id, status: to, ...fields };
    },
    async releaseReservation(id, reason) {
      calls.releases.push({ id, reason });
      return { id, status: reason };
    },
    async queueDelivery(data) {
      calls.queues.push(data);
      return { id: 1, ...data };
    },
    async lockStrike(managerId) {
      return { manager_id: managerId };
    },
    async incrementStrike(managerId) {
      calls.strikes.push(managerId);
      return { manager_id: managerId, confirmed_breach_count: overrides.strikeCount || 1 };
    },
    async listDue() {
      return overrides.dueList || [];
    },
    async updateIncident() {
      return null;
    },
    async moveReservation(data) {
      calls.transitions.push({ type: 'moveReservation', ...data });
      return null;
    },
    async addRescheduleHistory(data) {
      calls.transitions.push({ type: 'addRescheduleHistory', ...data });
      return null;
    },
    async claimPendingEmailDeliveries() {
      return [];
    },
    async completeEmailDelivery() {},
    async confirmHandover(data) {
      calls.transitions.push({ type: 'confirmHandover', ...data });
      return {
        id: data.preorderId,
        status: 'COMPLETED',
        handover_confirmed_at: data.handoverAt,
        handover_confirmed_by: data.actorId,
      };
    },
    async markHandoverOverdue(input, overdueAt) {
      const preorderId = typeof input === 'object' && input ? input.preorderId : input;
      const at = typeof input === 'object' && input ? input.overdueAt : overdueAt;
      calls.transitions.push({ type: 'markHandoverOverdue', preorderId, overdueAt: at });
      return { id: preorderId, handover_overdue_at: at };
    },
    async listLinkedOrders(id) {
      return overrides.linkedOrders || [{ id: 101, latest_status: 'Hoàn thành' }];
    },
    ...overrides.repo,
  };

  const db = {
    async transaction(callback) {
      const tx = {
        async query(sql, params = []) {
          if (sql.includes('SELECT * FROM preorders WHERE preorder_code = $1')) {
            const po = {
              id: 10,
              preorder_code: params[0],
              customer_user_id: 5,
              store_id: 1,
              responsible_manager_id: 9,
              scheduled_start_at: baseTime.toISOString(),
              scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
              status: 'CONFIRMED',
              reschedule_count: 0,
              checked_in_at: null,
              handover_confirmed_at: null,
              handover_overdue_at: null,
              ...overrides.preorder,
            };
            return { rows: [po] };
          }
          if (sql.includes('UPDATE preorders') && sql.includes('RETURNING *')) {
            const po = {
              id: params[0] || 10,
              preorder_code: 'PO123',
              customer_user_id: 5,
              store_id: 1,
              responsible_manager_id: 9,
              scheduled_start_at: params[1] || baseTime.toISOString(),
              scheduled_end_at: params[2] || new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
              status: 'CONFIRMED',
              reschedule_count: 1,
              ...overrides.preorder,
            };
            return { rows: [po] };
          }
          if (sql.includes('SELECT p.id\n           FROM preorders p\n           LEFT JOIN orders o')) {
            return { rows: [] };
          }
          if (sql.includes("SELECT id FROM preorders WHERE status = 'CHECKED_IN'")) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      };
      return callback(tx);
    },
    async query() {
      return { rows: [] };
    },
  };

  const usersRepo = {
    async updateStaffStatus(userId, status) {
      calls.disabledStaff.push({ userId, status });
    },
  };

  const notifications = {
    async insertForUser() {},
  };

  const service = createPreorderService({
    repository: repo,
    database: db,
    usersRepo,
    notifications,
    now: () => overrides.now || baseTime,
  });

  return { service, calls, requests, slotStrikes };
}

describe('Preorder Customer Check-in Contract', () => {
  it('allows customer to self-service check in on scheduled date (08:00 - 24:00 local time)', async () => {
    // 10:00 VN time on 2026-09-15 (03:00 UTC)
    const testNow = new Date('2026-09-15T03:00:00.000Z');
    const { service, calls } = createHarness({ now: testNow });

    const result = await service.customerCheckIn({
      preorderCode: 'PO123',
      customerUserId: 5,
      now: testNow,
    });

    assert.equal(result.status, 'CHECKED_IN');
    assert.ok(result.checked_in_at);
    assert.equal(result.checked_in_by, 5);
    assert.equal(calls.transitions.length, 1);
    assert.equal(calls.transitions[0].to, 'CHECKED_IN');
  });

  it('customer check-in is idempotent duplicate on second call', async () => {
    const testNow = new Date('2026-09-15T03:00:00.000Z');
    const { service, calls } = createHarness({
      now: testNow,
      preorder: { status: 'CHECKED_IN', checked_in_at: testNow.toISOString() },
    });

    const result = await service.customerCheckIn({
      preorderCode: 'PO123',
      customerUserId: 5,
      now: testNow,
    });

    assert.equal(result.status, 'CHECKED_IN');
    assert.equal(result.duplicate, true);
    assert.equal(calls.transitions.length, 0);
  });

  it('rejects customer check-in before 08:00 local time', async () => {
    // 07:30 VN time on 2026-09-15 (00:30 UTC)
    const testNow = new Date('2026-09-15T00:30:00.000Z');
    const { service } = createHarness({ now: testNow });

    await assert.rejects(
      () => service.customerCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_WINDOW_EARLY' && err.status === 409,
    );
  });

  it('rejects customer check-in on a different date', async () => {
    // 10:00 VN time on 2026-09-16 (next day)
    const testNow = new Date('2026-09-16T03:00:00.000Z');
    const { service } = createHarness({ now: testNow });

    await assert.rejects(
      () => service.customerCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_WINDOW_EXPIRED' && err.status === 409,
    );
  });

  it('rejects check-in request if preorder status is invalid (e.g. AWAITING_PAYMENT)', async () => {
    const testNow = baseTime;
    const { service } = createHarness({
      now: testNow,
      preorder: { status: 'AWAITING_PAYMENT' },
    });

    await assert.rejects(
      () => service.customerCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_STATUS_INVALID' && err.status === 409,
    );
  });

  it('rejects check-in if actor is not the customer owner', async () => {
    const testNow = baseTime;
    const { service } = createHarness({ now: testNow });

    await assert.rejects(
      () => service.customerCheckIn({ preorderCode: 'PO123', customerUserId: 999, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_FORBIDDEN' && err.status === 403,
    );
  });

  it('forbids customer cancellation once checked in', async () => {
    const { service } = createHarness({
      preorder: { status: 'CHECKED_IN', checked_in_at: baseTime.toISOString() },
    });

    await assert.rejects(
      () => service.cancel({ preorderCode: 'PO123', customerUserId: 5 }),
      (err) => err.code === 'PREORDER_CANCEL_CHECKED_IN' && err.status === 409,
    );
  });

  it('allows customer cancellation before 24:00 on scheduled date if not checked in', async () => {
    const cancelNow = new Date('2026-09-15T05:00:00.000Z'); // 12:00 VN time
    const { service, calls } = createHarness({
      now: cancelNow,
      preorder: { status: 'CONFIRMED', checked_in_at: null },
    });

    const result = await service.cancel({
      preorderCode: 'PO123',
      customerUserId: 5,
      reason: 'Khách đổi kế hoạch',
      now: cancelNow,
    });

    assert.equal(result.status, 'CUSTOMER_CANCELLED');
    assert.equal(calls.transitions.some((t) => t.to === 'CUSTOMER_CANCELLED'), true);
  });

  it('legacy manager check-in endpoints return PREORDER_CHECKIN_SELF_SERVICE_REQUIRED (400)', async () => {
    const { service } = createHarness();

    await assert.rejects(
      () => service.checkIn({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 } }),
      (err) => err.code === 'PREORDER_CHECKIN_SELF_SERVICE_REQUIRED' && err.status === 400,
    );

    await assert.rejects(
      () => service.rejectCheckIn({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 }, reason: 'Test' }),
      (err) => err.code === 'PREORDER_CHECKIN_SELF_SERVICE_REQUIRED' && err.status === 400,
    );
  });

  it('manager handover confirmation requires customer check-in first', async () => {
    const { service } = createHarness({
      preorder: { status: 'CONFIRMED', checked_in_at: null },
    });

    await assert.rejects(
      () => service.confirmHandover({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 } }),
      (err) => err.code === 'PREORDER_HANDOVER_NOT_CHECKED_IN' && err.status === 409,
    );
  });

  it('manager handover confirmation requires 100% linked orders completed', async () => {
    const { service } = createHarness({
      preorder: { status: 'CHECKED_IN', checked_in_at: baseTime.toISOString() },
      linkedOrders: [{ id: 101, latest_status: 'Đang chuẩn bị' }],
    });

    await assert.rejects(
      () => service.confirmHandover({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 } }),
      (err) => err.code === 'PREORDER_HANDOVER_INCOMPLETE_ORDERS' && err.status === 409,
    );
  });

  it('manager handover confirmation succeeds when checked in and orders complete', async () => {
    const { service, calls } = createHarness({
      preorder: { status: 'CHECKED_IN', checked_in_at: baseTime.toISOString() },
      linkedOrders: [{ id: 101, latest_status: 'Hoàn thành' }],
    });

    const result = await service.confirmHandover({
      preorderId: 10,
      actor: { role: 'manager', branch_id: 1, sub: 9 },
      now: baseTime,
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(calls.transitions.some((t) => t.type === 'confirmHandover'), true);
  });

  it('manager handover confirmation is idempotent duplicate', async () => {
    const { service, calls } = createHarness({
      preorder: {
        status: 'COMPLETED',
        checked_in_at: baseTime.toISOString(),
        handover_confirmed_at: baseTime.toISOString(),
      },
      linkedOrders: [{ id: 101, latest_status: 'Hoàn thành' }],
    });

    const result = await service.confirmHandover({
      preorderId: 10,
      actor: { role: 'manager', branch_id: 1, sub: 9 },
      now: baseTime,
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.idempotent, true);
  });

  it('due processor at day close marks unchecked-in as NO_SHOW', async () => {
    // 00:05 VN time on 2026-09-16 (17:05 UTC on 2026-09-15)
    const dueTime = new Date('2026-09-15T17:05:00.000Z');
    const duePreorder = {
      id: 10,
      status: 'CONFIRMED',
      store_id: 1,
      customer_user_id: 5,
      responsible_manager_id: 9,
      preorder_code: 'PO123',
      scheduled_start_at: baseTime.toISOString(),
      scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
      checked_in_at: null,
    };

    const { service, calls } = createHarness({
      now: dueTime,
      dueList: [duePreorder],
    });

    const result = await service.processDue({ now: dueTime });

    assert.equal(result.no_show, 1);
    assert.equal(calls.transitions.some((t) => t.to === 'NO_SHOW'), true);
  });

  it('due processor at day close never cancels checked-in preorder, escalates handover_overdue_at', async () => {
    // 00:05 VN time on 2026-09-16 (17:05 UTC on 2026-09-15)
    const dueTime = new Date('2026-09-15T17:05:00.000Z');
    const duePreorder = {
      id: 10,
      status: 'CHECKED_IN',
      store_id: 1,
      customer_user_id: 5,
      responsible_manager_id: 9,
      preorder_code: 'PO123',
      scheduled_start_at: baseTime.toISOString(),
      scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
      checked_in_at: baseTime.toISOString(),
      handover_confirmed_at: null,
      handover_overdue_at: null,
    };

    const { service, calls } = createHarness({
      now: dueTime,
      dueList: [duePreorder],
    });

    const result = await service.processDue({ now: dueTime });

    assert.equal(result.no_show, 0);
    assert.equal(result.overdue_escalated, 1);
    assert.equal(calls.transitions.some((t) => t.type === 'markHandoverOverdue'), true);
  });

  it('reschedule atomically records history without table reservation', async () => {
    const { service, calls } = createHarness();

    const targetDate = '2026-09-16';

    await service.reschedule({
      preorderId: 10,
      actor: { role: 'manager', branch_id: 1, sub: 9 },
      date: targetDate,
      hour: 14,
      reason: 'Khách yêu cầu chuyển giờ sang chiều mai',
    });

    const historyCall = calls.transitions.find((c) => c.type === 'addRescheduleHistory');
    assert.ok(historyCall, 'addRescheduleHistory must be called');
    const reservationCalls = calls.transitions.filter((c) => c.type === 'moveReservation');
    assert.equal(reservationCalls.length, 0, 'Must not move reservation');
  });
});
