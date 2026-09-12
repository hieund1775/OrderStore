import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPreorderService } from '../services/preorders/preorder-service.js';

const now = new Date('2026-09-11T05:00:00.000Z'); // 12:00 Asia/Ho_Chi_Minh

function row(value) { return { rows: value == null ? [] : [value] }; }

function harness(overrides = {}) {
  const calls = { transitions: [], holds: 0, releases: 0, queues: [], histories: 0, disabledManagers: 0 };
  const tx = {
    async query(sql) {
      if (sql.includes('SELECT id FROM preorder_confirmation_incidents')) return row({ id: 91 });
      if (sql.includes('UPDATE preorders SET scheduled_start_at')) return row({ id: 10, preorder_code: 'PO1', customer_user_id: 5, responsible_manager_id: 9, store_id: 1 });
      if (sql.includes('SELECT oi.id')) return { rows: [] };
      if (sql.includes('UPDATE preorder_table_reservations SET status')) return { rows: [] };
      if (sql.includes("SELECT id FROM preorders WHERE status = 'CHECKED_IN'")) return { rows: [] };
      if (sql.includes('SELECT p.id\n           FROM preorders')) return { rows: [] };
      if (sql.includes('SELECT id FROM users WHERE is_admin')) return { rows: [] };
      return { rows: [] };
    },
  };
  const database = {
    async transaction(callback) { return callback(tx); },
    async query() { return { rows: [] }; },
  };
  const repository = {
    async getActiveStoreSetting() { return { store_id: 1, is_enabled: true, responsible_manager_id: 9, admin_role: 'manager', admin_branch_id: 1 }; },
    async findByPaymentTarget() { return null; },
    async findById() { return null; },
    async findByOrderId() { return null; },
    async transition(id, input) { calls.transitions.push({ id, ...input }); return { id, status: input.to, store_id: 1, customer_user_id: 5, responsible_manager_id: 9, preorder_code: 'PO1' }; },
    async holdReservation() { calls.holds += 1; },
    async releaseReservation() { calls.releases += 1; },
    async createConfirmationIncident() { return { id: 91 }; },
    async queueDelivery(input) { calls.queues.push(input); return { id: calls.queues.length }; },
    async updateIncident() { return { id: 91 }; },
    async listLinkedOrders() { return []; },
    async moveReservation() {},
    async addRescheduleHistory() { calls.histories += 1; return { id: 1 }; },
    async listDue() { return []; },
    async lockStrike() { return { manager_id: 9 }; },
    async incrementStrike() { return { manager_id: 9, confirmed_breach_count: 1 }; },
    async claimPendingEmailDeliveries() { return []; },
    async completeEmailDelivery() {},
    ...overrides,
  };
  const service = createPreorderService({
    repository,
    database,
    fulfillment: { async splitAndCreateTasksForOrder() {} },
    notifications: { async insertForUser() {} },
    usersRepo: { async updateStaffStatus() { calls.disabledManagers += 1; } },
    email: { async sendEmail() {} },
    now: () => now,
  });
  return { service, repository, calls };
}

describe('Preorder service lifecycle and authorization', () => {
  it('queries table availability with an explicit timestamptz parameter', async () => {
    let capturedSql = '';
    const database = {
      async query(sql) {
        capturedSql = sql;
        return { rows: [] };
      },
      async transaction(callback) { return callback({ query: async () => ({ rows: [] }) }); },
    };
    const service = createPreorderService({
      database,
      repository: {
        async getActiveStoreSetting() {
          return { store_id: 1, is_enabled: true, responsible_manager_id: 9, admin_role: 'manager', admin_branch_id: 1 };
        },
      },
      now: () => now,
    });

    const result = await service.availableTables({ storeId: 1, date: '2026-09-12', hour: 20 });
    assert.deepEqual(result.tables, []);
    assert.match(capturedSql, /\$2::timestamptz\s*-\s*INTERVAL '30 minutes'/i);
    assert.match(capturedSql, /\$2::timestamptz\s*\+\s*INTERVAL '60 minutes'/i);
  });

  it('bridges canonical paid evidence exactly once into manager confirmation', async () => {
    const preorder = { id: 10, status: 'AWAITING_PAYMENT', store_id: 1, customer_user_id: 5, responsible_manager_id: 9, preorder_code: 'PO1' };
    const { service, calls } = harness({ async findByPaymentTarget() { return preorder; } });

    const result = await service.onPaymentSettled({ orderId: 44 });

    assert.equal(result.kind, 'pending_manager_confirmation');
    assert.deepEqual(calls.transitions[0], {
      id: 10, from: 'AWAITING_PAYMENT', to: 'PENDING_MANAGER_CONFIRMATION', fields: {},
    });
    assert.equal(calls.holds, 1);
    assert.equal(calls.queues.length, 4, 'customer and responsible Manager each receive in-app + email logical deliveries');
  });

  it('routes valid late provider payment to manual action without confirming it', async () => {
    const { service, calls } = harness({
      async findByPaymentTarget() { return { id: 10, status: 'PAYMENT_EXPIRED', store_id: 1, customer_user_id: 5, responsible_manager_id: 9 }; },
    });
    const result = await service.onPaymentSettled({ checkoutGroupId: 8, late: true });
    assert.equal(result.kind, 'late_paid');
    assert.equal(calls.transitions[0].to, 'LATE_PAID_REQUIRES_ACTION');
    assert.notEqual(calls.transitions[0].to, 'PENDING_MANAGER_CONFIRMATION');
  });

  it('rejects cashier check-in and accepts only the branch Manager or Super', async () => {
    const preorder = { id: 10, status: 'CONFIRMED', store_id: 1, scheduled_start_at: now.toISOString() };
    const { service, calls } = harness({ async findById() { return preorder; } });
    await assert.rejects(() => service.checkIn({ preorderId: 10, actor: { role: 'cashier', branch_id: 1, sub: 7 } }), { code: 'PREORDER_BRANCH_FORBIDDEN' });
    await service.checkIn({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 } });
    assert.equal(calls.transitions[0].to, 'CHECKED_IN');
  });

  it('preserves lifecycle status on the single allowed reschedule', async () => {
    const preorder = {
      id: 10, status: 'CONFIRMED', store_id: 1, table_id: null, reschedule_count: 0,
      scheduled_start_at: '2026-09-12T03:00:00.000Z', scheduled_end_at: '2026-09-12T04:00:00.000Z',
    };
    const { service, calls } = harness({ async findById() { return preorder; } });
    await service.reschedule({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 }, date: '2026-09-12', hour: 11, reason: 'customer agreed' });
    assert.equal(calls.histories, 1);
    assert.equal(calls.transitions.length, 0, 'reschedule is immutable history, not a lifecycle transition');
  });

  it('rejects a second reschedule before writing history', async () => {
    const preorder = { id: 10, status: 'PENDING_MANAGER_CONFIRMATION', store_id: 1, table_id: null, reschedule_count: 1 };
    const { service, calls } = harness({ async findById() { return preorder; } });
    await assert.rejects(
      () => service.reschedule({ preorderId: 10, actor: { role: 'manager', branch_id: 1, sub: 9 }, date: '2026-09-12', hour: 11, reason: 'customer agreed' }),
      { code: 'PREORDER_RESCHEDULE_NOT_ALLOWED' },
    );
    assert.equal(calls.histories, 0);
  });

  it('recovers a concurrent duplicate idempotency key through canonical checkout', async () => {
    const duplicate = Object.assign(new Error('duplicate preorder idempotency key'), {
      code: '23505', constraint: 'uq_preorders_customer_checkout_idempotency',
    });
    let findCount = 0;
    let checkoutCalls = 0;
    const repository = {
      async getActiveStoreSetting() { return { store_id: 1, is_enabled: true, responsible_manager_id: 9, admin_role: 'manager', admin_branch_id: 1 }; },
      async findByCustomerIdempotency() {
        findCount += 1;
        return findCount === 1 ? null : { id: 10, preorder_code: 'PO1', status: 'AWAITING_PAYMENT' };
      },
      async createAwaitingPayment() { return { id: 10 }; },
    };
    const service = createPreorderService({
      repository,
      database: { async transaction(callback) { await callback({ query: async () => ({ rows: [] }) }); throw duplicate; } },
      orderService: {
        async create({ input, idempotencyKey }) {
          checkoutCalls += 1;
          assert.equal(input.preorder_id, 10);
          assert.equal(idempotencyKey, 'preorder-concurrent-key');
          return { order_code: 'ORD-1' };
        },
      },
      now: () => now,
    });

    const result = await service.checkout({
      input: { store_id: 1, scheduled_date: '2026-09-11', scheduled_hour: 15, items: [] },
      customerUserId: 5,
      idempotencyKey: 'preorder-concurrent-key',
    });

    assert.equal(result.replay, true);
    assert.equal(result.preorder.id, 10);
    assert.equal(checkoutCalls, 1);
  });

  it('expires an unpaid preorder and releases only its pending table hold', async () => {
    const { service, calls } = harness({
      async findByPaymentTarget() { return { id: 10, status: 'AWAITING_PAYMENT', store_id: 1, customer_user_id: 5, responsible_manager_id: 9 }; },
    });
    const result = await service.onPaymentExpired({ orderId: 44 });
    assert.equal(result.status, 'PAYMENT_EXPIRED');
    assert.equal(calls.transitions[0].to, 'PAYMENT_EXPIRED');
    assert.equal(calls.releases, 1);
  });

  it('records a first confirmation breach at scheduled start without disabling the Manager', async () => {
    const due = {
      id: 10, incident_id: 91, status: 'PENDING_MANAGER_CONFIRMATION', store_id: 1,
      customer_user_id: 5, responsible_manager_id: 9, preorder_code: 'PO1',
      scheduled_start_at: now.toISOString(), reminder_t60_sent_at: null, urgent_t30_sent_at: null, breached_at: null,
    };
    const { service, calls } = harness({ async listDue() { return [due]; } });
    const result = await service.processDue();
    assert.equal(result.breached, 1);
    assert.equal(calls.disabledManagers, 0);
    assert.ok(calls.queues.some((entry) => entry.eventType === 'confirmation_t60'));
    assert.ok(calls.queues.some((entry) => entry.eventType === 'confirmation_t30'));
    assert.ok(calls.queues.some((entry) => entry.eventType === 'confirmation_breach'));
  });

  it('uses canonical staff disable/token invalidation flow on the second confirmed breach', async () => {
    const due = {
      id: 10, incident_id: 91, status: 'PENDING_MANAGER_CONFIRMATION', store_id: 1,
      customer_user_id: 5, responsible_manager_id: 9, preorder_code: 'PO1',
      scheduled_start_at: now.toISOString(), reminder_t60_sent_at: now, urgent_t30_sent_at: now, breached_at: null,
    };
    const { service, calls } = harness({
      async listDue() { return [due]; },
      async incrementStrike() { return { manager_id: 9, confirmed_breach_count: 2 }; },
    });
    const result = await service.processDue();
    assert.equal(result.breached, 1);
    assert.equal(calls.disabledManagers, 1);
  });
});
