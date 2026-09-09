import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGroupedPayOSAttemptService } from '../services/grouped-payos-attempt.js';

const expiry = new Date('2026-09-07T11:15:00.000Z');

function group(overrides = {}) {
  return {
    id: 71,
    group_code: 'GRP2609070071',
    total_amount: 96000,
    payment_provider: 'payos',
    payment_status: 'unpaid',
    payment_profile_code: 'GROUP_CHECKOUT',
    payment_profile_version: 1,
    user_id: 8,
    cancel_token_hashes: [],
    child_orders: [{ order_id: 801 }, { order_id: 802 }],
    ...overrides,
  };
}

function creating(id = 801, overrides = {}) {
  return {
    id,
    status: 'creating',
    provider: 'payos',
    payment_profile_code: 'GROUP_CHECKOUT',
    payment_profile_version: 1,
    provider_order_code: 92345678901234,
    expires_at: expiry,
    ...overrides,
  };
}

function activeFrom(attempt, overrides = {}) {
  return {
    ...attempt,
    status: 'active',
    provider_payment_link_id: 'group-link-new',
    checkout_url: 'https://payos.test/group-new',
    qr_code: 'group-qr-new',
    ...overrides,
  };
}

function createHarness({
  reserveResults,
  lookup = async () => ({ kind: 'not_found' }),
  activate = async ({ attemptId }) => activeFrom(creating(attemptId)),
  findAttempts = async () => [],
  withCreationLock = async (_key, callback) => callback({ acquired: true }),
  loadedGroup = group(),
} = {}) {
  const calls = { reserve: [], lookup: [], create: [], activate: [], groupLookup: [] };
  const attemptsRepository = {
    async reserveOrRecoverCreatingAttempt(input) {
      calls.reserve.push(input);
      const next = reserveResults.shift();
      if (!next) throw new Error('unexpected reserve');
      return typeof next === 'function' ? next(input) : next;
    },
    async activateAttempt(input) {
      calls.activate.push(input);
      return activate(input);
    },
    findAttemptsByTarget: findAttempts,
  };
  const groupsRepository = {
    async findGroupByCode(groupCode) {
      calls.groupLookup.push(groupCode);
      return loadedGroup;
    },
  };
  const service = createGroupedPayOSAttemptService({
    attemptsRepository,
    groupsRepository,
    lookupPaymentLink: async (...args) => {
      calls.lookup.push(args);
      return lookup(...args);
    },
    createPaymentLink: async (input) => {
      calls.create.push(input);
      return { paymentLinkId: 'group-link-new', checkoutUrl: 'https://payos.test/group-new', qrCode: 'group-qr-new' };
    },
    withCreationLock,
    now: () => new Date('2026-09-07T11:00:00.000Z'),
    makeProviderOrderCode: () => 92345678901234,
  });
  return { service, calls };
}

describe('Grouped PayOS payment-attempt runtime', () => {
  it('creates and activates the first group QR only after a conclusive not-found lookup', async () => {
    const attempt = creating();
    const { service, calls } = createHarness({
      reserveResults: [{ kind: 'creating', attempt, recovered: false }, { kind: 'creating', attempt, recovered: true }],
    });

    const result = await service.createForGroup({ group: group() });
    assert.equal(calls.lookup.length, 1);
    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0].payosOrderCode, attempt.provider_order_code);
    assert.equal(calls.activate[0].attemptId, attempt.id);
    assert.equal(result.payment_link_id, 'group-link-new');
  });

  it('regenerates a group into a new attempt while retaining the legacy group response fields', async () => {
    const replacement = creating(802, { provider_order_code: 92345678901235 });
    const { service, calls } = createHarness({
      reserveResults: [{ kind: 'creating', attempt: replacement, recovered: false }, { kind: 'creating', attempt: replacement, recovered: true }],
    });

    const result = await service.regenerateForCustomer({ groupCode: 'GRP2609070071', userId: 8 });
    assert.equal(calls.reserve[0].forceRegenerate, true);
    assert.equal(calls.create.length, 1);
    assert.equal(result.group_code, 'GRP2609070071');
    assert.equal(result.payment_checkout_url, 'https://payos.test/group-new');
  });

  it('keeps the group current QR untouched when PayOS lookup is uncertain', async () => {
    const replacement = creating();
    const { service, calls } = createHarness({
      reserveResults: [{ kind: 'creating', attempt: replacement, recovered: false }, { kind: 'creating', attempt: replacement, recovered: true }],
      lookup: async () => ({ kind: 'unknown', reason: 'LOOKUP_UNCERTAIN' }),
    });

    await assert.rejects(() => service.createForGroup({ group: group() }), (error) => error.code === 'PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN');
    assert.equal(calls.create.length, 0);
    assert.equal(calls.activate.length, 0);
  });

  it('recovers an existing group creating attempt using its reserved code without another create', async () => {
    const attempt = creating();
    const { service, calls } = createHarness({
      reserveResults: [{ kind: 'creating', attempt, recovered: true }, { kind: 'creating', attempt, recovered: true }],
      lookup: async () => ({ kind: 'found', payment: { paymentLinkId: 'group-recovered', checkoutUrl: 'https://payos.test/recovered', qrCode: 'group-qr-recovered' } }),
      activate: async (input) => activeFrom(attempt, { provider_payment_link_id: input.paymentLinkId, checkout_url: input.checkoutUrl, qr_code: input.qrCode }),
    });

    const result = await service.createForGroup({ group: group() });
    assert.equal(calls.create.length, 0);
    assert.equal(result.payment_link_id, 'group-recovered');
  });

  it('allows one concurrent external group create and serves the old active QR to the contender', async () => {
    const attempt = creating();
    const oldActive = activeFrom(creating(800, { provider_order_code: 90000000000002 }), {
      provider_payment_link_id: 'group-old-link', checkout_url: 'https://payos.test/group-old', qr_code: 'group-qr-old',
    });
    let releaseFirst;
    const firstStarted = new Promise((resolve) => { releaseFirst = resolve; });
    let lockHeld = false;
    const withCreationLock = async (_key, callback) => {
      if (lockHeld) return { acquired: false };
      lockHeld = true;
      await firstStarted;
      try { return await callback({ acquired: true }); } finally { lockHeld = false; }
    };
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt, recovered: false },
        { kind: 'creating', attempt, recovered: true },
        { kind: 'creating', attempt, recovered: true },
      ],
      findAttempts: async () => [attempt, oldActive],
      withCreationLock,
    });

    const first = service.createForGroup({ group: group(), forceRegenerate: true });
    await new Promise((resolve) => setImmediate(resolve));
    const second = await service.createForGroup({ group: group(), forceRegenerate: true });
    releaseFirst();
    await first;
    assert.equal(second.payment_link_id, 'group-old-link');
    assert.equal(calls.create.length, 1);
  });

  it('returns conflict when the group is paid or cancelled during the external-call window', async () => {
    for (const paymentStatus of ['paid', 'cancelled']) {
      const attempt = creating();
      const { service, calls } = createHarness({
        reserveResults: [{ kind: 'creating', attempt, recovered: false }, { kind: 'creating', attempt, recovered: true }],
        activate: async () => ({ kind: 'target_closed', target: { payment_status: paymentStatus }, attempt: { ...attempt, status: 'superseded' } }),
      });
      await assert.rejects(() => service.createForGroup({ group: group() }), (error) => error.status === 409);
      assert.equal(calls.create.length, 1);
    }
  });

  it('does not create payment attempts for child orders and leaves allocation payload untouched', async () => {
    const childOrders = [{ order_id: 801, allocated_total: 45000 }, { order_id: 802, allocated_total: 51000 }];
    const { service, calls } = createHarness({ reserveResults: [], loadedGroup: group({ child_orders: childOrders }) });
    const paid = group({ payment_status: 'paid', child_orders: childOrders });
    await assert.rejects(() => service.createForGroup({ group: paid }));
    assert.equal(calls.reserve.length, 0);
    assert.deepEqual(childOrders, [{ order_id: 801, allocated_total: 45000 }, { order_id: 802, allocated_total: 51000 }]);
  });
});
