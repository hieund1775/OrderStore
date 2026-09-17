import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSandboxPaymentAttemptService } from '../services/sandbox-payment-attempt.js';

describe('Sandbox Payment Attempt Service', () => {
  const originalEnv = { ...process.env };
  const immediateLock = async (_key, callback) => callback({ acquired: true });

  beforeEach(() => {
    process.env.PAYMENT_MODE = 'qa_sandbox';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createMockPayOSThrower() {
    return new Proxy({}, {
      get() {
        return () => {
          throw new Error('FATAL: Outbound PayOS call occurred during sandbox execution!');
        };
      },
    });
  }

  it('creates and activates a sandbox attempt for direct order without calling PayOS', async () => {
    const payosThrower = createMockPayOSThrower();
    const order = {
      id: 10,
      order_code: 'TP2609171000',
      total: 50000,
      user_id: 1,
    };

    let reservedData = null;
    let activatedData = null;

    const mockAttemptsRepo = {
      reserveOrRecoverCreatingAttempt: async (params) => {
        reservedData = params;
        return {
          kind: 'creating',
          attempt: {
            id: 777,
            provider: params.provider,
            provider_order_code: params.providerOrderCode,
            amount: params.amount,
            status: 'creating',
            expires_at: params.expiresAt,
          },
          recovered: false,
        };
      },
      activateAttempt: async (params) => {
        activatedData = params;
        return {
          id: params.attemptId,
          provider: 'sandbox',
          provider_order_code: params.providerOrderCode,
          provider_payment_link_id: params.paymentLinkId,
          checkout_url: params.checkoutUrl,
          qr_code: params.qrCode,
          expires_at: params.expiresAt,
          status: 'active',
        };
      },
    };

    const service = createSandboxPaymentAttemptService({
      attemptsRepository: mockAttemptsRepo,
      withCreationLock: immediateLock,
    });

    const result = await service.createForOrder({ order });

    assert.equal(reservedData.provider, 'sandbox');
    assert.equal(reservedData.amount, 50000);
    assert.equal(Number.isSafeInteger(reservedData.providerOrderCode), true);

    assert.equal(result.payment_provider, 'sandbox');
    assert.equal(result.payment_status, 'unpaid');
    assert.match(result.payment_checkout_url, /^\/thanh-toan\/sandbox\?token=[a-f0-9]{64}$/);

    // Verify token hash is stored in link ID
    const url = new URL(result.payment_checkout_url, 'http://localhost');
    const rawToken = url.searchParams.get('token');
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.equal(activatedData.paymentLinkId, expectedHash);
  });

  it('reuses active attempt URL and token on recovery without generating new token', async () => {
    const order = { id: 20, order_code: 'TP2609172000', total: 60000 };
    const originalToken = 'a'.repeat(64);
    const originalHash = crypto.createHash('sha256').update(originalToken).digest('hex');
    const originalUrl = `/thanh-toan/sandbox?token=${originalToken}`;

    const mockAttemptsRepo = {
      reserveOrRecoverCreatingAttempt: async () => ({
        kind: 'active',
        attempt: {
          id: 888,
          provider: 'sandbox',
          provider_order_code: 998877,
          provider_payment_link_id: originalHash,
          checkout_url: originalUrl,
          qr_code: null,
          status: 'active',
          expires_at: new Date(Date.now() + 600_000),
        },
        recovered: true,
      }),
    };

    const service = createSandboxPaymentAttemptService({
      attemptsRepository: mockAttemptsRepo,
    });

    const result = await service.createForOrder({ order });
    assert.equal(result.payment_checkout_url, originalUrl);
    assert.equal(result.payment_link_id, originalHash);
  });

  it('serializes concurrent direct sandbox creation and returns one canonical token', async () => {
    const order = { id: 21, order_code: 'TP2609172100', total: 61000 };
    let creating = null;
    let active = null;
    let activateCalls = 0;
    let lockTail = Promise.resolve();

    const serializedLock = async (_key, callback) => {
      const previous = lockTail;
      let release;
      lockTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback({ acquired: true });
      } finally {
        release();
      }
    };

    const attemptsRepository = {
      async reserveOrRecoverCreatingAttempt(params) {
        if (active) return { kind: 'active', attempt: active };
        if (creating) return { kind: 'creating', attempt: creating, recovered: true };
        creating = {
          id: 991,
          provider: 'sandbox',
          provider_order_code: params.providerOrderCode,
          amount: params.amount,
          status: 'creating',
          expires_at: params.expiresAt,
        };
        return { kind: 'creating', attempt: creating, recovered: false };
      },
      async activateAttempt(params) {
        activateCalls += 1;
        active = {
          ...creating,
          status: 'active',
          provider_payment_link_id: params.paymentLinkId,
          checkout_url: params.checkoutUrl,
          qr_code: null,
        };
        return active;
      },
      async findAttemptsByTarget() {
        return active ? [active] : [];
      },
    };

    const service = createSandboxPaymentAttemptService({ attemptsRepository, withCreationLock: serializedLock });
    const [first, second] = await Promise.all([
      service.createForOrder({ order }),
      service.createForOrder({ order }),
    ]);

    assert.equal(activateCalls, 1);
    assert.equal(first.payment_checkout_url, second.payment_checkout_url);
    assert.match(first.payment_checkout_url, /^\/thanh-toan\/sandbox\?token=[a-f0-9]{64}$/);
  });

  it('serializes concurrent group sandbox creation and returns one canonical token', async () => {
    const group = { id: 22, group_code: 'GRP2609172200', total_amount: 62000 };
    let creating = null;
    let active = null;
    let activateCalls = 0;
    let lockTail = Promise.resolve();
    const serializedLock = async (_key, callback) => {
      const previous = lockTail;
      let release;
      lockTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback({ acquired: true });
      } finally {
        release();
      }
    };
    const attemptsRepository = {
      async reserveOrRecoverCreatingAttempt(params) {
        if (active) return { kind: 'active', attempt: active };
        if (creating) return { kind: 'creating', attempt: creating, recovered: true };
        creating = {
          id: 992,
          provider: 'sandbox',
          provider_order_code: params.providerOrderCode,
          amount: params.amount,
          status: 'creating',
          expires_at: params.expiresAt,
        };
        return { kind: 'creating', attempt: creating, recovered: false };
      },
      async activateAttempt(params) {
        activateCalls += 1;
        active = {
          ...creating,
          status: 'active',
          provider_payment_link_id: params.paymentLinkId,
          checkout_url: params.checkoutUrl,
          qr_code: null,
        };
        return active;
      },
      async findAttemptsByTarget() {
        return active ? [active] : [];
      },
    };

    const service = createSandboxPaymentAttemptService({ attemptsRepository, withCreationLock: serializedLock });
    const [first, second] = await Promise.all([
      service.createForGroup({ group }),
      service.createForGroup({ group }),
    ]);

    assert.equal(activateCalls, 1);
    assert.equal(first.payment_checkout_url, second.payment_checkout_url);
  });

  it('waits briefly for the canonical token when another instance holds the creation lock', async () => {
    const order = { id: 23, order_code: 'TP2609172300', total: 63000 };
    const active = {
      id: 993,
      provider: 'sandbox',
      provider_order_code: 993001,
      provider_payment_link_id: 'token-hash',
      checkout_url: '/thanh-toan/sandbox?token=canonical',
      status: 'active',
      expires_at: new Date(Date.now() + 600_000),
    };
    let reads = 0;
    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        reserveOrRecoverCreatingAttempt: async () => ({
          kind: 'creating',
          attempt: { id: 994, provider: 'sandbox', provider_order_code: 994001, status: 'creating' },
          recovered: true,
        }),
        findAttemptsByTarget: async () => {
          reads += 1;
          return reads >= 2 ? [active] : [];
        },
      },
      withCreationLock: async () => ({ acquired: false }),
    });

    const result = await service.createForOrder({ order });
    assert.equal(result.payment_checkout_url, active.checkout_url);
    assert.ok(reads >= 2);
  });

  it('enforces exact amount matching without rounding', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const attempt = {
      id: 999,
      target_type: 'order',
      order_id: 30,
      provider: 'sandbox',
      provider_payment_link_id: tokenHash,
      amount: 50000,
      status: 'active',
      expires_at: new Date(Date.now() + 600_000),
    };

    const order = {
      id: 30,
      order_code: 'TP2609173000',
      user_id: 5,
      total: 50000,
      payment_status: 'unpaid',
    };

    let settlementCalled = false;
    const mockRepo = {
      findAttemptsByProviderIdentifiers: async () => [attempt],
      findDirectOrderById: async () => order,
    };
    const mockSettle = async () => {
      settlementCalled = true;
      return { kind: 'paid' };
    };

    const service = createSandboxPaymentAttemptService({
      attemptsRepository: mockRepo,
      settleAttemptEvent: mockSettle,
    });

    // 1. Underpay (49999) -> rejects
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 49999, userId: 5 }),
      (err) => err.status === 400 && err.code === 'AMOUNT_MISMATCH'
    );
    assert.equal(settlementCalled, false);

    // 2. Overpay (50001) -> rejects
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 50001, userId: 5 }),
      (err) => err.status === 400 && err.code === 'AMOUNT_MISMATCH'
    );
    assert.equal(settlementCalled, false);

    // 3. Float amount near target (49999.6) -> must reject with INVALID_AMOUNT without Math.round
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 49999.6, userId: 5 }),
      (err) => err.status === 400 && err.code === 'INVALID_AMOUNT'
    );
    assert.equal(settlementCalled, false);

    // 4. Negative, 0, or NaN
    await assert.rejects(() => service.transferExactAmount({ rawToken, amount: -50000, userId: 5 }));
    await assert.rejects(() => service.transferExactAmount({ rawToken, amount: 0, userId: 5 }));
    await assert.rejects(() => service.transferExactAmount({ rawToken, amount: 'abc', userId: 5 }));
    assert.equal(settlementCalled, false);

    // 5. Exact match (50000) -> succeeds
    const success = await service.transferExactAmount({ rawToken, amount: 50000, userId: 5 });
    assert.equal(success.ok, true);
    assert.equal(success.kind, 'paid');
    assert.equal(settlementCalled, true);
  });

  it('does not expose a previous PayOS URL from sandbox status lookup', async () => {
    const order = {
      id: 31,
      order_code: 'TP2609173100',
      user_id: 5,
      total: 50000,
      payment_provider: 'payos',
      payment_status: 'unpaid',
      payment_checkout_url: 'https://payos.example/real-link',
      current_payment_attempt_id: 313,
      current_status: 'Chờ xác nhận',
    };
    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        findDirectOrderForRegeneration: async () => order,
        findAttemptById: async () => ({
          id: 313,
          provider: 'payos',
          status: 'active',
          checkout_url: 'https://payos.example/real-link',
        }),
      },
    });

    const status = await service.getStatus({ code: order.order_code, userId: 5 });
    assert.equal(status.payment_provider, null);
    assert.equal(status.payment_checkout_url, null);
    assert.equal(status.payment_qr_code, null);
    assert.equal(status.can_regenerate_qr, true);
  });

  it('enforces customer authentication and cross-user ownership', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const attempt = {
      id: 111,
      target_type: 'order',
      order_id: 40,
      provider: 'sandbox',
      amount: 30000,
      status: 'active',
      expires_at: new Date(Date.now() + 600_000),
    };
    const order = {
      id: 40,
      order_code: 'TP2609174000',
      user_id: 10,
      total: 30000,
      payment_status: 'unpaid',
    };

    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [attempt],
        findDirectOrderById: async () => order,
      },
    });

    // Unauthenticated -> 401
    await assert.rejects(
      () => service.findSessionByToken(rawToken, { userId: null }),
      (err) => err.status === 401 && err.code === 'CUSTOMER_AUTH_REQUIRED'
    );
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 30000, userId: null }),
      (err) => err.status === 401 && err.code === 'CUSTOMER_AUTH_REQUIRED'
    );

    // Wrong user -> 403
    await assert.rejects(
      () => service.findSessionByToken(rawToken, { userId: 999 }),
      (err) => err.status === 403
    );
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 30000, userId: 999 }),
      (err) => err.status === 403
    );

    // Correct user -> succeeds
    const session = await service.findSessionByToken(rawToken, { userId: 10 });
    assert.equal(session.ok, true);
    assert.equal(session.amount, 30000);
    assert.equal(session.order_code, 'TP2609174000');
  });

  it('supports checkout group with verifyGroupOwnership enforcement', async () => {
    const rawToken = 'd'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const attempt = {
      id: 222,
      target_type: 'checkout_group',
      checkout_group_id: 50,
      provider: 'sandbox',
      amount: 120000,
      status: 'active',
      expires_at: new Date(Date.now() + 600_000),
    };
    const group = {
      id: 50,
      group_code: 'GRP2609175000',
      user_id: 15,
      total_amount: 120000,
      payment_status: 'unpaid',
      cancel_token_hashes: [],
    };

    let settlementCalled = false;
    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [attempt],
      },
      checkoutGroupsRepo: {
        findGroupById: async () => group,
      },
      settleAttemptEvent: async (params) => {
        settlementCalled = true;
        assert.equal(params.amount, 120000);
        assert.equal(params.provider, 'sandbox');
        return { kind: 'paid' };
      },
    });

    // Wrong user rejected
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 120000, userId: 999 }),
      (err) => err.status === 403
    );

    // Correct user succeeds
    const result = await service.transferExactAmount({ rawToken, amount: 120000, userId: 15 });
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'paid');
    assert.equal(settlementCalled, true);
  });

  it('rejects expired, superseded or cancelled attempts', async () => {
    const rawToken = 'e'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const makeAttempt = (status, expiresAt = new Date(Date.now() + 600_000)) => ({
      id: 333,
      target_type: 'order',
      order_id: 60,
      provider: 'sandbox',
      amount: 40000,
      status,
      expires_at: expiresAt,
    });

    const order = { id: 60, order_code: 'TP2609176000', user_id: 20, total: 40000 };

    let currentStatus = 'expired';
    let currentExpiry = new Date(Date.now() + 600_000);
    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [makeAttempt(currentStatus, currentExpiry)],
        findDirectOrderById: async () => order,
        expireAttempt: async () => ({ status: 'expired' }),
      },
    });

    // 1. Status already 'expired'
    currentStatus = 'expired';
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 40000, userId: 20 }),
      (err) => err.status === 409 && err.code === 'SANDBOX_ATTEMPT_EXPIRED'
    );

    // 2. Status 'superseded'
    currentStatus = 'superseded';
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 40000, userId: 20 }),
      (err) => err.status === 409 && err.code === 'SANDBOX_ATTEMPT_SUPERSEDED'
    );

    // 3. Status 'active' but past expires_at
    currentStatus = 'active';
    currentExpiry = new Date(Date.now() - 1000);
    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 40000, userId: 20 }),
      (err) => err.status === 409 && err.code === 'SANDBOX_ATTEMPT_EXPIRED'
    );
  });

  it('treats double-submit as idempotent success without error', async () => {
    const rawToken = 'f'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const attempt = {
      id: 444,
      target_type: 'order',
      order_id: 70,
      provider: 'sandbox',
      amount: 35000,
      status: 'paid', // already paid
      expires_at: new Date(Date.now() + 600_000),
    };
    const order = { id: 70, order_code: 'TP2609177000', user_id: 25, total: 35000, payment_status: 'paid' };

    const service = createSandboxPaymentAttemptService({
      attemptsRepository: {
        findAttemptsByProviderIdentifiers: async () => [attempt],
        findDirectOrderById: async () => order,
      },
    });

    const result = await service.transferExactAmount({ rawToken, amount: 35000, userId: 25 });
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'already_paid');

    await assert.rejects(
      () => service.transferExactAmount({ rawToken, amount: 1, userId: 25 }),
      (err) => err.status === 400 && err.code === 'AMOUNT_MISMATCH',
    );
  });
});
