import postgresDb from '../../config/db-postgres.js';
import crypto from 'node:crypto';

const COOLDOWN_MS = 60_000; // 60s resend cooldown

/**
 * Normalize email to lowercase trimmed form
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Compute HMAC-SHA256 hex digest
 */
export function computeSecretHash(secret, pepper) {
  const key = pepper || process.env.EMAIL_TOKEN_PEPPER;
  if (!key) throw new Error('EMAIL_TOKEN_PEPPER is required');
  return crypto.createHmac('sha256', key).update(String(secret).trim()).digest('hex');
}

/**
 * Constant-time comparison of two strings (hex digests)
 */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate cryptographically secure 6-digit OTP
 */
export function generateSecureOtp() {
  let code;
  do {
    code = crypto.randomInt(100000, 1000000).toString();
  } while (code === '123456');
  return code;
}

/**
 * Generate cryptographically secure invitation token (48 hex chars)
 */
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate cryptographically secure recovery proof token (32 bytes = 64 hex chars)
 */
export function generateRecoveryToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function createAuthEmailChallengeRepository(database = postgresDb) {
  const getDb = (tx) => tx || database;

  return {
    /**
     * Create a new challenge. Returns the challenge record.
     */
    async createChallenge({ userId, email, purpose, secretHash, maxAttempts, ttlMinutes, metadata }, tx) {
      const runner = tx ? (fn) => fn(tx) : (fn) => database.transaction(fn);
      return runner(async (trx) => {
        // Advisory lock to serialize resend/creation per user+purpose
        const lockKey = `auth-challenge:${userId || 0}:${purpose}`;
        await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        const [rows] = await trx.query(
          `INSERT INTO auth_email_challenges
             (user_id, email, purpose, secret_hash, expires_at, max_attempts, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, user_id, email, purpose, expires_at, attempts, max_attempts,
                     sent_at, consumed_at, revoked_at, created_at, metadata`,
          [userId || null, normalizeEmail(email), purpose, secretHash, expiresAt, maxAttempts, metadata ? JSON.stringify(metadata) : null],
        );
        return rows[0];
      });
    },

    /**
     * Revoke all active (un-consumed, un-revoked) challenges for a user+purpose.
     * Returns count of revoked rows.
     */
    async revokeActiveChallenges({ userId, email, purpose }, tx) {
      const db = getDb(tx);
      const [_, count] = await db.query(
        `UPDATE auth_email_challenges
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE purpose = $1
           AND consumed_at IS NULL
           AND revoked_at IS NULL
           AND ($2::bigint IS NULL OR user_id = $2)
           AND ($3::varchar IS NULL OR email = $3)`,
        [purpose, userId || null, email ? normalizeEmail(email) : null],
      );
      return count;
    },

    /**
     * Mark a challenge as sent (called after successful email delivery).
     */
    async markSent(id, tx) {
      const db = getDb(tx);
      const [rows] = await db.query(
        `UPDATE auth_email_challenges
         SET sent_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND sent_at IS NULL
         RETURNING id, sent_at`,
        [id],
      );
      return rows[0] || null;
    },

    /**
     * Find the latest active (un-consumed, un-revoked, not expired) challenge
     * for a given user/email and purpose. Row-locked for verification.
     */
    async findLatestActive(userId, email, purpose, tx) {
      const db = getDb(tx);
      const [rows] = await db.query(
        `SELECT id, user_id, email, purpose, secret_hash, expires_at, attempts, max_attempts,
                sent_at, consumed_at, revoked_at, created_at, metadata
         FROM auth_email_challenges
         WHERE (user_id = $1 OR ($1::bigint IS NULL AND email = $2))
           AND purpose = $3
           AND consumed_at IS NULL
           AND revoked_at IS NULL
           AND sent_at IS NOT NULL
           AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [userId || null, normalizeEmail(email), purpose],
      );
      return rows[0] || null;
    },

    /**
     * Increment attempt counter atomically. Returns updated count.
     */
    async incrementAttempts(id, tx) {
      const db = getDb(tx);
      const [rows] = await db.query(
        `UPDATE auth_email_challenges
         SET attempts = attempts + 1
         WHERE id = $1
         RETURNING attempts`,
        [id],
      );
      return rows[0]?.attempts || 0;
    },

    /**
     * Mark challenge as consumed (one-time use).
     */
    async consume(id, tx) {
      const db = getDb(tx);
      const [_, count] = await db.query(
        `UPDATE auth_email_challenges
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND consumed_at IS NULL`,
        [id],
      );
      return count === 1;
    },

    /**
     * Revoke a specific challenge by id.
     */
    async revoke(id, tx) {
      const db = getDb(tx);
      const [_, count] = await db.query(
        `UPDATE auth_email_challenges
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND revoked_at IS NULL`,
        [id],
      );
      return count === 1;
    },

    /**
     * Create a phone proof challenge for password reset.
     * Revokes prior active phone proofs and reset OTPs for this user.
     */
    async createPhoneProofChallenge({ userId, email, secretHash, ttlMinutes = 5, maxAttempts = 5, metadata }, tx) {
      const runner = tx ? (fn) => fn(tx) : (fn) => database.transaction(fn);
      return runner(async (trx) => {
        const lockKey = `auth-challenge:${userId || 0}:PASSWORD_RESET_PHONE_PROOF`;
        await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

        // Revoke any existing active phone proofs and reset OTPs for this user
        await trx.query(
          `UPDATE auth_email_challenges
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1
             AND purpose IN ('PASSWORD_RESET_PHONE_PROOF', 'PASSWORD_RESET')
             AND consumed_at IS NULL
             AND revoked_at IS NULL`,
          [userId],
        );

        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        const [rows] = await trx.query(
          `INSERT INTO auth_email_challenges
             (user_id, email, purpose, secret_hash, expires_at, max_attempts, metadata)
           VALUES ($1, $2, 'PASSWORD_RESET_PHONE_PROOF', $3, $4, $5, $6)
           RETURNING id, user_id, email, purpose, expires_at, attempts, max_attempts,
                     sent_at, consumed_at, revoked_at, created_at, metadata`,
          [
            userId || null,
            normalizeEmail(email),
            secretHash,
            expiresAt,
            maxAttempts,
            metadata ? JSON.stringify(metadata) : JSON.stringify({ kind: 'password_reset_phone_proof' }),
          ],
        );
        return rows[0];
      });
    },

    /**
     * Find phone proof by secret hash (row-locked if inside tx)
     */
    async findPhoneProofByHash(secretHash, tx) {
      const db = getDb(tx);
      const [rows] = await db.query(
        `SELECT id, user_id, email, purpose, secret_hash, expires_at, attempts, max_attempts,
                sent_at, consumed_at, revoked_at, created_at, metadata
         FROM auth_email_challenges
         WHERE secret_hash = $1
           AND purpose = 'PASSWORD_RESET_PHONE_PROOF'
         ORDER BY created_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [secretHash],
      );
      return rows[0] || null;
    },
  };
}

export const authEmailChallengeRepository = createAuthEmailChallengeRepository();
export default authEmailChallengeRepository;
