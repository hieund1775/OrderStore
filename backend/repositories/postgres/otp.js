import postgresDb from '../../config/db-postgres.js';

const COOLDOWN_MS = 60_000;
const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

export function createOtpRepository(database = postgresDb) {
  return {
    async assertCanRequest(phone, now = new Date()) {
      return database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`otp:${phone}`]);
        const [rows] = await tx.query(
          `SELECT last_sent_at FROM otp_codes
           WHERE phone_normalized = $1
           ORDER BY last_sent_at DESC, id DESC LIMIT 1 FOR UPDATE`,
          [phone],
        );
        const lastSentAt = rows[0]?.last_sent_at ? new Date(rows[0].last_sent_at) : null;
        const elapsed = lastSentAt ? now.getTime() - lastSentAt.getTime() : COOLDOWN_MS;
        if (elapsed < COOLDOWN_MS) {
          const error = new Error(`Vui lòng chờ ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)} giây trước khi yêu cầu mã mới`);
          error.status = 429;
          throw error;
        }
      });
    },

    async createCode({ phone, codeHash, now = new Date() }) {
      return database.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`otp:${phone}`]);
        await tx.query(
          `UPDATE otp_codes SET consumed_at = COALESCE(consumed_at, $2)
           WHERE phone_normalized = $1 AND consumed_at IS NULL`,
          [phone, now],
        );
        const expiresAt = new Date(now.getTime() + TTL_MS);
        const [rows] = await tx.query(
          `INSERT INTO otp_codes (phone_normalized, code_hash, expires_at, last_sent_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id, expires_at, last_sent_at`,
          [phone, codeHash, expiresAt, now],
        );
        return rows[0];
      });
    },

    async verifyCode({ phone, codeHash, now = new Date() }) {
      return database.transaction(async (tx) => {
        const [rows] = await tx.query(
          `SELECT id, code_hash, attempt_count, expires_at, consumed_at
           FROM otp_codes WHERE phone_normalized = $1
           ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
          [phone],
        );
        const record = rows[0];
        if (!record) return { valid: false, error: 'Mã OTP chưa được gửi hoặc đã hết hạn' };
        if (record.consumed_at) return { valid: false, error: 'Mã OTP này đã được sử dụng. Vui lòng xin mã mới' };
        if (new Date(record.expires_at).getTime() <= now.getTime()) return { valid: false, error: 'Mã OTP đã hết hạn (quá 5 phút)' };
        if (record.attempt_count >= MAX_ATTEMPTS) return { valid: false, error: 'Đã thử sai quá 5 lần. Vui lòng xin mã mới' };

        if (record.code_hash !== codeHash) {
          await tx.query('UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1', [record.id]);
          return { valid: false, error: 'Mã OTP không chính xác' };
        }

        const [, affected] = await tx.query(
          'UPDATE otp_codes SET consumed_at = $2 WHERE id = $1 AND consumed_at IS NULL',
          [record.id, now],
        );
        return affected === 1
          ? { valid: true }
          : { valid: false, error: 'Mã OTP này đã được sử dụng. Vui lòng xin mã mới' };
      });
    },

    async cleanupExpired(now = new Date()) {
      const [, affected] = await database.query(
        'DELETE FROM otp_codes WHERE expires_at < $1 OR consumed_at IS NOT NULL',
        [now],
      );
      return affected;
    },
  };
}

export const otpRepository = createOtpRepository();
export default otpRepository;
