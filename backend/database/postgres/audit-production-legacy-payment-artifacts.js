import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../../config/postgres-production-migration-guard.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = '0026_payment_attempts_legacy_blocker_audit_readonly.sql';
const AUDIT_LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext('teaplus_postgres_migrations')) AS acquired";
const AUDIT_UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('teaplus_postgres_migrations'))";

function sanitizeErrorMessage(error) {
  return String(error?.message || error || 'Unknown production audit error')
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s'"`]+/gi, '[redacted-postgres-url]')
    .replace(/\b(?:user(?:name)?|password|token|api[_-]?key)=([^\s&]+)/gi, (matched) => matched.replace(/=.*/, '=[redacted]'));
}

export function parseProductionLegacyAuditArgs(args = []) {
  if (args.length !== 1 || args[0] !== '--audit=0026-legacy') {
    throw new Error('PRODUCTION LEGACY AUDIT: only --audit=0026-legacy is supported.');
  }
  return { audit: '0026-legacy' };
}

export async function readProductionLegacyAuditSql() {
  return fs.readFile(path.join(__dirname, 'verification', AUDIT_FILE), 'utf8');
}

/**
 * Runs a guarded aggregate-only legacy audit. This never starts a transaction,
 * runs migration SQL, or executes a data mutation.
 */
export async function runProductionLegacyPaymentArtifactAudit({
  args = process.argv.slice(2),
  env = process.env,
  pool = null,
  createPool = (config) => new Pool(config),
  logger = console,
} = {}) {
  let activePool = null;
  let client = null;
  let lockHeld = false;

  try {
    const options = parseProductionLegacyAuditArgs(args);
    const target = validatePostgresProductionMigrationGuard(env.PRODUCTION_DATABASE_URL, {
      env: env.NODE_ENV,
      mode: env.MIGRATION_MODE,
      confirmFlag: env.POSTGRES_PRODUCTION_MIGRATIONS,
      allowedHosts: env.POSTGRES_PRODUCTION_ALLOWED_HOSTS,
      allowedDatabases: env.POSTGRES_PRODUCTION_ALLOWED_DATABASES,
      testDatabaseUrl: env.TEST_DATABASE_URL,
      testConfirmFlag: env.POSTGRES_INTEGRATION,
    });

    logger.log(`[Production Legacy Audit] Target: ${describeProductionMigrationTarget(target)}`);
    logger.log('[Production Legacy Audit] Guard passed.');
    activePool = pool || createPool(getPostgresPoolConfig(env.PRODUCTION_DATABASE_URL, { env }));
    client = await activePool.connect();

    const lock = await client.query(AUDIT_LOCK_SQL);
    lockHeld = lock.rows[0]?.acquired === true;
    if (!lockHeld) throw new Error('PRODUCTION LEGACY AUDIT: migration advisory lock is currently held.');

    const sql = await readProductionLegacyAuditSql();
    const result = await client.query(sql);
    const report = result.rows?.[0]?.report;
    if (!report || typeof report !== 'object') {
      throw new Error('PRODUCTION LEGACY AUDIT: aggregate report was empty.');
    }

    logger.log(`[Production Legacy Audit] Report: ${JSON.stringify(report)}`);
    logger.log('[Production Legacy Audit] COMPLETE: read-only; no changes applied.');
    return { options, target, report };
  } catch (error) {
    logger.error(`[Production Legacy Audit] Failed: ${sanitizeErrorMessage(error)}`);
    throw error;
  } finally {
    if (lockHeld && client) {
      await client.query(AUDIT_UNLOCK_SQL).catch(() => {});
    }
    if (client) client.release();
    if (!pool && activePool) await activePool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('audit-production-legacy-payment-artifacts.js')) {
  runProductionLegacyPaymentArtifactAudit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
