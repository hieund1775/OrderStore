import crypto from 'node:crypto';
import config from '../config/env.js';

export class TableQrTokenError extends Error {
  constructor(message, status = 503, code = 'TABLE_QR_UNAVAILABLE') {
    super(message);
    this.name = 'TableQrTokenError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function resolvePepper() {
  const pepper = String(config.tableQrTokenPepper || '').trim();
  if (pepper) return pepper;
  if (!config.isProduction) return `dev-table-qr:${config.jwtSecret}`;
  throw new TableQrTokenError('Tính năng đặt món bằng mã QR bàn chưa được cấu hình an toàn');
}

export function createTableQrToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashTableQrToken(token) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(normalized)) {
    throw new TableQrTokenError('Mã QR bàn không hợp lệ', 400, 'TABLE_QR_INVALID_TOKEN');
  }
  return crypto.createHmac('sha256', resolvePepper()).update(normalized).digest('hex');
}

export function tableQrTokenConfigured() {
  return Boolean(String(config.tableQrTokenPepper || '').trim()) || !config.isProduction;
}
