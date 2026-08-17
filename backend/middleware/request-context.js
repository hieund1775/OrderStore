import crypto from 'node:crypto';

/**
 * Request Context Middleware
 * Generates a unique request ID, records start time, and attaches context to req.
 */
export function requestContext(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.length <= 64)
    ? incomingId
    : crypto.randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);
  next();
}

/**
 * Sanitizes an object by masking sensitive keys (passwords, tokens, secrets, OTPs)
 */
export function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitiveKeys = /password|secret|token|otp|authorization|credential|api_key|checksum/i;
  const copy = Array.isArray(obj) ? [] : {};

  for (const [k, v] of Object.entries(obj)) {
    if (sensitiveKeys.test(k)) {
      copy[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      copy[k] = redactSensitive(v);
    } else {
      copy[k] = v;
    }
  }
  return copy;
}
