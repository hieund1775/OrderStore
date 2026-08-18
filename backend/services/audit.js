import postgresDb from '../config/db-postgres.js';

/** Ghi audit log cho thao tác admin nhạy cảm — không làm fail thao tác chính. */
export async function logAudit(userId, action, detail, req) {
  try {
    await postgresDb.query(
      'INSERT INTO audit_logs (user_id, action, detail, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, detail || null, req?.ip || null, req?.headers?.['user-agent'] || null],
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
