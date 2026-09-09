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

function countBy(rows, makeKey, fields) {
  const groups = new Map();
  for (const row of rows) {
    const values = fields(row);
    const key = makeKey(values);
    const current = groups.get(key) || { ...values, target_count: 0 };
    current.target_count += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
}

/**
 * The canonical SQL returns one row per blocked target. This function derives
 * only aggregate information, so raw identifiers never leave the audit
 * process. Provider/history audits consume the same rows directly.
 */
export function aggregateLegacyClassificationRows(rows = []) {
  const unique = new Map(rows.map((row) => [`${row.target_kind}:${row.target_id}`, row]));
  const targets = [...unique.values()];
  const count = (predicate) => targets.filter(predicate).length;
  const missingOnly = count((row) => row.missing_profile_snapshot && !row.ambiguous_shape_or_status);
  const ambiguousOnly = count((row) => !row.missing_profile_snapshot && row.ambiguous_shape_or_status);
  const overlap = count((row) => row.missing_profile_snapshot && row.ambiguous_shape_or_status);
  return {
    summary: {
      unique_blocked_targets: targets.length,
      ambiguous_only: ambiguousOnly,
      missing_profile_only: missingOnly,
      overlap,
      reconciliation_needed_count: count((row) => row.reconciliation_needed),
    },
    // Preserve the previous aggregate audit contract while deriving every
    // bucket from the one canonical classifier.
    breakdown: countBy(
      targets,
      (value) => [
        value.target_kind, value.payment_status || 'NOT_APPLICABLE', value.lifecycle_status || 'NOT_APPLICABLE',
        value.has_payos_order_code, value.has_payment_link_id, value.has_checkout_url, value.has_qr_code,
        value.has_payment_created_at, value.has_expires_at, value.has_paid_at, value.missing_profile_snapshot,
        value.ambiguous_shape_or_status, value.resolved_profile_count, value.deterministic_evidence_source,
        value.reconciliation_needed, value.classification,
      ].join(':'),
      (row) => ({
        target_kind: row.target_kind,
        payment_status: row.payment_status || 'NOT_APPLICABLE',
        lifecycle_status: row.lifecycle_status || 'NOT_APPLICABLE',
        has_payos_order_code: Boolean(row.has_payos_order_code),
        has_payment_link_id: Boolean(row.has_payment_link_id),
        has_checkout_url: Boolean(row.has_checkout_url),
        has_qr_code: Boolean(row.has_qr_code),
        has_payment_created_at: Boolean(row.has_payment_created_at),
        has_expires_at: Boolean(row.has_expires_at),
        has_paid_at: Boolean(row.has_paid_at),
        missing_profile_snapshot: Boolean(row.missing_profile_snapshot),
        ambiguous_shape_or_status: Boolean(row.ambiguous_shape_or_status),
        resolved_profile_count: Number(row.resolved_profile_count || 0),
        deterministic_evidence_source: row.deterministic_evidence_source,
        reconciliation_needed: Boolean(row.reconciliation_needed),
        classification: row.classification,
      }),
    ),
    classification_counts: countBy(targets, (value) => value.classification, (row) => ({ classification: row.classification })),
    deterministic_evidence_source_breakdown: countBy(
      targets,
      (value) => value.deterministic_evidence_source,
      (row) => ({ deterministic_evidence_source: row.deterministic_evidence_source }),
    ),
  };
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
    const report = aggregateLegacyClassificationRows(result.rows || []);

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
