import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../../config/postgres-production-migration-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFICATION_FILE = '0026_payment_attempts_legacy_blocker_audit_readonly.sql';
const DECISION_AUDIT_FILE = '0026_active_legacy_payment_final_decision_audit_readonly.sql';
const AUDIT_LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext('teaplus_postgres_migrations')) AS acquired";
const AUDIT_UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('teaplus_postgres_migrations'))";

function sanitizeErrorMessage(error) {
  return String(error?.message || error || 'Unknown final legacy decision audit error')
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s'"`]+/gi, '[redacted-postgres-url]')
    .replace(/\b(?:user(?:name)?|password|token|api[_-]?key)=([^\s&]+)/gi, (matched) => matched.replace(/=.*/, '=[redacted]'));
}

export function parseProductionLegacyFinalDecisionAuditArgs(args = []) {
  if (args.length !== 1 || args[0] !== '--audit=0026-final-decision') {
    throw new Error('PRODUCTION LEGACY FINAL DECISION AUDIT: only --audit=0026-final-decision is supported.');
  }
  return { audit: '0026-final-decision' };
}

export async function readProductionLegacyFinalDecisionAuditSql() {
  const [classificationSql, decisionSql] = await Promise.all([
    fs.readFile(path.join(__dirname, 'verification', CLASSIFICATION_FILE), 'utf8'),
    fs.readFile(path.join(__dirname, 'verification', DECISION_AUDIT_FILE), 'utf8'),
  ]);
  return { classificationSql, decisionSql };
}

async function loadProductionRuntimeModules() {
  // Delayed so a dotenv-loading runtime module cannot affect the production
  // guard or the explicit shell URL used by this audit.
  const [pgModule, dbModule] = await Promise.all([
    import('pg'),
    import('../../config/db-postgres.js'),
  ]);
  return {
    Pool: pgModule.default.Pool,
    getPostgresPoolConfig: dbModule.getPostgresPoolConfig,
  };
}

function activeCanonicalTargetKey(row) {
  return `${row.target_kind}:${row.target_id}`;
}

function canonicalActiveTargets(rows = []) {
  return rows.filter((row) => row.classification === 'ACTIVE_PAYMENT_REQUIRES_REPAIR' && row.reconciliation_needed === true);
}

/**
 * Guarded DB-only decision audit. It reads the canonical classifier first and
 * passes that exact in-memory result to the detail SQL. No provider SDK, HTTP
 * request, transaction, or data mutation is used.
 */
export async function runProductionLegacyFinalDecisionAudit({
  args = process.argv.slice(2),
  env = process.env,
  pool = null,
  createPool = null,
  loadRuntimeModules = loadProductionRuntimeModules,
  logger = console,
} = {}) {
  let activePool = null;
  let client = null;
  let lockHeld = false;

  try {
    const options = parseProductionLegacyFinalDecisionAuditArgs(args);
    // Snapshot and guard before dynamically importing db config, which may
    // load dotenv. Never delete or alter test variables to pass this guard.
    const shellEnv = { ...env };
    if (shellEnv.PRODUCTION_LEGACY_DECISION_AUDIT !== '1') {
      throw new Error('PRODUCTION LEGACY FINAL DECISION AUDIT: PRODUCTION_LEGACY_DECISION_AUDIT=1 is required.');
    }
    const target = validatePostgresProductionMigrationGuard(shellEnv.PRODUCTION_DATABASE_URL, {
      env: shellEnv.NODE_ENV,
      mode: shellEnv.MIGRATION_MODE,
      confirmFlag: shellEnv.POSTGRES_PRODUCTION_MIGRATIONS,
      allowedHosts: shellEnv.POSTGRES_PRODUCTION_ALLOWED_HOSTS,
      allowedDatabases: shellEnv.POSTGRES_PRODUCTION_ALLOWED_DATABASES,
      testDatabaseUrl: shellEnv.TEST_DATABASE_URL,
      testConfirmFlag: shellEnv.POSTGRES_INTEGRATION,
    });
    logger.log(`[Production Legacy Final Decision Audit] Target: ${describeProductionMigrationTarget(target)}`);
    logger.log('[Production Legacy Final Decision Audit] Guard passed.');

    const runtime = await loadRuntimeModules();
    const makePool = createPool || ((config) => new runtime.Pool(config));
    activePool = pool || makePool(runtime.getPostgresPoolConfig(shellEnv.PRODUCTION_DATABASE_URL, { env: shellEnv }));
    client = await activePool.connect();

    const lock = await client.query(AUDIT_LOCK_SQL);
    lockHeld = lock.rows[0]?.acquired === true;
    if (!lockHeld) throw new Error('PRODUCTION LEGACY FINAL DECISION AUDIT: migration advisory lock is currently held.');

    const { classificationSql, decisionSql } = await readProductionLegacyFinalDecisionAuditSql();
    const canonicalResult = await client.query(classificationSql);
    const canonicalRows = canonicalResult.rows || [];
    const activeTargets = canonicalActiveTargets(canonicalRows);
    const uniqueActiveTargetCount = new Set(activeTargets.map(activeCanonicalTargetKey)).size;
    if (uniqueActiveTargetCount !== activeTargets.length) {
      throw new Error('PRODUCTION LEGACY FINAL DECISION AUDIT: canonical active input has duplicate targets.');
    }

    const decisionResult = await client.query(decisionSql, [JSON.stringify(canonicalRows)]);
    const report = decisionResult.rows?.[0]?.report;
    const integrity = report?.input_integrity;
    const expectedCount = activeTargets.length;
    const reportedInputCount = Number(integrity?.canonical_active_input_count);
    const reportedDistinctCount = Number(integrity?.canonical_active_distinct_count);
    const resolvedCount = Number(integrity?.resolved_target_count);
    const classifiedCount = Number(integrity?.classified_target_count);
    const driftCount = Number(integrity?.input_drift_count);
    if (!report || typeof report !== 'object'
      || reportedInputCount !== expectedCount
      || reportedDistinctCount !== expectedCount
      || resolvedCount !== expectedCount
      || classifiedCount !== expectedCount
      || driftCount !== 0) {
      throw new Error('PRODUCTION LEGACY FINAL DECISION AUDIT: canonical active input drift detected; decision is fail-closed.');
    }

    logger.log(`[Production Legacy Final Decision Audit] Report: ${JSON.stringify(report)}`);
    logger.log('[Production Legacy Final Decision Audit] COMPLETE: DB read-only; no changes applied.');
    return { options, target, report };
  } catch (error) {
    logger.error(`[Production Legacy Final Decision Audit] Failed: ${sanitizeErrorMessage(error)}`);
    throw error;
  } finally {
    if (lockHeld && client) await client.query(AUDIT_UNLOCK_SQL).catch(() => {});
    if (client) client.release();
    if (!pool && activePool) await activePool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('audit-production-legacy-payment-final-decision.js')) {
  runProductionLegacyFinalDecisionAudit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
