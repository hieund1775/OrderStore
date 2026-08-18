import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '5000', 10);

const DEV_DEFAULT_SECRET = 'teaplus-dev-secret-change-me';
const PLACEHOLDER_SECRET = 'thay-bang-chuoi-bi-mat-dai-32-ky-tu';

/**
 * Validates environment variables fail-fast policy.
 * Shared between production startup and automated tests.
 *
 * @param {Object} envVars
 * @param {boolean} isProd
 * @returns {boolean}
 */
export function validateEnv(envVars = {}, isProd = false) {
  const rawJwtSecret = envVars.JWT_SECRET?.trim();

  if (isProd) {
    if (!rawJwtSecret || rawJwtSecret === DEV_DEFAULT_SECRET || rawJwtSecret === PLACEHOLDER_SECRET) {
      throw new Error('[FATAL] Production requires a secure, non-default JWT_SECRET environment variable.');
    }
    if (!envVars.FRONTEND_URL?.trim()) {
      throw new Error('[FATAL] Production requires FRONTEND_URL environment variable to be explicitly configured.');
    }
    if (!envVars.DATABASE_URL?.trim()) {
      throw new Error('[FATAL] Production requires DATABASE_URL environment variable.');
    }
  }

  // Check PayOS keys consistency
  const payosClientId = envVars.PAYOS_CLIENT_ID?.trim();
  const payosApiKey = envVars.PAYOS_API_KEY?.trim();
  const payosChecksumKey = envVars.PAYOS_CHECKSUM_KEY?.trim();
  const providedPayosCount = [payosClientId, payosApiKey, payosChecksumKey].filter(Boolean).length;

  if (providedPayosCount > 0 && providedPayosCount < 3) {
    throw new Error('[FATAL] Cấu hình PayOS không đầy đủ: Phải cung cấp đủ cả 3 biến PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY.');
  }

  if (isProd && envVars.PHONE_OTP_ENABLED === 'true') {
    if (envVars.SMS_PROVIDER !== 'generic_http') {
      throw new Error('[FATAL] PHONE_OTP_ENABLED requires SMS_PROVIDER=generic_http in production.');
    }
    if (!envVars.SMS_API_URL?.trim() || !envVars.SMS_API_KEY?.trim()) {
      throw new Error('[FATAL] Production phone OTP requires SMS_API_URL and SMS_API_KEY.');
    }
  }

  return true;
}

// ─── Execute Production Fail-Fast Validation ───
validateEnv(process.env, isProduction);

const rawJwtSecret = process.env.JWT_SECRET?.trim();
if (!isProduction && (!rawJwtSecret || rawJwtSecret === DEV_DEFAULT_SECRET || rawJwtSecret === PLACEHOLDER_SECRET)) {
  console.warn('⚠️ [DEV WARNING] JWT_SECRET đang dùng giá trị mặc định cho môi trường phát triển.');
}

const payosClientId = process.env.PAYOS_CLIENT_ID?.trim();
const payosApiKey = process.env.PAYOS_API_KEY?.trim();
const payosChecksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();

const JWT_SECRET = rawJwtSecret || DEV_DEFAULT_SECRET;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  env: NODE_ENV,
  isProduction,
  port: PORT,
  jwtSecret: JWT_SECRET,
  allowedOrigins,
  db: {
    server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    name: process.env.DB_NAME || 'teaplus_db',
    trusted: process.env.DB_TRUSTED === 'true',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
  },
  payos: {
    clientId: payosClientId || '',
    apiKey: payosApiKey || '',
    checksumKey: payosChecksumKey || '',
    returnUrl: process.env.PAYOS_RETURN_URL || 'http://localhost:8080/theo-doi-don',
    cancelUrl: process.env.PAYOS_CANCEL_URL || 'http://localhost:8080/thanh-toan',
    timeoutMinutes: parseInt(process.env.PAYOS_PAYMENT_TIMEOUT_MINUTES || '15', 10),
    isConfigured: Boolean(payosClientId && payosApiKey && payosChecksumKey),
  },
};

export { JWT_SECRET, isProduction, NODE_ENV, PORT, allowedOrigins };
export default config;
