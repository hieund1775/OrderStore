import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../../config/postgres-production-migration-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFICATION_FILE = '0026_payment_attempts_legacy_blocker_audit_readonly.sql';
const HISTORY_FILE = '0026_ambiguous_legacy_history_audit_readonly.sql';
const DEFAULT_LOOKUP_TIMEOUT_MS = 10_000;
const SCOPED_PAYOS_KEY = /^PAYOS_PROFILE_([A-Z0-9_]+)_(CLIENT_ID|API_KEY|CHECKSUM_KEY)$/;

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
  let payosEnvFile = null;
  for (const argument of args) {
    if (argument === '--audit=0026-provider-resolution') {
      audit = '0026-provider-resolution';
    } else if (argument.startsWith('--max-provider-lookups=')) {
      maxProviderLookups = safePositiveInteger(argument.slice('--max-provider-lookups='.length), '--max-provider-lookups');
    } else if (argument.startsWith('--payos-env-file=')) {
      payosEnvFile = argument.slice('--payos-env-file='.length);
    } else {
      throw new Error(`PRODUCTION PROVIDER AUDIT: unsupported argument "${argument}".`);
    }
  }
  if (!audit || maxProviderLookups == null || !payosEnvFile) {
    throw new Error('PRODUCTION PROVIDER AUDIT: --audit=0026-provider-resolution, --max-provider-lookups=<positive integer>, and --payos-env-file=<absolute-path> are required.');
  }
  if (!path.isAbsolute(payosEnvFile)) {
    throw new Error('PRODUCTION PROVIDER AUDIT: --payos-env-file must be an absolute path.');
  }
  return { audit, maxProviderLookups, payosEnvFile };
}

export async function readProviderResolutionAuditSql() {
  const [classificationSql, historySql] = await Promise.all([
    fs.readFile(path.join(__dirname, 'verification', CLASSIFICATION_FILE), 'utf8'),
    fs.readFile(path.join(__dirname, 'verification', HISTORY_FILE), 'utf8'),
  ]);
  return { classificationSql, historySql };
}

export function extractScopedPayOSCredentials(parsedEnv = {}) {
  const byCode = new Map();
  for (const [key, rawValue] of Object.entries(parsedEnv)) {
    const match = SCOPED_PAYOS_KEY.exec(key);
    if (!match || typeof rawValue !== 'string' || !rawValue.trim()) continue;
    const [, code, part] = match;
    const credentials = byCode.get(code) || {};
    credentials[part] = rawValue.trim();
    byCode.set(code, credentials);
  }
  const resolved = new Map();
  for (const [code, credentials] of byCode) {
    if (credentials.CLIENT_ID && credentials.API_KEY && credentials.CHECKSUM_KEY) {
      resolved.set(code, {
        clientId: credentials.CLIENT_ID,
        apiKey: credentials.API_KEY,
        checksumKey: credentials.CHECKSUM_KEY,
      });
    }
  }
  return resolved;
}

export async function readScopedPayOSCredentialsFile(filePath, { parseEnv, readFile = fs.readFile } = {}) {
  if (!path.isAbsolute(filePath)) {
    throw new Error('PRODUCTION PROVIDER AUDIT: --payos-env-file must be an absolute path.');
  }
  if (typeof parseEnv !== 'function') {
    throw new Error('PRODUCTION PROVIDER AUDIT: explicit PayOS ENV parser is unavailable.');
  }
  const content = await readFile(filePath, 'utf8');
  return extractScopedPayOSCredentials(parseEnv(content));
}

export function createSnapshotPayOSResolver({ credentialsByProfile, PayOS }) {
  const instances = new Map();
  return (profileCode) => {
    const normalizedCode = String(profileCode || '').toUpperCase().trim();
    if (instances.has(normalizedCode)) return instances.get(normalizedCode);
    const credentials = credentialsByProfile.get(normalizedCode);
    if (!credentials) return null;
    const instance = new PayOS(credentials);
    instances.set(normalizedCode, instance);
    return instance;
  };
}

async function loadProductionRuntimeModules() {
  // These imports are intentionally delayed until the production guard has
  // accepted the explicit shell environment. Some runtime modules load dotenv.
  const [pgModule, dbModule, payOSModule, dotenvModule] = await Promise.all([
    import('pg'),
    import('../../config/db-postgres.js'),
    import('@payos/node'),
    import('dotenv'),
  ]);
  return {
    Pool: pgModule.default.Pool,
    getPostgresPoolConfig: dbModule.getPostgresPoolConfig,
    PayOS: payOSModule.PayOS,
    parseDotenv: dotenvModule.parse || dotenvModule.default?.parse,
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
  readPayOSCredentialFile = readScopedPayOSCredentialsFile,
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
    // The explicit file is parsed only after the guard. Its parser returns an
    // object and this audit whitelists scoped PayOS keys without writing them
    // into process.env. The shell environment remains the sole DB authority.
    const credentialsByProfile = await readPayOSCredentialFile(options.payosEnvFile, { parseEnv: runtime.parseDotenv });
    const getPayOSForProfile = createSnapshotPayOSResolver({ credentialsByProfile, PayOS: runtime.PayOS });
    const lookupProvider = lookupTransaction || ((params) => lookupPayOSTransactionForAudit({ ...params, getPayOSForProfile }));
    const makePool = createPool || ((config) => new runtime.Pool(config));
    // Explicit URL plus the pre-import shell snapshot prevents DATABASE_URL or
    // TEST_DATABASE_URL (including values later loaded from .env) from routing
    // this audit anywhere other than the guarded production target.
    activePool = pool || makePool(runtime.getPostgresPoolConfig(shellEnv.PRODUCTION_DATABASE_URL, { env: shellEnv }));
    client = await activePool.connect();
    const { classificationSql, historySql } = await readProviderResolutionAuditSql();
    const [candidateResult, profileResult] = await Promise.all([
      client.query(classificationSql),
      client.query('SELECT code FROM payment_profiles ORDER BY code ASC'),
    ]);
    const canonicalRows = candidateResult.rows || [];
    const candidates = canonicalRows.filter((row) => row.classification === 'ACTIVE_PAYMENT_REQUIRES_REPAIR');
    const ambiguousTargets = canonicalRows.filter((row) => row.classification === 'AMBIGUOUS_BLOCK');
    const profiles = (profileResult.rows || [])
      .map((row) => String(row.code).toUpperCase().trim())
      .filter((code) => credentialsByProfile.has(code));
    const canonicalCounts = {
      blocked_targets: canonicalRows.length,
      active_payment_requires_repair: candidates.length,
      ambiguous_block: ambiguousTargets.length,
    };
    logger.log(`[Production Provider Audit] Configured profiles: ${JSON.stringify({ configured_profile_codes: profiles, configured_profile_count: profiles.length })}`);
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

    const historyInput = ambiguousTargets.map((target) => ({
      target_kind: target.target_kind,
      target_id: target.target_id,
      provider_order_code: target.provider_order_code,
      expected_payment_link_id: target.expected_payment_link_id,
      transaction_id: target.transaction_id,
    }));
    const historyResult = await client.query(historySql, [JSON.stringify(historyInput)]);
    const report = {
      canonical_classification: canonicalCounts,
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
    const historyCount = Number(report.ambiguous_legacy_history?.summary?.ambiguous_block_targets);
    if (report.provider_resolution.candidate_targets !== canonicalCounts.active_payment_requires_repair
      || historyInput.length !== canonicalCounts.ambiguous_block
      || !Number.isSafeInteger(historyCount)
      || historyCount !== canonicalCounts.ambiguous_block) {
      throw new Error('PRODUCTION PROVIDER AUDIT: canonical classification count mismatch; provider resolution is fail-closed.');
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
