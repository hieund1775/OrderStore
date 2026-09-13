import postgresDb from '../../config/db-postgres.js';
import { AuthError } from '../../services/staff/staff-service.js';

/**
 * Repository for persistent, durable rate limiting in PostgreSQL.
 * Used for phone-first authentication and password recovery to prevent DoS,
 * phone number enumeration, and OTP brute-forcing across server restarts and replicas.
 */
export function createAuthRateLimitRepository(database = postgresDb) {
  const getDb = (tx) => tx || database;

  return {
    /**
     * Atomically check rate limit and record attempt for a given key.
     *
     * @param {Object} options
     * @param {string} options.key - Unique rate limit key (e.g. `phone_verify:0901234567`)
     * @param {number} [options.maxAttempts=5] - Max allowed attempts in the sliding window
     * @param {number} [options.windowMs=900000] - Window duration in ms (default: 15 minutes)
     * @param {number} [options.cooldownMs=60000] - Minimum cooldown between requests in ms (default: 60 seconds)
     * @param {Object} [tx] - Optional transaction client
     * @throws {AuthError} 429 if rate limit exceeded or in cooldown
     */
    async checkAndIncrement({ key, maxAttempts = 5, windowMs = 15 * 60 * 1000, cooldownMs = 60 * 1000 }, tx) {
      const runner = tx ? (fn) => fn(tx) : (fn) => database.transaction(fn);
      return runner(async (trx) => {
        const lockKey = `rate-limit:${key}`;
        await trx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

        const [rows] = await trx.query(
          `SELECT rate_key, attempts, first_attempt_at, last_attempt_at, cooldown_until
           FROM auth_rate_limits
           WHERE rate_key = $1
           FOR UPDATE`,
          [key],
        );

        const now = Date.now();
        const record = rows[0];

        if (record) {
          const lastAttempt = new Date(record.last_attempt_at).getTime();
          const cooldownUntil = record.cooldown_until ? new Date(record.cooldown_until).getTime() : 0;

          // 1. Check if currently blocked under penalty cooldown
          if (cooldownUntil > now) {
            const remainingSec = Math.ceil((cooldownUntil - now) / 1000);
            const err = new AuthError(`Quá nhiều yêu cầu. Vui lòng thử lại sau ${remainingSec} giây`, 429, 'RATE_LIMITED');
            err.cooldown_seconds = remainingSec;
            throw err;
          }

          // 2. Check per-request cooldown (e.g. 60s)
          if (cooldownMs > 0 && (now - lastAttempt) < cooldownMs) {
            const waitSec = Math.ceil((cooldownMs - (now - lastAttempt)) / 1000);
            const err = new AuthError(`Vui lòng chờ ${waitSec} giây trước khi yêu cầu lại`, 429, 'OTP_RESEND_COOLDOWN');
            err.cooldown_seconds = waitSec;
            throw err;
          }

          // 3. Check sliding window expiry (reset counter if window has passed since first attempt)
          const firstAttempt = new Date(record.first_attempt_at).getTime();
          if (now - firstAttempt > windowMs) {
            await trx.query(
              `UPDATE auth_rate_limits
               SET attempts = 1, first_attempt_at = CURRENT_TIMESTAMP, last_attempt_at = CURRENT_TIMESTAMP, cooldown_until = NULL
               WHERE rate_key = $1`,
              [key],
            );
            return { attempts: 1, remaining: maxAttempts - 1 };
          }

          // 4. Check max attempts within window
          if (record.attempts >= maxAttempts) {
            const blockDurationMs = Math.max(windowMs - (now - firstAttempt), cooldownMs);
            const blockUntil = new Date(now + blockDurationMs);
            await trx.query(
              `UPDATE auth_rate_limits
               SET last_attempt_at = CURRENT_TIMESTAMP, cooldown_until = $2
               WHERE rate_key = $1`,
              [key, blockUntil],
            );
            const remainingSec = Math.ceil(blockDurationMs / 1000);
            const err = new AuthError(`Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau ${remainingSec} giây`, 429, 'RATE_LIMITED');
            err.cooldown_seconds = remainingSec;
            throw err;
          }

          // 5. Increment attempts counter
          const nextAttempts = record.attempts + 1;
          await trx.query(
            `UPDATE auth_rate_limits
             SET attempts = $2, last_attempt_at = CURRENT_TIMESTAMP
             WHERE rate_key = $1`,
            [key, nextAttempts],
          );
          return { attempts: nextAttempts, remaining: maxAttempts - nextAttempts };
        }

        // First attempt for this key
        await trx.query(
          `INSERT INTO auth_rate_limits (rate_key, attempts, first_attempt_at, last_attempt_at)
           VALUES ($1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [key],
        );
        return { attempts: 1, remaining: maxAttempts - 1 };
      });
    },

    /**
     * Reset rate limit state for a key (e.g. after successful auth/reset).
     */
    async reset(key, tx) {
      const db = getDb(tx);
      await db.query('DELETE FROM auth_rate_limits WHERE rate_key = $1', [key]);
    },
  };
}

export const authRateLimitRepository = createAuthRateLimitRepository();
export default authRateLimitRepository;
