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
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,80}$/;
const SAFE_ERROR_CODE = /^(?:[A-Z][A-Z0-9_.:-]{0,63}|\d{1,12})$/;

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

function providerHttpStatus(error) {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status;
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function sanitizeErrorName(name, fallback = 'UnknownError') {
  const value = typeof name === 'string' ? name.trim() : '';
  return SAFE_ERROR_NAME.test(value) ? value : fallback;
}

function sanitizeErrorCode(code) {
  const value = typeof code === 'number' ? String(code) : (typeof code === 'string' ? code.trim() : '');
  return SAFE_ERROR_CODE.test(value) ? value : null;
}

function safeSdkMetadata(error, fallbackName = 'UnknownError') {
  const httpStatus = providerHttpStatus(error);
  return {
    error_name: sanitizeErrorName(error?.name, fallbackName),
    error_code: sanitizeErrorCode(error?.code),
    has_http_status: httpStatus != null,
    ...(httpStatus != null ? { http_status: httpStatus } : {}),
  };
}

export function classifyProviderLookupFailure(error) {
  const status = providerHttpStatus(error);
  if (status === 400) return { kind: 'unknown', resultClass: 'HTTP_400' };
  if (status === 401) return { kind: 'profile_error', resultClass: 'HTTP_401' };
  if (status === 403) return { kind: 'profile_error', resultClass: 'HTTP_403' };
  if (status === 404 || error?.code === 'NOT_FOUND' || error?.code === 'PAYMENT_LINK_NOT_FOUND') {
    return { kind: 'not_found', resultClass: 'HTTP_404' };
  }
  if (status === 429) return { kind: 'unknown', resultClass: 'HTTP_429' };
  if (status >= 500 && status <= 599) return { kind: 'unknown', resultClass: 'HTTP_5XX' };
  if (status >= 400 && status <= 499) return { kind: 'unknown', resultClass: 'HTTP_4XX_OTHER' };
  if (['AUDIT_TIMEOUT', 'ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(error?.code)) {
    return { kind: 'unknown', resultClass: 'TIMEOUT_OR_NETWORK' };
  }
  return { kind: 'unknown', resultClass: 'SDK_OR_INTERNAL', sdkMetadata: safeSdkMetadata(error) };
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
  if (!instance) return { kind: 'profile_error', resultClass: 'SDK_OR_INTERNAL', sdkMetadata: safeSdkMetadata(null, 'PayOSClientUnavailable') };
  try {
    let payment;
    if (typeof instance.paymentRequests?.get === 'function') {
      payment = await withTimeout(instance.paymentRequests.get(String(providerOrderCode)), timeoutMs);
    } else if (typeof instance.getPaymentLinkInformation === 'function') {
      payment = await withTimeout(instance.getPaymentLinkInformation(Number(providerOrderCode)), timeoutMs);
    } else {
      return { kind: 'profile_error', resultClass: 'SDK_OR_INTERNAL', sdkMetadata: safeSdkMetadata(null, 'PayOSClientUnsupported') };
    }
    if (!payment || typeof payment !== 'object') return { kind: 'unknown', resultClass: 'MALFORMED_OR_EMPTY' };
    return { kind: 'found', payment };
  } catch (error) {
    return classifyProviderLookupFailure(error);
  }
}

export function assessProviderLookup({ candidate, profileCode, lookup }) {
  if (lookup.kind !== 'found') {
    return {
      profileCode,
      kind: lookup.kind,
      resultClass: lookup.resultClass || (lookup.kind === 'not_found' ? 'HTTP_404' : 'SDK_OR_INTERNAL'),
      sdkMetadata: lookup.resultClass === 'SDK_OR_INTERNAL' ? lookup.sdkMetadata || safeSdkMetadata(null) : null,
    };
  }
  const expectedOrderCode = String(candidate.provider_order_code);
  const returnedOrderCode = lookup.payment?.orderCode == null ? null : String(lookup.payment.orderCode);
  const expectedAmount = exactAmount(candidate.expected_amount);
  const returnedAmount = exactAmount(lookup.payment?.amountPaid ?? lookup.payment?.amount);
  const expectedLinkId = candidate.expected_payment_link_id == null ? null : String(candidate.expected_payment_link_id);
  const returnedLinkId = paymentLinkId(lookup.payment);
  if (returnedOrderCode == null || returnedAmount == null || (expectedLinkId != null && returnedLinkId == null)) {
    return { profileCode, kind: 'unknown', resultClass: 'MALFORMED_OR_EMPTY' };
  }
  const mismatch = {
    amount: expectedAmount == null || returnedAmount !== expectedAmount,
    payment_link_id: expectedLinkId != null && returnedLinkId !== expectedLinkId,
    provider_order_code: returnedOrderCode !== expectedOrderCode,
  };
  if (mismatch.amount || mismatch.payment_link_id || mismatch.provider_order_code) {
    return { profileCode, kind: 'identity_mismatch', resultClass: 'IDENTITY_MISMATCH', mismatch };
  }
  return { profileCode, kind: 'match', resultClass: 'MATCH', providerStatus: readStatus(lookup.payment) };
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

function credentialGroupLabel(index) {
  return `credential_group_${String.fromCharCode(65 + index)}`;
}

function privateCredentialKey(credentials) {
  return `${credentials.clientId.length}:${credentials.clientId}\u0000${credentials.apiKey.length}:${credentials.apiKey}\u0000${credentials.checksumKey.length}:${credentials.checksumKey}`;
}

function buildCredentialGroupEntries(credentialsByProfile, profileCodes) {
  const groups = new Map();
  for (const profileCode of profileCodes) {
    const credentials = credentialsByProfile.get(profileCode);
    if (!credentials) continue;
    // This key remains process-local and is never returned or logged.
    const privateKey = privateCredentialKey(credentials);
    const existing = groups.get(privateKey) || { representative_profile_code: profileCode, profile_codes: [] };
    existing.profile_codes.push(profileCode);
    groups.set(privateKey, existing);
  }
  return [...groups.values()].map((entry, index) => ({
    credential_group: credentialGroupLabel(index),
    representative_profile_code: entry.representative_profile_code,
    profile_codes: entry.profile_codes,
  }));
}

export function buildCredentialEquivalenceGroups(credentialsByProfile, profileCodes) {
  return buildCredentialGroupEntries(credentialsByProfile, profileCodes).map(({ credential_group, profile_codes }) => ({ credential_group, profile_codes }));
}

function buildLookupBreakdown(resolutions) {
  const resultGroups = new Map();
  const mismatchGroups = new Map();
  const sdkMetadataGroups = new Map();
  const identityMismatchTargets = new Set();
  let identityMismatchLookupPairs = 0;
  for (const resolution of resolutions) {
    const targetKey = resolution.candidate
      ? `${resolution.candidate.target_kind}:${resolution.candidate.target_id}`
      : null;
    for (const check of resolution.checks || []) {
      const resultClass = check.resultClass || 'SDK_OR_INTERNAL';
      const resultKey = `${check.profileCode}:${resultClass}`;
      const resultGroup = resultGroups.get(resultKey) || {
        profile_code: check.profileCode,
        result_class: resultClass,
        lookup_pair_count: 0,
        targetKeys: new Set(),
      };
      resultGroup.lookup_pair_count += 1;
      if (targetKey) resultGroup.targetKeys.add(targetKey);
      resultGroups.set(resultKey, resultGroup);
      if (resultClass === 'SDK_OR_INTERNAL') {
        const metadata = check.sdkMetadata || safeSdkMetadata(null);
        const metadataKey = `${metadata.error_name}:${metadata.error_code || 'NONE'}:${metadata.has_http_status}:${metadata.http_status ?? 'NONE'}`;
        const metadataGroup = sdkMetadataGroups.get(metadataKey) || {
          error_name: metadata.error_name,
          error_code: metadata.error_code,
          has_http_status: metadata.has_http_status,
          http_status: metadata.http_status,
          lookup_pair_count: 0,
          targetKeys: new Set(),
        };
        metadataGroup.lookup_pair_count += 1;
        if (targetKey) metadataGroup.targetKeys.add(targetKey);
        sdkMetadataGroups.set(metadataKey, metadataGroup);
      }
      if (check.kind !== 'identity_mismatch') continue;
      identityMismatchLookupPairs += 1;
      if (targetKey) identityMismatchTargets.add(targetKey);
      for (const field of ['amount', 'payment_link_id', 'provider_order_code']) {
        if (!check.mismatch?.[field]) continue;
        const mismatchKey = `${check.profileCode}:${field}`;
        const mismatchGroup = mismatchGroups.get(mismatchKey) || {
          profile_code: check.profileCode,
          mismatch_field: field,
          lookup_pair_count: 0,
          targetKeys: new Set(),
        };
        mismatchGroup.lookup_pair_count += 1;
        if (targetKey) mismatchGroup.targetKeys.add(targetKey);
        mismatchGroups.set(mismatchKey, mismatchGroup);
      }
    }
  }
  const toPublicRows = (groups, field) => [...groups.values()]
    .map((group) => ({
      profile_code: group.profile_code,
      [field]: group[field],
      lookup_pair_count: group.lookup_pair_count,
      target_count: group.targetKeys.size,
    }))
    .sort((left, right) => `${left.profile_code}:${left[field]}`.localeCompare(`${right.profile_code}:${right[field]}`));
  return {
    provider_result_breakdown: toPublicRows(resultGroups, 'result_class'),
    sdk_internal_metadata_breakdown: [...sdkMetadataGroups.values()]
      .map((group) => ({
        error_name: group.error_name,
        error_code: group.error_code,
        has_http_status: group.has_http_status,
        ...(group.http_status != null ? { http_status: group.http_status } : {}),
        lookup_pair_count: group.lookup_pair_count,
        target_count: group.targetKeys.size,
      }))
      .sort((left, right) => `${left.error_name}:${left.error_code || ''}:${left.http_status ?? ''}`.localeCompare(`${right.error_name}:${right.error_code || ''}:${right.http_status ?? ''}`)),
    identity_mismatch_breakdown: {
      identity_mismatch_lookup_pair_count: identityMismatchLookupPairs,
      identity_mismatch_target_count: identityMismatchTargets.size,
      by_field: toPublicRows(mismatchGroups, 'mismatch_field'),
    },
  };
}

function buildAggregateReport({
  candidates, profileCount, physicalProviderGetCount, logicalLookupPairCount,
  plannedPhysicalProviderGetCount, uncheckedPhysicalProviderGetsDueToLimit,
  uncheckedPairsDueToLimit, resolutions, credentialGroups,
}) {
  const count = (predicate) => resolutions.filter(predicate).length;
  const report = {
    candidate_targets: candidates.length,
    configured_profile_count: profileCount,
    planned_provider_lookups: candidates.length * profileCount,
    planned_physical_provider_get_count: plannedPhysicalProviderGetCount,
    // Retained as the historical external-call counter; logical checks are
    // reported separately after credential-group fan-out.
    checked_provider_lookups: physicalProviderGetCount,
    physical_provider_get_count: physicalProviderGetCount,
    logical_lookup_pair_count: logicalLookupPairCount,
    unchecked_physical_provider_get_count_due_to_limit: uncheckedPhysicalProviderGetsDueToLimit,
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
    credential_equivalence_groups: credentialGroups,
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
  return { ...report, ...buildLookupBreakdown(resolutions) };
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
    const credentialGroups = buildCredentialEquivalenceGroups(credentialsByProfile, profiles);
    // The audit client is created from only clientId/apiKey/checksumKey. A
    // group is therefore safe to share one GET only when that entire tuple is
    // exactly equal; no profile-specific request option exists in this CLI.
    const credentialLookupGroups = buildCredentialGroupEntries(credentialsByProfile, profiles);
    const canonicalCounts = {
      blocked_targets: canonicalRows.length,
      active_payment_requires_repair: candidates.length,
      ambiguous_block: ambiguousTargets.length,
    };
    logger.log(`[Production Provider Audit] Configured profiles: ${JSON.stringify({ configured_profile_codes: profiles, configured_profile_count: profiles.length })}`);
    const resolutions = [];
    let physicalProviderGetCount = 0;
    let logicalLookupPairCount = 0;
    let uncheckedPhysicalProviderGetsDueToLimit = 0;
    let uncheckedPairsDueToLimit = 0;

    for (let targetIndex = 0; targetIndex < candidates.length; targetIndex += 1) {
      const candidate = candidates[targetIndex];
      const checks = [];
      let skippedByLimit = false;
      if (candidate.provider_order_code != null) {
        for (let groupIndex = 0; groupIndex < credentialLookupGroups.length; groupIndex += 1) {
          if (physicalProviderGetCount >= options.maxProviderLookups) {
            skippedByLimit = true;
            const remainingGroups = credentialLookupGroups.slice(groupIndex);
            uncheckedPhysicalProviderGetsDueToLimit += remainingGroups.length;
            uncheckedPairsDueToLimit += remainingGroups.reduce((total, group) => total + group.profile_codes.length, 0);
            break;
          }
          const group = credentialLookupGroups[groupIndex];
          let lookupResult;
          try {
            lookupResult = await lookupProvider({ profileCode: group.representative_profile_code, providerOrderCode: candidate.provider_order_code });
          } catch (error) {
            lookupResult = classifyProviderLookupFailure(error);
          }
          physicalProviderGetCount += 1;
          // Fan out the same provider result to each profile code. This keeps
          // resolution profile-scoped: equivalent profile aliases still yield
          // MULTI_PROFILE_MATCH when a shared credential returns a match.
          for (const profileCode of group.profile_codes) {
            checks.push(assessProviderLookup({ candidate, profileCode, lookup: lookupResult }));
            logicalLookupPairCount += 1;
          }
        }
      }
      if (skippedByLimit) {
        const remainingTargets = candidates.length - targetIndex - 1;
        uncheckedPhysicalProviderGetsDueToLimit += remainingTargets * credentialLookupGroups.length;
        uncheckedPairsDueToLimit += remainingTargets * profiles.length;
      }
      resolutions.push({
        candidate,
        checks,
        ...targetResolution({ candidate, checks, profileCount: profiles.length, skippedByLimit }),
      });
      if (skippedByLimit) {
        for (let remaining = targetIndex + 1; remaining < candidates.length; remaining += 1) {
          resolutions.push({ candidate: candidates[remaining], checks: [], outcome: 'AUDIT_INCOMPLETE', reconciliationNeeded: true });
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
        physicalProviderGetCount,
        logicalLookupPairCount,
        plannedPhysicalProviderGetCount: candidates.length * credentialLookupGroups.length,
        uncheckedPhysicalProviderGetsDueToLimit,
        uncheckedPairsDueToLimit,
        resolutions,
        credentialGroups,
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
