import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPreorderService, PreorderError } from '../services/preorders/preorder-service.js';

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
    async moveReservation() {
      return null;
    },
    async addRescheduleHistory() {
      return null;
    },
    ...overrides.repo,
  };

  const db = {
    async transaction(callback) {
      const tx = {
        async query(sql, params = []) {
          if (sql.includes('SELECT * FROM preorders WHERE preorder_code = $1')) {
            return {
              rows: [{
                id: 10,
                preorder_code: params[0],
                customer_user_id: params[1],
                store_id: 1,
                responsible_manager_id: 9,
                scheduled_start_at: baseTime.toISOString(),
                scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
                status: 'CONFIRMED',
                reschedule_count: 0,
                ...overrides.preorder,
              }],
            };
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
  it('allows customer to request check-in within [T-30, T+30] arrival window', async () => {
    // T - 15 minutes
    const testNow = new Date(baseTime.getTime() - 15 * 60_000);
    const { service, calls } = createHarness({ now: testNow });

    const result = await service.requestCheckIn({
      preorderCode: 'PO123',
      customerUserId: 5,
      now: testNow,
    });

    assert.equal(result.status, 'PENDING');
    assert.equal(calls.checkinRequests.length, 1);
    assert.equal(calls.checkinRequests[0].preorderId, 10);
    assert.equal(calls.queues.some((q) => q.eventType === 'checkin_requested'), true);
  });

  it('rejects check-in request before T-30 minutes', async () => {
    // T - 31 minutes
    const testNow = new Date(baseTime.getTime() - 31 * 60_000);
    const { service } = createHarness({ now: testNow });

    await assert.rejects(
      () => service.requestCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_WINDOW_EARLY' && err.status === 409,
    );
  });

  it('rejects check-in request after T+30 minutes', async () => {
    // T + 31 minutes
    const testNow = new Date(baseTime.getTime() + 31 * 60_000);
    const { service } = createHarness({ now: testNow });

    await assert.rejects(
      () => service.requestCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
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
      () => service.requestCheckIn({ preorderCode: 'PO123', customerUserId: 5, now: testNow }),
      (err) => err.code === 'PREORDER_CHECKIN_STATUS_INVALID' && err.status === 409,
    );
  });

  it('forbids customer cancellation once a check-in request exists', async () => {
    const { service } = createHarness({
      currentCheckinRequest: { id: 101, status: 'PENDING' },
    });

    await assert.rejects(
      () => service.cancel({ preorderCode: 'PO123', customerUserId: 5 }),
      (err) => err.code === 'PREORDER_CANCEL_CHECKIN_REQUESTED' && err.status === 409,
    );
  });

  it('manager check-in requires a pending check-in request from customer', async () => {
    const { service } = createHarness({
      currentCheckinRequest: null, // No request
    });

    await assert.rejects(
      () => service.checkIn({
        preorderId: 10,
        actor: { role: 'manager', branch_id: 1, sub: 9 },
      }),
      (err) => err.code === 'PREORDER_CHECKIN_REQUEST_REQUIRED' && err.status === 409,
    );
  });

  it('manager check-in after T+30 requires late_confirmation_reason and calculates late_minutes from customer arrival', async () => {
    // Customer requested at T + 10m
    const customerArrivalTime = new Date(baseTime.getTime() + 10 * 60_000);
    // Manager confirms at T + 35m
    const managerConfirmTime = new Date(baseTime.getTime() + 35 * 60_000);

    const { service, calls } = createHarness({
      now: managerConfirmTime,
      currentCheckinRequest: {
        id: 101,
        status: 'PENDING',
        requested_at: customerArrivalTime,
      },
    });

    // Without reason: rejects
    await assert.rejects(
      () => service.checkIn({
        preorderId: 10,
        actor: { role: 'manager', branch_id: 1, sub: 9 },
        lateConfirmationReason: '',
        now: managerConfirmTime,
      }),
      (err) => err.code === 'PREORDER_CHECKIN_LATE_REASON_REQUIRED' && err.status === 400,
    );

    // With reason: succeeds and customer late_minutes is 10 (not 35!)
    await service.checkIn({
      preorderId: 10,
      actor: { role: 'manager', branch_id: 1, sub: 9 },
      lateConfirmationReason: 'Busy rush hour at counter',
      now: managerConfirmTime,
    });

    assert.equal(calls.transitions.length, 1);
    assert.equal(calls.transitions[0].to, 'CHECKED_IN');
    assert.equal(calls.transitions[0].fields.late_minutes, 10);
    assert.equal(calls.checkinRequests.some((r) => r.type === 'confirm' && r.lateConfirmationReason === 'Busy rush hour at counter'), true);
  });

  it('due processor never marks NO_SHOW when customer has pending check-in request, records manager breach instead', async () => {
    // Time is T + 35 minutes
    const dueTime = new Date(baseTime.getTime() + 35 * 60_000);
    const duePreorder = {
      id: 10,
      incident_id: 91,
      status: 'CONFIRMED',
      store_id: 1,
      customer_user_id: 5,
      responsible_manager_id: 9,
      preorder_code: 'PO123',
      scheduled_start_at: baseTime.toISOString(),
      scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
    };

    const { service, calls } = createHarness({
      now: dueTime,
      dueList: [duePreorder],
      currentCheckinRequest: {
        id: 101,
        status: 'PENDING',
        requested_at: new Date(baseTime.getTime() + 5 * 60_000),
        manager_breach_recorded_at: null,
      },
      strikeCount: 1,
    });

    const result = await service.processDue({ now: dueTime });

    // Must NOT be no-show!
    assert.equal(result.no_show, 0);
    assert.equal(calls.transitions.some((t) => t.to === 'NO_SHOW'), false);
    // Manager breach recorded
    assert.equal(result.breached, 1);
    assert.equal(calls.strikes.length, 1);
    assert.equal(calls.slotStrikes.length, 1);
    assert.equal(calls.slotStrikes[0].strikeSource, 'CHECKIN_BREACH');
  });

  it('due processor marks NO_SHOW when no check-in request exists past T+30', async () => {
    const dueTime = new Date(baseTime.getTime() + 35 * 60_000);
    const duePreorder = {
      id: 10,
      incident_id: 91,
      status: 'CONFIRMED',
      store_id: 1,
      customer_user_id: 5,
      responsible_manager_id: 9,
      preorder_code: 'PO123',
      scheduled_start_at: baseTime.toISOString(),
      scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
    };

    const { service, calls } = createHarness({
      now: dueTime,
      dueList: [duePreorder],
      currentCheckinRequest: null,
    });

    const result = await service.processDue({ now: dueTime });

    assert.equal(result.no_show, 1);
    assert.equal(calls.transitions.some((t) => t.to === 'NO_SHOW'), true);
    assert.equal(calls.releases.some((r) => r.reason === 'released'), true);
  });

  it('guarantees at most 1 strike per slot across confirmation and check-in breach', async () => {
    const dueTime = new Date(baseTime.getTime() + 35 * 60_000);
    const duePreorder = {
      id: 10,
      incident_id: 91,
      status: 'CONFIRMED',
      store_id: 1,
      customer_user_id: 5,
      responsible_manager_id: 9,
      preorder_code: 'PO123',
      scheduled_start_at: baseTime.toISOString(),
      scheduled_end_at: new Date(baseTime.getTime() + 60 * 60_000).toISOString(),
    };

    const { service, calls, slotStrikes } = createHarness({
      now: dueTime,
      dueList: [duePreorder],
      currentCheckinRequest: {
        id: 101,
        status: 'PENDING',
        requested_at: baseTime,
        manager_breach_recorded_at: null,
      },
    });

    // Simulate that confirmation breach already took the strike for this slot
    slotStrikes.set(`10:${baseTime.toISOString()}`, { strikeSource: 'CONFIRMATION_BREACH' });

    const result = await service.processDue({ now: dueTime });

    // Strike is NOT incremented because slot strike event already exists
    assert.equal(calls.strikes.length, 0);
  });
});
