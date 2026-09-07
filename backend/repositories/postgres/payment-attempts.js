import postgresDb from '../../config/db-postgres.js';

export const PAYMENT_ATTEMPT_STATUSES = Object.freeze([
  'creating', 'active', 'expired', 'superseded', 'paid', 'failed',
]);

const OPEN_ATTEMPT_STATUSES = Object.freeze(['creating', 'active']);
const PAYMENT_ATTEMPT_TRANSITIONS = Object.freeze({
  creating: new Set(['active', 'expired', 'superseded', 'paid', 'failed']),
  active: new Set(['expired', 'superseded', 'paid', 'failed']),
  expired: new Set(['superseded', 'paid']),
  superseded: new Set(['paid']),
  paid: new Set(),
  failed: new Set(),
});

export class PaymentAttemptError extends Error {
  constructor(message, status = 409, code = 'PAYMENT_ATTEMPT_ERROR') {
    super(message);
    this.name = 'PaymentAttemptError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

export function isPaymentAttemptTransitionAllowed(fromStatus, toStatus) {
  return PAYMENT_ATTEMPT_TRANSITIONS[fromStatus]?.has(toStatus) === true;
}

function normalizeTarget({ orderId = null, checkoutGroupId = null } = {}) {
  const hasOrder = orderId != null;
  const hasGroup = checkoutGroupId != null;
  if (hasOrder === hasGroup) {
    throw new PaymentAttemptError('Payment attempt must target exactly one order or checkout group', 400, 'PAYMENT_ATTEMPT_TARGET_REQUIRED');
  }
  return hasOrder
    ? { type: 'order', id: Number(orderId) }
    : { type: 'checkout_group', id: Number(checkoutGroupId) };
}

function requireNonEmpty(value, code, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new PaymentAttemptError(`${label} is required`, 400, code);
  return normalized;
}

function requireFiniteAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new PaymentAttemptError('Payment attempt amount must be a non-negative number', 400, 'PAYMENT_ATTEMPT_AMOUNT_INVALID');
  }
  return amount;
}

function targetPredicate(target, columnPrefix = '') {
  const prefix = columnPrefix ? `${columnPrefix}.` : '';
  return target.type === 'order'
    ? { sql: `${prefix}order_id = $1`, params: [target.id] }
    : { sql: `${prefix}checkout_group_id = $1`, params: [target.id] };
}

async function inTransaction(database, externalTx, runner) {
  if (externalTx) return runner(externalTx);
  return database.transaction(runner);
}

async function lockTarget(tx, target) {
  if (target.type === 'order') {
    const [rows] = await tx.query(
      `SELECT id, order_code, total, payment_provider, payment_status, checkout_group_id,
              current_status, current_payment_attempt_id, payment_profile_code, payment_profile_version,
              user_id, cancel_token_hash, payment_link_id, payos_order_code,
              payment_checkout_url, payment_qr_code, payment_expires_at
       FROM orders WHERE id = $1 FOR UPDATE`,
      [target.id],
    );
    return rows[0] ? { ...rows[0], target_type: 'order' } : null;
  }

  const [rows] = await tx.query(
    `SELECT id, group_code AS order_code, total_amount AS total, payment_provider, payment_status,
            current_payment_attempt_id, payment_profile_code, payment_profile_version,
            payment_link_id, payos_order_code, payment_checkout_url, payment_qr_code, payment_expires_at
     FROM checkout_groups WHERE id = $1 FOR UPDATE`,
    [target.id],
  );
  return rows[0] ? { ...rows[0], target_type: 'checkout_group' } : null;
}

async function findAttemptForUpdate(tx, attemptId) {
  const [rows] = await tx.query('SELECT * FROM payment_attempts WHERE id = $1 FOR UPDATE', [Number(attemptId)]);
  return rows[0] || null;
}

async function findCreatingAttemptForUpdate(tx, target) {
  const predicate = targetPredicate(target);
  const [rows] = await tx.query(
    `SELECT * FROM payment_attempts
     WHERE ${predicate.sql} AND status = 'creating'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    predicate.params,
  );
  return rows[0] || null;
}

function targetFromAttempt(attempt) {
  return normalizeTarget({ orderId: attempt.order_id, checkoutGroupId: attempt.checkout_group_id });
}

function assertTargetCanCreate(target) {
  if (!target) throw new PaymentAttemptError('Payment target was not found', 404, 'PAYMENT_ATTEMPT_TARGET_NOT_FOUND');
  if (target.target_type === 'order' && target.checkout_group_id != null) {
    throw new PaymentAttemptError('Grouped child orders cannot own direct payment attempts', 409, 'GROUP_CHILD_DIRECT_ATTEMPT_FORBIDDEN');
  }
  if (target.payment_provider !== 'payos') {
    throw new PaymentAttemptError('Payment attempt target must use PayOS', 409, 'PAYMENT_ATTEMPT_WRONG_PROVIDER');
  }
  if (target.payment_status === 'paid') {
    throw new PaymentAttemptError('Paid targets cannot create another payment attempt', 409, 'PAYMENT_ATTEMPT_TARGET_PAID');
  }
  if (target.payment_status === 'cancelled' || target.current_status === 'Đã hủy') {
    throw new PaymentAttemptError('Cancelled targets cannot create another payment attempt', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
  }
}

function assertTargetAmount(target, amount) {
  if (Number(target.total) !== Number(amount)) {
    throw new PaymentAttemptError('Payment attempt amount does not match the locked target total', 409, 'PAYMENT_ATTEMPT_AMOUNT_MISMATCH');
  }
}

function assertTargetProfile(target, paymentProfileCode) {
  if (target.payment_profile_code && String(target.payment_profile_code) !== String(paymentProfileCode)) {
    throw new PaymentAttemptError('Payment profile must match the target profile snapshot', 409, 'PAYMENT_ATTEMPT_PROFILE_MISMATCH');
  }
}

function timestampsEqual(left, right) {
  if (left == null || right == null) return left == null && right == null;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

async function lockAndRejectSameProfileIdentity(tx, {
  provider, paymentProfileCode, providerOrderCode = null, paymentLinkId = null, exceptAttemptId = null,
}) {
  const identity = providerOrderCode != null ? `order:${providerOrderCode}` : `link:${paymentLinkId}`;
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`payment-attempt:${provider}:${paymentProfileCode}:${identity}`]);
  const params = [provider, paymentProfileCode, providerOrderCode, paymentLinkId];
  let exclusion = '';
  if (exceptAttemptId != null) {
    params.push(Number(exceptAttemptId));
    exclusion = ` AND id <> $${params.length}`;
  }
  const [rows] = await tx.query(
    `SELECT id FROM payment_attempts
     WHERE provider = $1 AND payment_profile_code = $2
       AND (($3::bigint IS NOT NULL AND provider_order_code = $3)
         OR ($4::varchar IS NOT NULL AND provider_payment_link_id = $4))${exclusion}
     FOR UPDATE`,
    params,
  );
  if (rows[0]) {
    throw new PaymentAttemptError('Provider identity is already reserved by another attempt on the same profile', 409, 'PAYMENT_ATTEMPT_PROVIDER_IDENTITY_COLLISION');
  }
}

async function setCurrentAttemptPointer(tx, target, attemptId) {
  if (target.type === 'order') {
    await tx.query(
      `UPDATE orders
       SET current_payment_attempt_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [target.id, attemptId],
    );
    return;
  }
  await tx.query(
    `UPDATE checkout_groups
     SET current_payment_attempt_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [target.id, attemptId],
  );
}

async function supersedeOpenAttempts(tx, target, exceptAttemptId = null) {
  const predicate = targetPredicate(target);
  const params = [...predicate.params];
  let exclusion = '';
  if (exceptAttemptId != null) {
    params.push(Number(exceptAttemptId));
    exclusion = ` AND id <> $${params.length}`;
  }
  const [rows] = await tx.query(
    `SELECT id FROM payment_attempts
     WHERE ${predicate.sql} AND status = ANY(ARRAY['creating', 'active']::varchar[])${exclusion}
     FOR UPDATE`,
    params,
  );
  if (!rows.length) return [];
  const ids = rows.map((row) => Number(row.id));
  const [superseded] = await tx.query(
    `UPDATE payment_attempts
     SET status = 'superseded', superseded_at = COALESCE(superseded_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($1::bigint[])
     RETURNING *`,
    [ids],
  );
  return superseded;
}

async function mirrorActiveAttemptToLegacyTarget(tx, target, attempt, {
  paymentStatus = 'unpaid', paidAt = null, currentAttemptId = attempt.id,
} = {}) {
  if (attempt.provider_order_code == null || !attempt.provider_payment_link_id || (!attempt.checkout_url && !attempt.qr_code)) {
    throw new PaymentAttemptError('Only an activated attempt with complete PayOS artifacts can mirror legacy columns', 409, 'PAYMENT_ATTEMPT_ARTIFACTS_INCOMPLETE');
  }

  if (target.type === 'order') {
    const [rows] = await tx.query(
      `UPDATE orders
       SET payment_provider = $2,
           payment_status = $3,
           payos_order_code = $4,
           payment_link_id = $5,
           payment_checkout_url = $6,
           payment_qr_code = $7,
           payment_created_at = COALESCE($8, payment_created_at, CURRENT_TIMESTAMP),
           payment_expires_at = $9,
           current_payment_attempt_id = $10,
           paid_at = CASE WHEN $3::varchar = 'paid' THEN COALESCE($11, paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND checkout_group_id IS NULL AND current_status IS DISTINCT FROM 'Đã hủy'
       RETURNING *`,
      [
        target.id, attempt.provider, paymentStatus, attempt.provider_order_code, attempt.provider_payment_link_id,
        attempt.checkout_url, attempt.qr_code, attempt.activated_at || attempt.created_at,
        attempt.expires_at, currentAttemptId, paidAt,
      ],
    );
    if (!rows[0]) throw new PaymentAttemptError('Target cannot accept a legacy payment mirror', 409, 'PAYMENT_ATTEMPT_MIRROR_REJECTED');
    return rows[0];
  }

  const [rows] = await tx.query(
    `UPDATE checkout_groups
     SET payment_provider = $2,
         payment_status = $3,
         payos_order_code = $4,
         payment_link_id = $5,
         payment_checkout_url = $6,
         payment_qr_code = $7,
         payment_created_at = COALESCE($8, payment_created_at, CURRENT_TIMESTAMP),
         payment_expires_at = $9,
         current_payment_attempt_id = $10,
         paid_at = CASE WHEN $3::varchar = 'paid' THEN COALESCE($11, paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_status <> 'cancelled'
     RETURNING *`,
    [
      target.id, attempt.provider, paymentStatus, attempt.provider_order_code, attempt.provider_payment_link_id,
      attempt.checkout_url, attempt.qr_code, attempt.activated_at || attempt.created_at,
      attempt.expires_at, currentAttemptId, paidAt,
    ],
  );
  if (!rows[0]) throw new PaymentAttemptError('Target cannot accept a legacy payment mirror', 409, 'PAYMENT_ATTEMPT_MIRROR_REJECTED');
  return rows[0];
}

async function markTargetPaid(tx, target, paidAt) {
  if (target.type === 'order') {
    const [rows] = await tx.query(
      `UPDATE orders
       SET payment_status = 'paid', paid_at = COALESCE($2, paid_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND current_status IS DISTINCT FROM 'Đã hủy'
       RETURNING *`,
      [target.id, paidAt || null],
    );
    if (!rows[0]) throw new PaymentAttemptError('Cancelled target cannot accept a late payment', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
    return rows[0];
  }
  const [rows] = await tx.query(
    `UPDATE checkout_groups
     SET payment_status = 'paid', paid_at = COALESCE($2, paid_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_status <> 'cancelled'
     RETURNING *`,
    [target.id, paidAt || null],
  );
  if (!rows[0]) throw new PaymentAttemptError('Cancelled target cannot accept a late payment', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
  return rows[0];
}

async function markTargetExpiredIfCurrent(tx, target, attempt) {
  if (Number(target.current_payment_attempt_id) !== Number(attempt.id)) return;
  if (target.type === 'order') {
    await tx.query(
      `UPDATE orders SET payment_status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND payment_status <> 'paid' AND current_status IS DISTINCT FROM 'Đã hủy'`,
      [target.id],
    );
    return;
  }
  await tx.query(
    `UPDATE checkout_groups SET payment_status = 'expired', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_status <> 'paid' AND payment_status <> 'cancelled'`,
    [target.id],
  );
}

function assertAttemptCanBecomePaid(attempt) {
  if (!isPaymentAttemptTransitionAllowed(attempt.status, 'paid')) {
    throw new PaymentAttemptError(`Cannot transition ${attempt.status} attempt to paid`, 409, 'PAYMENT_ATTEMPT_TRANSITION_INVALID');
  }
}

export function createPaymentAttemptsRepository(database = postgresDb) {
  return {
    async reserveOrRecoverCreatingAttempt({
      orderId = null,
      checkoutGroupId = null,
      provider = 'payos',
      paymentProfileCode,
      paymentProfileVersion = null,
      amount,
      providerOrderCode,
      expiresAt = null,
      forceRegenerate = false,
    }, { tx: externalTx } = {}) {
      const target = normalizeTarget({ orderId, checkoutGroupId });
      const normalizedProvider = requireNonEmpty(provider, 'PAYMENT_ATTEMPT_PROVIDER_REQUIRED', 'provider');
      const profileCode = requireNonEmpty(paymentProfileCode, 'PAYMENT_ATTEMPT_PROFILE_REQUIRED', 'paymentProfileCode');
      const reservedOrderCode = Number(providerOrderCode);
      if (!Number.isSafeInteger(reservedOrderCode) || reservedOrderCode <= 0) {
        throw new PaymentAttemptError('providerOrderCode must be a positive safe integer', 400, 'PAYMENT_ATTEMPT_PROVIDER_CODE_INVALID');
      }
      const normalizedAmount = requireFiniteAmount(amount);

      return inTransaction(database, externalTx, async (tx) => {
        const lockedTarget = await lockTarget(tx, target);
        assertTargetCanCreate(lockedTarget);
        assertTargetAmount(lockedTarget, normalizedAmount);
        assertTargetProfile(lockedTarget, profileCode);

        const creating = await findCreatingAttemptForUpdate(tx, target);
        if (creating) return { kind: 'creating', attempt: creating, recovered: true, target: lockedTarget };

        if (!forceRegenerate && lockedTarget.current_payment_attempt_id != null) {
          const current = await findAttemptForUpdate(tx, lockedTarget.current_payment_attempt_id);
          if (current?.status === 'active'
            && current.provider_payment_link_id
            && (current.checkout_url || current.qr_code)) {
            return { kind: 'active', attempt: current, recovered: true, target: lockedTarget };
          }
        }

        await lockAndRejectSameProfileIdentity(tx, {
          provider: normalizedProvider, paymentProfileCode: profileCode, providerOrderCode: reservedOrderCode,
        });
        const [rows] = await tx.query(
          `INSERT INTO payment_attempts (
             target_type, order_id, checkout_group_id, provider, payment_profile_code,
             payment_profile_version, amount, provider_order_code, status, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'creating', $9)
           RETURNING *`,
          [
            target.type, target.type === 'order' ? target.id : null,
            target.type === 'checkout_group' ? target.id : null,
            normalizedProvider, profileCode, paymentProfileVersion == null ? null : Number(paymentProfileVersion),
            normalizedAmount, reservedOrderCode, expiresAt,
          ],
        );
        const attempt = rows[0];
        // A creating attempt is deliberately not current. The prior active QR
        // stays usable until PayOS returns a new artifact and promotion commits.
        return { kind: 'creating', attempt, recovered: false, target: lockedTarget };
      });
    },

    // Compatibility wrapper for repository callers. It now follows the safe
    // reserve/recover semantics and never supersedes or moves the pointer early.
    async createCreatingAttempt(input, options = {}) {
      const result = await this.reserveOrRecoverCreatingAttempt({ ...input, forceRegenerate: true }, options);
      return result.attempt;
    },

    async findDirectOrderForRegeneration(orderCode, { tx: externalTx = null } = {}) {
      const normalizedCode = requireNonEmpty(orderCode, 'PAYMENT_ATTEMPT_ORDER_CODE_REQUIRED', 'orderCode');
      const runner = async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, order_code, user_id, cancel_token_hash, total, payment_provider,
                  payment_status, current_status, checkout_group_id,
                  payment_profile_code, payment_profile_version,
                  current_payment_attempt_id, payment_link_id, payos_order_code,
                  payment_checkout_url, payment_qr_code, payment_expires_at
           FROM orders
           WHERE order_code = $1`,
          [normalizedCode],
        );
        return rows[0] || null;
      };
      return inTransaction(database, externalTx, runner);
    },

    async findAttemptById(attemptId, { tx: externalTx = null, forUpdate = false } = {}) {
      const runner = async (tx) => {
        const [rows] = await tx.query(`SELECT * FROM payment_attempts WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [Number(attemptId)]);
        return rows[0] || null;
      };
      return inTransaction(database, externalTx, runner);
    },

    async findAttemptsByTarget({ orderId = null, checkoutGroupId = null, statuses = null } = {}, { tx: externalTx = null, forUpdate = false } = {}) {
      const target = normalizeTarget({ orderId, checkoutGroupId });
      const predicate = targetPredicate(target);
      const params = [...predicate.params];
      let statusClause = '';
      if (statuses?.length) {
        params.push(statuses);
        statusClause = ` AND status = ANY($${params.length}::varchar[])`;
      }
      const runner = async (tx) => {
        const [rows] = await tx.query(
          `SELECT * FROM payment_attempts WHERE ${predicate.sql}${statusClause}
           ORDER BY id DESC${forUpdate ? ' FOR UPDATE' : ''}`,
          params,
        );
        return rows;
      };
      return inTransaction(database, externalTx, runner);
    },

    async findActiveOrCreatingAttemptForTarget(targetInput, options = {}) {
      const rows = await this.findAttemptsByTarget(targetInput, {
        ...options,
        statuses: OPEN_ATTEMPT_STATUSES,
      });
      return rows[0] || null;
    },

    async findAttemptsByProviderIdentifiers({
      provider = 'payos', paymentProfileCode = null, providerOrderCode = null, paymentLinkId = null,
    } = {}, { tx: externalTx = null, forUpdate = false } = {}) {
      const normalizedProvider = requireNonEmpty(provider, 'PAYMENT_ATTEMPT_PROVIDER_REQUIRED', 'provider');
      if (providerOrderCode == null && !paymentLinkId) {
        throw new PaymentAttemptError('At least one provider identifier is required', 400, 'PAYMENT_ATTEMPT_IDENTIFIER_REQUIRED');
      }
      const params = [normalizedProvider];
      const clauses = ['provider = $1'];
      if (paymentProfileCode) {
        params.push(String(paymentProfileCode).trim());
        clauses.push(`payment_profile_code = $${params.length}`);
      }
      const identities = [];
      if (providerOrderCode != null) {
        params.push(Number(providerOrderCode));
        identities.push(`provider_order_code = $${params.length}`);
      }
      if (paymentLinkId) {
        params.push(String(paymentLinkId));
        identities.push(`provider_payment_link_id = $${params.length}`);
      }
      const runner = async (tx) => {
        const [rows] = await tx.query(
          `SELECT * FROM payment_attempts
           WHERE ${clauses.join(' AND ')} AND (${identities.join(' OR ')})
           ORDER BY id ASC${forUpdate ? ' FOR UPDATE' : ''}`,
          params,
        );
        return rows;
      };
      return inTransaction(database, externalTx, runner);
    },

    async activateAttempt({
      attemptId, providerOrderCode, paymentLinkId, checkoutUrl = null, qrCode = null, expiresAt = null,
    }, { tx: externalTx } = {}) {
      const linkId = requireNonEmpty(paymentLinkId, 'PAYMENT_ATTEMPT_LINK_REQUIRED', 'paymentLinkId');
      if (!checkoutUrl && !qrCode) {
        throw new PaymentAttemptError('PayOS activation requires checkoutUrl or qrCode', 400, 'PAYMENT_ATTEMPT_ARTIFACTS_INCOMPLETE');
      }
      return inTransaction(database, externalTx, async (tx) => {
        const existing = await this.findAttemptById(attemptId, { tx });
        if (!existing) throw new PaymentAttemptError('Payment attempt was not found', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
        const target = targetFromAttempt(existing);
        const lockedTarget = await lockTarget(tx, target);
        if (!lockedTarget) throw new PaymentAttemptError('Payment target was not found', 404, 'PAYMENT_ATTEMPT_TARGET_NOT_FOUND');
        if (lockedTarget.target_type === 'order' && lockedTarget.checkout_group_id != null) {
          throw new PaymentAttemptError('Grouped child orders cannot own direct payment attempts', 409, 'GROUP_CHILD_DIRECT_ATTEMPT_FORBIDDEN');
        }
        if (lockedTarget.payment_provider !== 'payos') {
          throw new PaymentAttemptError('Payment attempt target must use PayOS', 409, 'PAYMENT_ATTEMPT_WRONG_PROVIDER');
        }
        const attempt = await findAttemptForUpdate(tx, attemptId);
        const code = Number(providerOrderCode);
        if (!Number.isSafeInteger(code) || code <= 0 || code !== Number(attempt.provider_order_code)) {
          throw new PaymentAttemptError('Activation provider order code must match the reserved attempt code', 409, 'PAYMENT_ATTEMPT_PROVIDER_CODE_MISMATCH');
        }
        if (lockedTarget.payment_status === 'paid' || lockedTarget.payment_status === 'cancelled' || lockedTarget.current_status === 'Đã hủy') {
          let closedAttempt = attempt;
          if (isPaymentAttemptTransitionAllowed(attempt.status, 'superseded')) {
            const [rows] = await tx.query(
              `UPDATE payment_attempts
               SET status = 'superseded', superseded_at = COALESCE(superseded_at, CURRENT_TIMESTAMP),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1
               RETURNING *`,
              [attempt.id],
            );
            closedAttempt = rows[0];
          }
          return { kind: 'target_closed', attempt: closedAttempt, target: lockedTarget };
        }
        if (attempt.status === 'active') {
          const sameArtifacts = attempt.provider_payment_link_id === linkId
            && attempt.checkout_url === checkoutUrl && attempt.qr_code === qrCode
            && (expiresAt == null || timestampsEqual(attempt.expires_at, expiresAt));
          if (!sameArtifacts) {
            throw new PaymentAttemptError('Activated attempt artifacts are immutable', 409, 'PAYMENT_ATTEMPT_ARTIFACT_IMMUTABLE');
          }
          return attempt;
        }
        if (attempt.status !== 'creating') {
          throw new PaymentAttemptError(`Cannot activate ${attempt.status} attempt`, 409, 'PAYMENT_ATTEMPT_TRANSITION_INVALID');
        }
        await lockAndRejectSameProfileIdentity(tx, {
          provider: attempt.provider, paymentProfileCode: attempt.payment_profile_code,
          paymentLinkId: linkId, exceptAttemptId: attempt.id,
        });
        const [rows] = await tx.query(
          `UPDATE payment_attempts
           SET status = 'active', provider_payment_link_id = $2, checkout_url = $3, qr_code = $4,
               expires_at = COALESCE($5, expires_at), activated_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = 'creating'
           RETURNING *`,
          [attempt.id, linkId, checkoutUrl, qrCode, expiresAt],
        );
        const activated = rows[0];
        if (!activated) throw new PaymentAttemptError('Payment attempt activation was rejected', 409, 'PAYMENT_ATTEMPT_ACTIVATION_REJECTED');
        // The old QR remains current until the new PayOS artifact has been
        // persisted. All four steps commit atomically: activate -> mirror ->
        // supersede old open attempt(s) -> swap canonical current pointer.
        await mirrorActiveAttemptToLegacyTarget(tx, target, activated, {
          currentAttemptId: lockedTarget.current_payment_attempt_id,
        });
        await supersedeOpenAttempts(tx, target, activated.id);
        await setCurrentAttemptPointer(tx, target, activated.id);
        return activated;
      });
    },

    async markAttemptPaid({ attemptId, paidAt = null }, { tx: externalTx } = {}) {
      return inTransaction(database, externalTx, async (tx) => {
        const existing = await this.findAttemptById(attemptId, { tx });
        if (!existing) throw new PaymentAttemptError('Payment attempt was not found', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
        const target = targetFromAttempt(existing);
        const lockedTarget = await lockTarget(tx, target);
        if (!lockedTarget) throw new PaymentAttemptError('Payment target was not found', 404, 'PAYMENT_ATTEMPT_TARGET_NOT_FOUND');
        const attempt = await findAttemptForUpdate(tx, attemptId);
        if (attempt.status === 'paid') return attempt;
        assertAttemptCanBecomePaid(attempt);
        if (lockedTarget.payment_status === 'paid') {
          throw new PaymentAttemptError('Target was already paid by a different attempt', 409, 'PAYMENT_ATTEMPT_TARGET_ALREADY_PAID');
        }
        if (lockedTarget.payment_status === 'cancelled' || lockedTarget.current_status === 'Đã hủy') {
          throw new PaymentAttemptError('Cancelled target cannot accept a late payment', 409, 'PAYMENT_ATTEMPT_TARGET_CANCELLED');
        }
        await supersedeOpenAttempts(tx, target, attempt.id);
        const [rows] = await tx.query(
          `UPDATE payment_attempts
           SET status = 'paid', paid_at = COALESCE($2, paid_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [attempt.id, paidAt],
        );
        const paidAttempt = rows[0];
        await setCurrentAttemptPointer(tx, target, paidAttempt.id);
        if (paidAttempt.provider_payment_link_id && (paidAttempt.checkout_url || paidAttempt.qr_code)) {
          await mirrorActiveAttemptToLegacyTarget(tx, target, paidAttempt, { paymentStatus: 'paid', paidAt });
        } else {
          await markTargetPaid(tx, target, paidAt);
        }
        return paidAttempt;
      });
    },

    async expireAttempt({ attemptId, expiredAt = null }, { tx: externalTx } = {}) {
      return inTransaction(database, externalTx, async (tx) => {
        const existing = await this.findAttemptById(attemptId, { tx });
        if (!existing) throw new PaymentAttemptError('Payment attempt was not found', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
        const target = targetFromAttempt(existing);
        const lockedTarget = await lockTarget(tx, target);
        const attempt = await findAttemptForUpdate(tx, attemptId);
        if (attempt.status === 'expired') return attempt;
        if (!isPaymentAttemptTransitionAllowed(attempt.status, 'expired')) {
          throw new PaymentAttemptError(`Cannot transition ${attempt.status} attempt to expired`, 409, 'PAYMENT_ATTEMPT_TRANSITION_INVALID');
        }
        const [rows] = await tx.query(
          `UPDATE payment_attempts
           SET status = 'expired', expired_at = COALESCE($2, expired_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [attempt.id, expiredAt],
        );
        await markTargetExpiredIfCurrent(tx, target, rows[0]);
        return rows[0];
      });
    },

    async failAttempt({ attemptId, failureCode }, { tx: externalTx } = {}) {
      const code = requireNonEmpty(failureCode, 'PAYMENT_ATTEMPT_FAILURE_CODE_REQUIRED', 'failureCode');
      return inTransaction(database, externalTx, async (tx) => {
        const existing = await this.findAttemptById(attemptId, { tx });
        if (!existing) throw new PaymentAttemptError('Payment attempt was not found', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
        const target = targetFromAttempt(existing);
        const lockedTarget = await lockTarget(tx, target);
        const attempt = await findAttemptForUpdate(tx, attemptId);
        if (!isPaymentAttemptTransitionAllowed(attempt.status, 'failed')) {
          throw new PaymentAttemptError(`Cannot transition ${attempt.status} attempt to failed`, 409, 'PAYMENT_ATTEMPT_TRANSITION_INVALID');
        }
        const [rows] = await tx.query(
          `UPDATE payment_attempts
           SET status = 'failed', failure_code = $2, failed_at = COALESCE(failed_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [attempt.id, code],
        );
        if (Number(lockedTarget.current_payment_attempt_id) === Number(attempt.id)) {
          await setCurrentAttemptPointer(tx, target, null);
        }
        return rows[0];
      });
    },

    async supersedeAttempt({ attemptId, replacementAttemptId = null }, { tx: externalTx } = {}) {
      return inTransaction(database, externalTx, async (tx) => {
        const existing = await this.findAttemptById(attemptId, { tx });
        if (!existing) throw new PaymentAttemptError('Payment attempt was not found', 404, 'PAYMENT_ATTEMPT_NOT_FOUND');
        const target = targetFromAttempt(existing);
        const lockedTarget = await lockTarget(tx, target);
        const attempt = await findAttemptForUpdate(tx, attemptId);
        if (!isPaymentAttemptTransitionAllowed(attempt.status, 'superseded')) {
          throw new PaymentAttemptError(`Cannot transition ${attempt.status} attempt to superseded`, 409, 'PAYMENT_ATTEMPT_TRANSITION_INVALID');
        }
        let replacement = null;
        if (replacementAttemptId != null) {
          replacement = await findAttemptForUpdate(tx, replacementAttemptId);
          if (!replacement || replacement.target_type !== attempt.target_type
            || Number(replacement.order_id || 0) !== Number(attempt.order_id || 0)
            || Number(replacement.checkout_group_id || 0) !== Number(attempt.checkout_group_id || 0)
            || !OPEN_ATTEMPT_STATUSES.includes(replacement.status)) {
            throw new PaymentAttemptError('Superseding replacement must be an open attempt on the same target', 409, 'PAYMENT_ATTEMPT_REPLACEMENT_INVALID');
          }
        }
        const [rows] = await tx.query(
          `UPDATE payment_attempts
           SET status = 'superseded', superseded_at = COALESCE(superseded_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [attempt.id],
        );
        if (Number(lockedTarget.current_payment_attempt_id) === Number(attempt.id)) {
          await setCurrentAttemptPointer(tx, target, replacement?.id || null);
        }
        return rows[0];
      });
    },
  };
}

export const paymentAttemptsRepository = createPaymentAttemptsRepository();
export default paymentAttemptsRepository;
