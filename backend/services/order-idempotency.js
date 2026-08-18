import crypto from 'node:crypto';

function idempotencyError(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function hashOrderRequest(input) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
}

export async function claimOrderIdempotency(tx, { key, scope, requestHash }) {
  const [created] = await tx.query(
    `INSERT INTO idempotency_keys (idempotency_key, scope, request_hash, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [key, scope, requestHash],
  );
  if (created[0]) return { replay: false };
  const [rows] = await tx.query(
    `SELECT scope, request_hash, status, response_body
     FROM idempotency_keys WHERE idempotency_key = $1 FOR UPDATE`,
    [key],
  );
  const known = rows[0];
  if (!known) throw idempotencyError('Không thể xác nhận Idempotency-Key, vui lòng thử lại');
  if (known.scope !== scope || known.request_hash !== requestHash) {
    throw idempotencyError('Idempotency-Key đã được dùng cho yêu cầu khác');
  }
  if (known.status === 'completed' && known.response_body) return { replay: true, response: known.response_body };
  throw idempotencyError('Yêu cầu tạo đơn đang được xử lý, vui lòng thử lại');
}

export async function completeOrderIdempotency(tx, { key, responseStatus, response }) {
  await tx.query(
    `UPDATE idempotency_keys
     SET status = 'completed', response_status = $2, response_body = $3::jsonb
     WHERE idempotency_key = $1`,
    [key, responseStatus, JSON.stringify(response)],
  );
}
