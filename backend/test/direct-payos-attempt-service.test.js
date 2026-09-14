import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDirectPayOSAttemptService } from '../services/direct-payos-attempt.js';

const expiry = new Date('2026-09-07T10:15:00.000Z');

function order(overrides = {}) {
  return {
    id: 41,
    order_code: 'TP2609070041',
    total: 42000,
    payment_provider: 'payos',
    payment_status: 'unpaid',
    current_status: 'Chờ xác nhận',
    payment_profile_code: 'DIRECT_A',
    payment_profile_version: 2,
    checkout_group_id: null,
    ...overrides,
  };
}

function creating(id = 701, overrides = {}) {
  return {
    id,
    status: 'creating',
    provider: 'payos',
    payment_profile_code: 'DIRECT_A',
    payment_profile_version: 2,
    provider_order_code: 91234567890123,
    expires_at: expiry,
    ...overrides,
  };
}

function activeFrom(attempt, overrides = {}) {
  return {
    ...attempt,
    status: 'active',
    provider_payment_link_id: 'link-new',
    checkout_url: 'https://payos.test/new',
    qr_code: 'qr-new',
    ...overrides,
  };
}

function createHarness({
  reserveResults,
  lookup = async () => ({ kind: 'not_found' }),
  activate = async ({ attemptId }) => activeFrom(creating(attemptId)),
  findAttempts = async () => [],
  withCreationLock = async (_key, callback) => callback({ acquired: true }),
  reconcileOrder = async () => ({ outcome: 'skipped', changed: false, skipped: true }),
  directOrderForRegen = () => order({ user_id: 9, cancel_token_hash: null }),
  attemptById = () => null,
} = {}) {
  const calls = { reserve: [], lookup: [], create: [], activate: [], reconcile: [] };
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
    findDirectOrderForRegeneration: typeof directOrderForRegen === 'function' ? directOrderForRegen : async () => directOrderForRegen,
    findAttemptById: typeof attemptById === 'function' ? attemptById : async () => attemptById,
  };
  const service = createDirectPayOSAttemptService({
    attemptsRepository,
    lookupPaymentLink: async (...args) => {
      calls.lookup.push(args);
      return lookup(...args);
    },
    createPaymentLink: async (input) => {
      calls.create.push(input);
      return {
        paymentLinkId: 'link-new', checkoutUrl: 'https://payos.test/new', qrCode: 'qr-new', paymentExpiresAt: expiry,
      };
    },
    withCreationLock,
    now: () => new Date('2026-09-07T10:00:00.000Z'),
    makeProviderOrderCode: () => 91234567890123,
    reconcileOrder: async (input) => {
      calls.reconcile.push(input);
      return reconcileOrder(input);
    },
  });
  return { service, calls, attemptsRepository };
}

describe('Direct PayOS payment-attempt runtime', () => {
  it('creates and activates a first direct QR only after a conclusive PayOS not-found lookup', async () => {
    const attempt = creating();
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt, recovered: false },
        { kind: 'creating', attempt, recovered: true },
      ],
    });

    const result = await service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 } });

    assert.equal(calls.lookup.length, 1);
    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0].payosOrderCode, attempt.provider_order_code);
    assert.equal(calls.activate[0].attemptId, attempt.id);
    assert.equal(result.payment_link_id, 'link-new');
  });

  it('regenerates through a new attempt while retaining the legacy response shape', async () => {
    const replacement = creating(702, { provider_order_code: 91234567890124 });
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt: replacement, recovered: false },
        { kind: 'creating', attempt: replacement, recovered: true },
      ],
      reconcileOrder: async () => ({ outcome: 'terminal_unpaid', changed: false }),
    });

    const result = await service.regenerateForCustomer({ orderCode: 'TP2609070041', userId: 9 });

    assert.equal(calls.reserve[0].forceRegenerate, true);
    assert.equal(calls.create.length, 1);
    assert.equal(result.order_code, 'TP2609070041');
    assert.equal(result.payment_checkout_url, 'https://payos.test/new');
  });

  it('keeps a creating attempt for retry when PayOS lookup is uncertain and never calls create', async () => {
    const replacement = creating();
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt: replacement, recovered: false },
        { kind: 'creating', attempt: replacement, recovered: true },
      ],
      lookup: async () => ({ kind: 'unknown', reason: 'LOOKUP_UNCERTAIN' }),
    });

    await assert.rejects(
      () => service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 } }),
      (error) => error.code === 'PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN',
    );
    assert.equal(calls.create.length, 0);
    assert.equal(calls.activate.length, 0);
  });

  it('recovers an existing creating attempt by its reserved order code without creating another link', async () => {
    const attempt = creating();
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt, recovered: true },
        { kind: 'creating', attempt, recovered: true },
      ],
      lookup: async (providerOrderCode) => {
        assert.equal(providerOrderCode, attempt.provider_order_code);
        return { kind: 'found', payment: { paymentLinkId: 'recovered-link', checkoutUrl: 'https://payos.test/recovered', qrCode: 'qr-recovered' } };
      },
      activate: async (input) => activeFrom(attempt, {
        provider_payment_link_id: input.paymentLinkId,
        checkout_url: input.checkoutUrl,
        qr_code: input.qrCode,
      }),
    });

    const result = await service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 } });
    assert.equal(calls.create.length, 0);
    assert.equal(result.payment_link_id, 'recovered-link');
  });

  it('allows only one concurrent external create and returns the old active QR to the contender', async () => {
    const attempt = creating();
    const oldActive = activeFrom(creating(700, { provider_order_code: 90000000000001 }), {
      provider_payment_link_id: 'old-link', checkout_url: 'https://payos.test/old', qr_code: 'qr-old',
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

    const first = service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 }, forceRegenerate: true });
    await new Promise((resolve) => setImmediate(resolve));
    const second = await service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 }, forceRegenerate: true });
    releaseFirst();
    await first;

    assert.equal(second.payment_link_id, 'old-link');
    assert.equal(calls.create.length, 1);
  });

  it('returns conflict after a late old-QR payment and leaves the new attempt superseded', async () => {
    const attempt = creating();
    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt, recovered: false },
        { kind: 'creating', attempt, recovered: true },
      ],
      activate: async () => ({ kind: 'target_closed', target: { payment_status: 'paid' }, attempt: { ...attempt, status: 'superseded' } }),
    });

    await assert.rejects(
      () => service.createForOrder({ order: order(), paymentProfile: { code: 'DIRECT_A', version: 2 } }),
      (error) => error.code === 'PAYMENT_ATTEMPT_TARGET_PAID' && error.status === 409,
    );
    assert.equal(calls.create.length, 1);
  });

  it('rejects paid, cancelled, and grouped-child targets before reserving an attempt', async () => {
    for (const invalidOrder of [
      order({ payment_status: 'paid' }),
      order({ current_status: 'Đã hủy' }),
      order({ checkout_group_id: 88 }),
    ]) {
      const { service, calls } = createHarness({ reserveResults: [] });
      await assert.rejects(() => service.createForOrder({ order: invalidOrder, paymentProfile: { code: 'DIRECT_A' } }));
      assert.equal(calls.reserve.length, 0);
    }
  });

  it('regenerateForCustomer reuses still-active attempt if provider has not cancelled/expired it', async () => {
    const existingOrder = order({
      user_id: 15,
      payment_status: 'unpaid',
      current_payment_attempt_id: 705,
    });
    const activeAttempt = activeFrom(creating(705), {
      provider_payment_link_id: 'link-active-705',
      checkout_url: 'https://payos.test/active-705',
      qr_code: 'qr-active-705',
    });

    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'active', attempt: activeAttempt },
      ],
      directOrderForRegen: () => existingOrder,
      attemptById: () => activeAttempt,
      reconcileOrder: async () => ({ outcome: 'provider_pending', attempt: activeAttempt }),
    });

    const result = await service.regenerateForCustomer({
      orderCode: 'TP2609070041',
      userId: 15,
    });

    assert.equal(result.payment_link_id, 'link-active-705');
    assert.equal(calls.create.length, 0, 'must reuse active link without creating a replacement at provider');
  });

  it('regenerateForCustomer creates a new attempt when current attempt is expired', async () => {
    const existingOrder = order({
      user_id: 15,
      payment_status: 'expired',
      current_payment_attempt_id: 706,
    });
    const expiredAttempt = { ...creating(706), status: 'expired' };
    const newAttempt = creating(707);

    const { service, calls } = createHarness({
      reserveResults: [
        { kind: 'creating', attempt: newAttempt, recovered: false },
        { kind: 'creating', attempt: newAttempt, recovered: false },
      ],
      activate: async () => activeFrom(newAttempt),
      directOrderForRegen: () => existingOrder,
      attemptById: () => expiredAttempt,
      reconcileOrder: async () => ({ outcome: 'terminal_unpaid', attempt: expiredAttempt }),
    });

    const result = await service.regenerateForCustomer({
      orderCode: 'TP2609070041',
      userId: 15,
    });

    assert.equal(result.payos_order_code, 91234567890123);
    assert.equal(calls.create.length, 1, 'must create replacement attempt when current attempt was expired');
  });

  it('regenerateForCustomer rejects unauthorized callers before looking up or reconciling', async () => {
    const existingOrder = order({
      user_id: 15,
      cancel_token_hash: null,
    });

    const { service, calls } = createHarness({
      reserveResults: [],
      directOrderForRegen: () => existingOrder,
    });

    await assert.rejects(
      () => service.regenerateForCustomer({ orderCode: 'TP2609070041', userId: 999 }),
      (err) => err.status === 403,
    );
    assert.equal(calls.reserve.length, 0);
  });

  it('fails closed with PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN on provider timeout, 401, 403, 5xx, missing profile, unsupported SDK, or malformed payload', async () => {
    const existingOrder = order({
      user_id: 15,
      payment_status: 'unpaid',
      current_payment_attempt_id: 708,
    });
    const activeAttempt = activeFrom(creating(708));

    const uncertainCases = [
      { name: 'timeout', recon: { outcome: 'provider_uncertain', error: new Error('timeout') } },
      { name: '401', recon: { outcome: 'provider_uncertain', error: Object.assign(new Error('Unauthorized'), { status: 401 }) } },
      { name: '403', recon: { outcome: 'provider_uncertain', error: Object.assign(new Error('Forbidden'), { status: 403 }) } },
      { name: '5xx', recon: { outcome: 'provider_uncertain', error: Object.assign(new Error('Internal error'), { status: 500 }) } },
      { name: 'missing profile', recon: { outcome: 'provider_uncertain', reason: 'PROFILE_NOT_CONFIGURED' } },
      { name: 'unsupported SDK', recon: { outcome: 'provider_uncertain', reason: 'LOOKUP_UNSUPPORTED' } },
      { name: 'malformed/null payload', recon: { outcome: 'provider_uncertain' } },
    ];

    for (const testCase of uncertainCases) {
      const { service, calls } = createHarness({
        reserveResults: [],
        directOrderForRegen: () => existingOrder,
        attemptById: () => activeAttempt,
        reconcileOrder: async () => testCase.recon,
      });

      await assert.rejects(
        () => service.regenerateForCustomer({ orderCode: 'TP2609070041', userId: 15 }),
        (err) => err.code === 'PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN' && err.status === 502,
        `Expected PAYMENT_ATTEMPT_PROVIDER_UNCERTAIN for case: ${testCase.name}`,
      );

      assert.equal(calls.create.length, 0, `Must produce zero replacement calls for case: ${testCase.name}`);
      assert.equal(calls.activate.length, 0, `Must produce zero state mutation for case: ${testCase.name}`);
    }
  });
});
