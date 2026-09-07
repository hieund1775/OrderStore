import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../../config/postgres-production-migration-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES_FILE = '0026_provider_resolution_candidates_readonly.sql';
const HISTORY_FILE = '0026_ambiguous_legacy_history_audit_readonly.sql';
const DEFAULT_LOOKUP_TIMEOUT_MS = 10_000;

function sanitizeErrorMessage(error) {
  return String(error?.message || error || 'Unknown provider-resolution audit error')
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s'"`]+/gi, '[redacted-postgres-url]')
    .replace(/\b(?:user(?:name)?|password|token|api[_-]?key)=([^\s&]+)/gi, (matched) => matched.replace(/=.*/, '=[redacted]'));
}

function safePositiveInteger(value, label) {
  if (!/^[1-9]\d*$/.test(String(value || ''))) {
    throw new Error(`PRODUCTION PROVIDER AUDIT: ${label} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 10_000) {
    throw new Error(`PRODUCTION PROVIDER AUDIT: ${label} is outside the safe limit.`);
  }
  return parsed;
}

export function parseProductionProviderResolutionAuditArgs(args = []) {
  let audit = null;
  let maxProviderLookups = null;
  for (const argument of args) {
    if (argument === '--audit=0026-provider-resolution') {
      audit = '0026-provider-resolution';
    } else if (argument.startsWith('--max-provider-lookups=')) {
      maxProviderLookups = safePositiveInteger(argument.slice('--max-provider-lookups='.length), '--max-provider-lookups');
    } else {
      throw new Error(`PRODUCTION PROVIDER AUDIT: unsupported argument "${argument}".`);
    }
  }
  if (!audit || maxProviderLookups == null) {
    throw new Error('PRODUCTION PROVIDER AUDIT: --audit=0026-provider-resolution and --max-provider-lookups=<positive integer> are required.');
  }
  return { audit, maxProviderLookups };
}

export async function readProviderResolutionAuditSql() {
  const [candidatesSql, historySql] = await Promise.all([
    fs.readFile(path.join(__dirname, 'verification', CANDIDATES_FILE), 'utf8'),
    fs.readFile(path.join(__dirname, 'verification', HISTORY_FILE), 'utf8'),
  ]);
  return { candidatesSql, historySql };
}

function generateProfileEnvPrefix(code) {
  const normalized = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
  return `PAYOS_PROFILE_${normalized}`;
}

function credentialsFromSnapshot(env, profileCode) {
  const normalizedCode = String(profileCode || '').toUpperCase().trim();
  const prefix = generateProfileEnvPrefix(normalizedCode);
  const scoped = {
    clientId: env[`${prefix}_CLIENT_ID`]?.trim(),
    apiKey: env[`${prefix}_API_KEY`]?.trim(),
    checksumKey: env[`${prefix}_CHECKSUM_KEY`]?.trim(),
  };
  if (scoped.clientId && scoped.apiKey && scoped.checksumKey) return scoped;

  // Preserve the legacy runtime compatibility only for historical system
  // profiles. Each code remains a separate candidate in the audit.
  if (normalizedCode === 'LONG_GROUPED_CHECKOUT' || normalizedCode === 'DEFAULT_LONG') {
    const legacy = {
      clientId: env.PAYOS_CLIENT_ID?.trim(),
      apiKey: env.PAYOS_API_KEY?.trim(),
      checksumKey: env.PAYOS_CHECKSUM_KEY?.trim(),
    };
    if (legacy.clientId && legacy.apiKey && legacy.checksumKey) return legacy;
  }
  return null;
}

export function createSnapshotPayOSResolver({ env, PayOS }) {
  const instances = new Map();
  return (profileCode) => {
    const normalizedCode = String(profileCode || '').toUpperCase().trim();
    if (instances.has(normalizedCode)) return instances.get(normalizedCode);
    const credentials = credentialsFromSnapshot(env, normalizedCode);
    if (!credentials) return null;
    const instance = new PayOS(credentials);
    instances.set(normalizedCode, instance);
    return instance;
  };
}

async function loadProductionRuntimeModules() {
  // These imports are intentionally delayed until the production guard has
  // accepted the explicit shell environment. Some runtime modules load dotenv.
  const [pgModule, dbModule, payOSModule] = await Promise.all([
    import('pg'),
    import('../../config/db-postgres.js'),
    import('@payos/node'),
  ]);
  return {
    Pool: pgModule.default.Pool,
    getPostgresPoolConfig: dbModule.getPostgresPoolConfig,
    PayOS: payOSModule.PayOS,
  };
}

function readStatus(payment) {
  return String(payment?.status || payment?.paymentStatus || '').toUpperCase() || null;
}

function paymentLinkId(payment) {
  const value = payment?.paymentLinkId ?? payment?.id ?? null;
  return value == null ? null : String(value);
}

function exactAmount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function isExplicitNotFound(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  return status === 404 || error?.code === 'NOT_FOUND' || error?.code === 'PAYMENT_LINK_NOT_FOUND';
}

function isProfileError(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  return status === 401 || status === 403;
}

export function classifyProviderLookupFailure(error) {
  if (isExplicitNotFound(error)) return { kind: 'not_found' };
  if (isProfileError(error)) return { kind: 'profile_error' };
  return { kind: 'unknown' };
}

async function withTimeout(promise, timeoutMs) {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Object.assign(new Error('provider lookup timed out'), { code: 'AUDIT_TIMEOUT' })), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Read-only PayOS GET adapter. It deliberately never calls create/cancel/update APIs. */
export async function lookupPayOSTransactionForAudit({ profileCode, providerOrderCode, getPayOSForProfile, timeoutMs = DEFAULT_LOOKUP_TIMEOUT_MS }) {
  const instance = getPayOSForProfile(profileCode);
  if (!instance) return { kind: 'profile_error' };
  try {
    let payment;
    if (typeof instance.paymentRequests?.get === 'function') {
      payment = await withTimeout(instance.paymentRequests.get(String(providerOrderCode)), timeoutMs);
    } else if (typeof instance.getPaymentLinkInformation === 'function') {
      payment = await withTimeout(instance.getPaymentLinkInformation(Number(providerOrderCode)), timeoutMs);
    } else {
      return { kind: 'profile_error' };
    }
    if (!payment || typeof payment !== 'object') return { kind: 'unknown' };
    return { kind: 'found', payment };
  } catch (error) {
    return classifyProviderLookupFailure(error);
  }
}

export function assessProviderLookup({ candidate, profileCode, lookup }) {
  if (lookup.kind !== 'found') return { profileCode, kind: lookup.kind };
  const expectedOrderCode = String(candidate.provider_order_code);
  const returnedOrderCode = lookup.payment?.orderCode == null ? null : String(lookup.payment.orderCode);
  const expectedAmount = exactAmount(candidate.expected_amount);
  const returnedAmount = exactAmount(lookup.payment?.amountPaid ?? lookup.payment?.amount);
  const expectedLinkId = candidate.expected_payment_link_id == null ? null : String(candidate.expected_payment_link_id);
  const returnedLinkId = paymentLinkId(lookup.payment);
  if (returnedOrderCode !== expectedOrderCode || expectedAmount == null || returnedAmount !== expectedAmount
    || (expectedLinkId != null && returnedLinkId !== expectedLinkId)) {
    return { profileCode, kind: 'identity_mismatch' };
  }
  return { profileCode, kind: 'match', providerStatus: readStatus(lookup.payment) };
}

function targetResolution({ candidate, checks, profileCount, skippedByLimit }) {
  if (candidate.provider_order_code == null) {
    return { outcome: 'LOCAL_IDENTITY_INCOMPLETE', reconciliationNeeded: true };
  }
  if (profileCount === 0) {
    return { outcome: 'UNKNOWN', reconciliationNeeded: true };
  }
  if (skippedByLimit || checks.length !== profileCount) {
    return { outcome: 'AUDIT_INCOMPLETE', reconciliationNeeded: true };
  }
  const matches = checks.filter((check) => check.kind === 'match');
  const hasUnknown = checks.some((check) => check.kind === 'unknown' || check.kind === 'profile_error');
  const hasMismatch = checks.some((check) => check.kind === 'identity_mismatch');
  if (matches.length > 1) return { outcome: 'MULTI_PROFILE_MATCH', matches, reconciliationNeeded: true, hasUnknown };
  if (hasUnknown) return { outcome: 'UNKNOWN', matches, reconciliationNeeded: true };
  if (matches.length === 1) return { outcome: 'UNIQUE_PROFILE_RESOLVED', matches, reconciliationNeeded: false };
  if (hasMismatch) return { outcome: 'AMOUNT_OR_IDENTITY_MISMATCH', reconciliationNeeded: true };
  return { outcome: 'ZERO_MATCH', reconciliationNeeded: true };
}

function providerStatusBucket(status) {
  if (status === 'PAID') return 'provider_paid';
  if (['PENDING', 'UNPAID', 'PROCESSING'].includes(status)) return 'provider_pending_or_unpaid';
  if (['CANCELLED', 'CANCELED', 'EXPIRED'].includes(status)) return 'provider_cancelled_or_expired';
  return 'provider_other_status';
}

function buildAggregateReport({ candidates, profileCount, checkedPairs, uncheckedPairsDueToLimit, resolutions }) {
  const count = (predicate) => resolutions.filter(predicate).length;
  const report = {
    candidate_targets: candidates.length,
    configured_profile_count: profileCount,
    planned_provider_lookups: candidates.length * profileCount,
    checked_provider_lookups: checkedPairs,
    unchecked_target_profile_pairs_due_to_limit: uncheckedPairsDueToLimit,
    unchecked_targets_due_to_limit: count((result) => result.outcome === 'AUDIT_INCOMPLETE'),
    audit_incomplete: uncheckedPairsDueToLimit > 0,
    unique_profile_resolved: count((result) => result.outcome === 'UNIQUE_PROFILE_RESOLVED'),
    zero_match: count((result) => result.outcome === 'ZERO_MATCH'),
    multi_profile_match: count((result) => result.outcome === 'MULTI_PROFILE_MATCH'),
    provider_unknown_or_profile_error: count((result) => result.outcome === 'UNKNOWN'),
    amount_or_identity_mismatch: count((result) => result.outcome === 'AMOUNT_OR_IDENTITY_MISMATCH'),
    local_identity_incomplete: count((result) => result.outcome === 'LOCAL_IDENTITY_INCOMPLETE'),
    provider_paid: 0,
    provider_pending_or_unpaid: 0,
    provider_cancelled_or_expired: 0,
    provider_cancelled_expired_or_not_found: 0,
    provider_not_found: count((result) => result.outcome === 'ZERO_MATCH'),
  };
  for (const result of resolutions) {
    const seenBuckets = new Set();
    for (const match of result.matches || []) {
      seenBuckets.add(providerStatusBucket(match.providerStatus));
    }
    for (const bucket of seenBuckets) {
      if (Object.hasOwn(report, bucket)) report[bucket] += 1;
    }
  }
  report.provider_cancelled_expired_or_not_found = report.provider_cancelled_or_expired + report.provider_not_found;
  return report;
}

/**
 * Guarded provider-resolution audit. No DB transaction, mutation query, or
 * PayOS create/cancel/update method is used. Raw identifiers remain in memory.
 */
export async function runProductionProviderResolutionAudit({
  args = process.argv.slice(2),
  env = process.env,
  pool = null,
  createPool = null,
  lookupTransaction = null,
  isProfileConfigured = null,
  loadRuntimeModules = loadProductionRuntimeModules,
  logger = console,
} = {}) {
  let activePool = null;
  let client = null;
  try {
    const options = parseProductionProviderResolutionAuditArgs(args);
    // This snapshot is taken before any dotenv-loading runtime module is
    // imported. Never delete or rewrite values in env/process.env to pass.
    const shellEnv = { ...env };
    if (shellEnv.PRODUCTION_PAYOS_AUDIT !== '1') {
      throw new Error('PRODUCTION PROVIDER AUDIT: PRODUCTION_PAYOS_AUDIT=1 is required.');
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
    logger.log(`[Production Provider Audit] Target: ${describeProductionMigrationTarget(target)}`);
    logger.log('[Production Provider Audit] Guard passed.');
    const runtime = await loadRuntimeModules();
    const getPayOSForProfile = createSnapshotPayOSResolver({ env: shellEnv, PayOS: runtime.PayOS });
    const profileConfigured = isProfileConfigured || ((profileCode) => Boolean(credentialsFromSnapshot(shellEnv, profileCode)));
    const lookupProvider = lookupTransaction || ((params) => lookupPayOSTransactionForAudit({ ...params, getPayOSForProfile }));
    const makePool = createPool || ((config) => new runtime.Pool(config));
    // Explicit URL plus the pre-import shell snapshot prevents DATABASE_URL or
    // TEST_DATABASE_URL (including values later loaded from .env) from routing
    // this audit anywhere other than the guarded production target.
    activePool = pool || makePool(runtime.getPostgresPoolConfig(shellEnv.PRODUCTION_DATABASE_URL, { env: shellEnv }));
    client = await activePool.connect();
    const { candidatesSql, historySql } = await readProviderResolutionAuditSql();
    const [candidateResult, profileResult] = await Promise.all([
      client.query(candidatesSql),
      client.query('SELECT code FROM payment_profiles ORDER BY code ASC'),
    ]);
    const candidates = candidateResult.rows || [];
    const profiles = (profileResult.rows || []).map((row) => String(row.code)).filter((code) => profileConfigured(code));
    const resolutions = [];
    let checkedPairs = 0;
    let uncheckedPairsDueToLimit = 0;

    for (let targetIndex = 0; targetIndex < candidates.length; targetIndex += 1) {
      const candidate = candidates[targetIndex];
      const checks = [];
      let skippedByLimit = false;
      if (candidate.provider_order_code != null) {
        for (let profileIndex = 0; profileIndex < profiles.length; profileIndex += 1) {
          if (checkedPairs >= options.maxProviderLookups) {
            skippedByLimit = true;
            uncheckedPairsDueToLimit += profiles.length - profileIndex;
            break;
          }
          const profileCode = profiles[profileIndex];
          let lookupResult;
          try {
            lookupResult = await lookupProvider({ profileCode, providerOrderCode: candidate.provider_order_code });
          } catch {
            lookupResult = { kind: 'unknown' };
          }
          checks.push(assessProviderLookup({ candidate, profileCode, lookup: lookupResult }));
          checkedPairs += 1;
        }
      }
      if (skippedByLimit) {
        uncheckedPairsDueToLimit += (candidates.length - targetIndex - 1) * profiles.length;
      }
      resolutions.push(targetResolution({ candidate, checks, profileCount: profiles.length, skippedByLimit }));
      if (skippedByLimit) {
        for (let remaining = targetIndex + 1; remaining < candidates.length; remaining += 1) {
          resolutions.push({ outcome: 'AUDIT_INCOMPLETE', reconciliationNeeded: true });
        }
        break;
      }
    }

    const historyResult = await client.query(historySql);
    const report = {
      provider_resolution: buildAggregateReport({
        candidates,
        profileCount: profiles.length,
        checkedPairs,
        uncheckedPairsDueToLimit,
        resolutions,
      }),
      ambiguous_legacy_history: historyResult.rows?.[0]?.report || null,
    };
    if (!report.ambiguous_legacy_history || typeof report.ambiguous_legacy_history !== 'object') {
      throw new Error('PRODUCTION PROVIDER AUDIT: ambiguous legacy-history report was empty.');
    }
    logger.log(`[Production Provider Audit] Report: ${JSON.stringify(report)}`);
    logger.log('[Production Provider Audit] COMPLETE: DB and provider reads only; no changes applied.');
    return { options, target, report };
  } catch (error) {
    logger.error(`[Production Provider Audit] Failed: ${sanitizeErrorMessage(error)}`);
    throw error;
  } finally {
    if (client) client.release();
    if (!pool && activePool) await activePool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('audit-production-provider-resolution.js')) {
  runProductionProviderResolutionAudit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
