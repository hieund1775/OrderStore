import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assessProviderLookup,
  buildCredentialEquivalenceGroups,
  classifyProviderLookupFailure,
  createSnapshotPayOSResolver,
  extractScopedPayOSCredentials,
  lookupPayOSTransactionForAudit,
  parseProductionProviderResolutionAuditArgs,
  readScopedPayOSCredentialsFile,
  runProductionProviderResolutionAudit,
} from '../database/postgres/audit-production-provider-resolution.js';

const PAYOS_ENV_FILE = path.resolve('C:/audit-secrets/payos-production.env');
const auditArgs = (limit = 1) => [
  '--audit=0026-provider-resolution',
  `--max-provider-lookups=${limit}`,
  `--payos-env-file=${PAYOS_ENV_FILE}`,
];
const approvedEnvironment = Object.freeze({
  NODE_ENV: 'production', MIGRATION_MODE: 'production', POSTGRES_PRODUCTION_MIGRATIONS: '1', PRODUCTION_PAYOS_AUDIT: '1',
  PRODUCTION_DATABASE_URL: 'postgresql://release_user:release_secret@prod.db.example:5432/teaplus',
  POSTGRES_PRODUCTION_ALLOWED_HOSTS: 'prod.db.example', POSTGRES_PRODUCTION_ALLOWED_DATABASES: 'teaplus',
  TEST_DATABASE_URL: null, POSTGRES_INTEGRATION: null,
});

function canonicalRow(id, classification = 'ACTIVE_PAYMENT_REQUIRES_REPAIR') {
  return {
    target_kind: 'direct_order', target_id: id, provider_order_code: 9000 + id,
    expected_amount: '10000', expected_payment_link_id: `link-${id}`, transaction_id: null,
    classification, reconciliation_needed: classification === 'ACTIVE_PAYMENT_REQUIRES_REPAIR',
  };
}

function canonicalFixture() {
  return [
    ...Array.from({ length: 100 }, (_, index) => canonicalRow(index + 1)),
    ...Array.from({ length: 27 }, (_, index) => canonicalRow(200 + index, 'AMBIGUOUS_BLOCK')),
    ...Array.from({ length: 47 }, (_, index) => canonicalRow(300 + index, 'SAFE_TO_SKIP_HISTORY')),
  ];
}

function fakeCredentialReader(codes = ['A']) {
  return async () => new Map(codes.map((code) => [code, { clientId: `${code}-client`, apiKey: `${code}-key`, checksumKey: `${code}-checksum` }]));
}

function equivalentCredentialReader(codes = ['A', 'B', 'C']) {
  return async () => new Map(codes.map((code) => [code, { clientId: 'shared-client', apiKey: 'shared-key', checksumKey: 'shared-checksum' }]));
}

function createFakePool({ rows = [canonicalRow(1)], profiles = ['A', 'B'], history = null } = {}) {
  const calls = [];
  let connectCalls = 0;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('P1 / 0026 canonical legacy blocker classification')) return { rows };
      if (sql === 'SELECT code FROM payment_profiles ORDER BY code ASC') return { rows: profiles.map((code) => ({ code })) };
      if (sql.includes('P1 / 0026 ambiguous legacy-history audit')) {
        const targets = JSON.parse(params[0] || '[]');
        return { rows: [{ report: history || { summary: { ambiguous_block_targets: targets.length } } }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { async connect() { connectCalls += 1; return client; }, async end() {} }, calls, getConnectCalls: () => connectCalls };
}

function captureLogger() {
  const logs = []; const errors = [];
  return { logger: { log: (...args) => logs.push(args.join(' ')), error: (...args) => errors.push(args.join(' ')) }, logs, errors };
}

function found({ orderCode = 9001, amount = 10000, id = 'link-1', status = 'PAID' } = {}) {
  return { kind: 'found', payment: { orderCode, amount, id, status } };
}

function fakeRuntime(onImport = null) {
  return async () => {
    onImport?.();
    return {
      PayOS: class PayOS {}, Pool: class Pool {}, parseDotenv: () => ({}),
      getPostgresPoolConfig: (url) => ({ connectionString: url }),
    };
  };
}

describe('production provider-resolution audit', () => {
  it('requires explicit audit, lookup cap, absolute scoped PayOS file, audit opt-in, and shared production guard before connect', async () => {
    assert.deepEqual(parseProductionProviderResolutionAuditArgs(auditArgs(10)), { audit: '0026-provider-resolution', maxProviderLookups: 10, payosEnvFile: PAYOS_ENV_FILE });
    assert.throws(() => parseProductionProviderResolutionAuditArgs(['--audit=0026-provider-resolution', '--max-provider-lookups=1']), /payos-env-file/);
    assert.throws(() => parseProductionProviderResolutionAuditArgs(['--audit=0026-provider-resolution', '--max-provider-lookups=1', '--payos-env-file=relative.env']), /absolute path/);
    const fake = createFakePool();
    await assert.rejects(() => runProductionProviderResolutionAudit({ args: auditArgs(), env: { ...approvedEnvironment, PRODUCTION_PAYOS_AUDIT: '0' }, pool: fake.pool, logger: captureLogger().logger }), /PRODUCTION_PAYOS_AUDIT=1/);
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('runs the guard before a dotenv-like runtime import or credential reader can introduce test variables', async () => {
    const fake = createFakePool();
    let runtimeImported = false;
    let credentialRead = false;
    await assert.rejects(() => runProductionProviderResolutionAudit({
      args: auditArgs(), env: { ...approvedEnvironment, POSTGRES_PRODUCTION_MIGRATIONS: '0' }, pool: fake.pool,
      loadRuntimeModules: fakeRuntime(() => { runtimeImported = true; }),
      readPayOSCredentialFile: async () => { credentialRead = true; return new Map(); },
      logger: captureLogger().logger,
    }), /POSTGRES_PRODUCTION_MIGRATIONS=1 is required/);
    assert.equal(runtimeImported, false);
    assert.equal(credentialRead, false);
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('uses only explicit scoped PayOS keys, ignores test variables, and does not mutate process.env', async () => {
    const source = [
      'TEST_DATABASE_URL=postgresql://test-user:test-secret@test.db.example/test',
      'POSTGRES_INTEGRATION=1',
      'PAYOS_CLIENT_ID=generic-client',
      'PAYOS_PROFILE_A_CLIENT_ID=a-client',
      'PAYOS_PROFILE_A_API_KEY=a-key',
      'PAYOS_PROFILE_A_CHECKSUM_KEY=a-checksum',
      'PAYOS_PROFILE_B_CLIENT_ID=b-client',
    ].join('\n');
    const parsed = { TEST_DATABASE_URL: 'wrong', POSTGRES_INTEGRATION: '1', PAYOS_CLIENT_ID: 'generic', PAYOS_PROFILE_A_CLIENT_ID: 'a-client', PAYOS_PROFILE_A_API_KEY: 'a-key', PAYOS_PROFILE_A_CHECKSUM_KEY: 'a-checksum', PAYOS_PROFILE_B_CLIENT_ID: 'b-client' };
    const credentials = extractScopedPayOSCredentials(parsed);
    assert.deepEqual([...credentials.keys()], ['A']);
    const before = process.env.PAYOS_PROFILE_A_CLIENT_ID;
    const fromFile = await readScopedPayOSCredentialsFile(PAYOS_ENV_FILE, {
      readFile: async (filePath) => { assert.equal(filePath, PAYOS_ENV_FILE); return source; },
      parseEnv: (content) => { assert.equal(content, source); return parsed; },
    });
    assert.deepEqual([...fromFile.keys()], ['A']);
    assert.equal(process.env.PAYOS_PROFILE_A_CLIENT_ID, before);
  });

  it('binds the connection to the pre-import shell production URL and reports only configured profile codes', async () => {
    const fake = createFakePool({ profiles: ['A', 'B'] });
    const shellEnv = { ...approvedEnvironment };
    let receivedUrl = null;
    let receivedConfigEnv = null;
    const captured = captureLogger();
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(), env: shellEnv, createPool: () => fake.pool, lookupTransaction: async () => ({ kind: 'not_found' }),
      readPayOSCredentialFile: fakeCredentialReader(['A']), logger: captured.logger,
      loadRuntimeModules: async () => {
        shellEnv.TEST_DATABASE_URL = 'postgresql://test-user:test-secret@test.db.example:5432/test';
        shellEnv.DATABASE_URL = 'postgresql://wrong-user:wrong-secret@wrong.db.example:5432/wrong';
        return { PayOS: class PayOS {}, Pool: class Pool {}, parseDotenv: () => ({}), getPostgresPoolConfig(url, { env }) { receivedUrl = url; receivedConfigEnv = env; return { connectionString: url }; } };
      },
    });
    assert.equal(result.report.provider_resolution.configured_profile_count, 1);
    assert.equal(receivedUrl, approvedEnvironment.PRODUCTION_DATABASE_URL);
    assert.equal(receivedConfigEnv.TEST_DATABASE_URL, null);
    assert.match(captured.logs.join('\n'), /configured_profile_codes.*A/);
    assert.doesNotMatch(captured.logs.join('\n'), /a-client|a-key|a-checksum/);
  });

  it('constructs a PayOS client only from an explicit scoped credential map with no generic fallback', () => {
    const observed = [];
    const resolver = createSnapshotPayOSResolver({ credentialsByProfile: new Map([['A', { clientId: 'client', apiKey: 'key', checksumKey: 'checksum' }]]), PayOS: class PayOS { constructor(credentials) { observed.push(credentials); } } });
    resolver('A');
    assert.equal(resolver('DEFAULT_LONG'), null);
    assert.deepEqual(observed, [{ clientId: 'client', apiKey: 'key', checksumKey: 'checksum' }]);
  });

  it('uses canonical ACTIVE targets for provider candidates and canonical AMBIGUOUS targets for history input', async () => {
    const rows = canonicalFixture();
    const fake = createFakePool({ rows, profiles: ['A'] });
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(100), env: approvedEnvironment, pool: fake.pool, lookupTransaction: async () => ({ kind: 'not_found' }),
      readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    });
    assert.equal(result.report.canonical_classification.active_payment_requires_repair, 100);
    assert.equal(result.report.provider_resolution.candidate_targets, 100);
    assert.equal(result.report.canonical_classification.ambiguous_block, 27);
    assert.equal(result.report.ambiguous_legacy_history.summary.ambiguous_block_targets, 27);
    const historyCall = fake.calls.find((call) => call.sql.includes('P1 / 0026 ambiguous legacy-history audit'));
    assert.equal(JSON.parse(historyCall.params[0]).length, 27);
  });

  it('fails closed if history does not consume exactly the canonical ambiguous input', async () => {
    const fake = createFakePool({ rows: canonicalFixture(), profiles: ['A'], history: { summary: { ambiguous_block_targets: 0 } } });
    await assert.rejects(() => runProductionProviderResolutionAudit({
      args: auditArgs(100), env: approvedEnvironment, pool: fake.pool, lookupTransaction: async () => ({ kind: 'not_found' }),
      readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /canonical classification count mismatch/);
  });

  it('reports zero provider/history inputs only when the canonical classifier itself returns zero', async () => {
    const fake = createFakePool({ rows: [], profiles: ['A'] });
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(), env: approvedEnvironment, pool: fake.pool, lookupTransaction: async () => { throw new Error('must not call provider'); },
      readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    });
    assert.equal(result.report.canonical_classification.active_payment_requires_repair, 0);
    assert.equal(result.report.provider_resolution.candidate_targets, 0);
    assert.equal(result.report.canonical_classification.ambiguous_block, 0);
    assert.equal(result.report.ambiguous_legacy_history.summary.ambiguous_block_targets, 0);
  });

  it('reports separate amount, payment-link, and provider-order-code mismatch flags without identities', () => {
    const candidate = canonicalRow(1);
    assert.equal(assessProviderLookup({ candidate, profileCode: 'A', lookup: found() }).kind, 'match');
    assert.deepEqual(assessProviderLookup({ candidate, profileCode: 'A', lookup: found({ amount: 9999 }) }).mismatch, { amount: true, payment_link_id: false, provider_order_code: false });
    assert.deepEqual(assessProviderLookup({ candidate, profileCode: 'A', lookup: found({ id: 'other-link' }) }).mismatch, { amount: false, payment_link_id: true, provider_order_code: false });
    assert.deepEqual(assessProviderLookup({ candidate, profileCode: 'A', lookup: found({ orderCode: 9002 }) }).mismatch, { amount: false, payment_link_id: false, provider_order_code: true });
  });

  it('treats aliases as separate profiles; unknown and limit exhaustion fail closed', async () => {
    const fake = createFakePool({ profiles: ['A', 'B'] });
    const multi = await runProductionProviderResolutionAudit({ args: auditArgs(2), env: approvedEnvironment, pool: fake.pool, lookupTransaction: async () => found(), readPayOSCredentialFile: fakeCredentialReader(['A', 'B']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger });
    assert.equal(multi.report.provider_resolution.multi_profile_match, 1);
    const incomplete = await runProductionProviderResolutionAudit({ args: auditArgs(1), env: approvedEnvironment, pool: createFakePool({ rows: [canonicalRow(1), canonicalRow(2)], profiles: ['A', 'B'] }).pool, lookupTransaction: async () => ({ kind: 'unknown' }), readPayOSCredentialFile: fakeCredentialReader(['A', 'B']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger });
    assert.equal(incomplete.report.provider_resolution.audit_incomplete, true);
    assert.equal(incomplete.report.provider_resolution.zero_match, 0);
  });

  it('classifies every provider failure class without preserving provider error text', async () => {
    assert.deepEqual(classifyProviderLookupFailure({ status: 400 }), { kind: 'unknown', resultClass: 'HTTP_400' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 401 }), { kind: 'profile_error', resultClass: 'HTTP_401' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 403 }), { kind: 'profile_error', resultClass: 'HTTP_403' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 404 }), { kind: 'not_found', resultClass: 'HTTP_404' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 429 }), { kind: 'unknown', resultClass: 'HTTP_429' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 418 }), { kind: 'unknown', resultClass: 'HTTP_4XX_OTHER' });
    assert.deepEqual(classifyProviderLookupFailure({ status: 503 }), { kind: 'unknown', resultClass: 'HTTP_5XX' });
    assert.deepEqual(classifyProviderLookupFailure({ code: 'AUDIT_TIMEOUT' }), { kind: 'unknown', resultClass: 'TIMEOUT_OR_NETWORK' });
    assert.deepEqual(classifyProviderLookupFailure({ code: 'UNEXPECTED_SDK_FAILURE' }), {
      kind: 'unknown', resultClass: 'SDK_OR_INTERNAL', sdkMetadata: { error_name: 'UnknownError', error_code: 'UNEXPECTED_SDK_FAILURE', has_http_status: false },
    });
    const malformed = await lookupPayOSTransactionForAudit({
      profileCode: 'A', providerOrderCode: 9001,
      getPayOSForProfile: () => ({ paymentRequests: { get: async () => null } }),
    });
    assert.deepEqual(malformed, { kind: 'unknown', resultClass: 'MALFORMED_OR_EMPTY' });
    assert.deepEqual(
      assessProviderLookup({ candidate: canonicalRow(1), profileCode: 'A', lookup: { kind: 'found', payment: {} } }),
      { profileCode: 'A', kind: 'unknown', resultClass: 'MALFORMED_OR_EMPTY' },
    );
  });

  it('deduplicates only exactly equivalent credentials, fans out non-conclusive results, and keeps matching aliases multi-profile', async () => {
    const fake = createFakePool({ rows: [canonicalRow(1)], profiles: ['A', 'B', 'C'] });
    const calls = [];
    const nonConclusive = await runProductionProviderResolutionAudit({
      args: auditArgs(1), env: approvedEnvironment, pool: fake.pool,
      readPayOSCredentialFile: equivalentCredentialReader(), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
      lookupTransaction: async ({ profileCode }) => { calls.push(profileCode); return { kind: 'unknown', resultClass: 'HTTP_400' }; },
    });
    assert.deepEqual(calls, ['A']);
    assert.equal(nonConclusive.report.provider_resolution.physical_provider_get_count, 1);
    assert.equal(nonConclusive.report.provider_resolution.logical_lookup_pair_count, 3);
    assert.equal(nonConclusive.report.provider_resolution.provider_unknown_or_profile_error, 1);
    assert.deepEqual(nonConclusive.report.provider_resolution.credential_equivalence_groups, [{ credential_group: 'credential_group_A', profile_codes: ['A', 'B', 'C'] }]);
    assert.deepEqual(nonConclusive.report.provider_resolution.provider_result_breakdown, [
      { profile_code: 'A', result_class: 'HTTP_400', lookup_pair_count: 1, target_count: 1 },
      { profile_code: 'B', result_class: 'HTTP_400', lookup_pair_count: 1, target_count: 1 },
      { profile_code: 'C', result_class: 'HTTP_400', lookup_pair_count: 1, target_count: 1 },
    ]);

    const matching = await runProductionProviderResolutionAudit({
      args: auditArgs(1), env: approvedEnvironment, pool: createFakePool({ rows: [canonicalRow(1)], profiles: ['A', 'B', 'C'] }).pool,
      readPayOSCredentialFile: equivalentCredentialReader(), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
      lookupTransaction: async () => found(),
    });
    assert.equal(matching.report.provider_resolution.physical_provider_get_count, 1);
    assert.equal(matching.report.provider_resolution.logical_lookup_pair_count, 3);
    assert.equal(matching.report.provider_resolution.multi_profile_match, 1);
    assert.equal(matching.report.provider_resolution.unique_profile_resolved, 0);
  });

  it('reports SDK/internal metadata only as safe aggregate fields and never error messages', async () => {
    const fake = createFakePool({ rows: [canonicalRow(1)], profiles: ['A'] });
    const captured = captureLogger();
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(), env: approvedEnvironment, pool: fake.pool,
      readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captured.logger,
      lookupTransaction: async () => { throw Object.assign(new Error('order=9001&token=must-not-log'), { name: 'ConnectionError', code: 'SAFE_PROVIDER_CODE' }); },
    });
    assert.deepEqual(result.report.provider_resolution.sdk_internal_metadata_breakdown, [{
      error_name: 'ConnectionError', error_code: 'SAFE_PROVIDER_CODE', has_http_status: false, lookup_pair_count: 1, target_count: 1,
    }]);
    const unsafe = classifyProviderLookupFailure({ name: 'Error', code: 'order=9001&token=unsafe' });
    assert.equal(unsafe.sdkMetadata.error_code, null);
    assert.equal(`${captured.logs.join('\n')}\n${captured.errors.join('\n')}`.includes('must-not-log'), false);
  });

  it('aggregates only valid numeric HTTP status for SDK/internal errors without exposing error text', async () => {
    const fake = createFakePool({ rows: [canonicalRow(1)], profiles: ['A'] });
    const captured = captureLogger();
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(), env: approvedEnvironment, pool: fake.pool,
      readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captured.logger,
      lookupTransaction: async () => {
        throw Object.assign(new Error('order=9001&url=https://must-not-log.example'), {
          name: 'APIError', code: '101', status: 200,
        });
      },
    });

    assert.deepEqual(result.report.provider_resolution.sdk_internal_metadata_breakdown, [{
      error_name: 'APIError', error_code: '101', has_http_status: true, http_status: 200, lookup_pair_count: 1, target_count: 1,
    }]);
    const unsafeStatus = classifyProviderLookupFailure({ name: 'APIError', code: 'order=9001&token=unsafe', status: '200' });
    assert.equal(unsafeStatus.sdkMetadata.error_code, null);
    assert.equal(Object.hasOwn(unsafeStatus.sdkMetadata, 'http_status'), false);
    assert.equal(`${captured.logs.join('\n')}\n${captured.errors.join('\n')}`.includes('must-not-log'), false);
  });

  it('reports lookup-pair and distinct-target counts independently when one target has multiple result classes', async () => {
    const fake = createFakePool({ rows: [canonicalRow(1), canonicalRow(2)], profiles: ['A', 'B', 'C'] });
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(6), env: approvedEnvironment, pool: fake.pool,
      readPayOSCredentialFile: fakeCredentialReader(['A', 'B', 'C']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
      lookupTransaction: async ({ profileCode, providerOrderCode }) => {
        if (profileCode === 'A') return { kind: 'profile_error', resultClass: 'HTTP_401' };
        if (profileCode === 'B' && providerOrderCode === 9001) return { kind: 'unknown', resultClass: 'HTTP_429' };
        if (profileCode === 'B') return { kind: 'unknown', resultClass: 'MALFORMED_OR_EMPTY' };
        return { kind: 'unknown', resultClass: 'SDK_OR_INTERNAL' };
      },
    });
    const breakdown = result.report.provider_resolution.provider_result_breakdown;
    assert.equal(result.report.provider_resolution.physical_provider_get_count, 6, 'different credential triples must not be deduplicated');
    assert.equal(result.report.provider_resolution.logical_lookup_pair_count, 6);
    assert.deepEqual(breakdown, [
      { profile_code: 'A', result_class: 'HTTP_401', lookup_pair_count: 2, target_count: 2 },
      { profile_code: 'B', result_class: 'HTTP_429', lookup_pair_count: 1, target_count: 1 },
      { profile_code: 'B', result_class: 'MALFORMED_OR_EMPTY', lookup_pair_count: 1, target_count: 1 },
      { profile_code: 'C', result_class: 'SDK_OR_INTERNAL', lookup_pair_count: 2, target_count: 2 },
    ]);
    assert.equal(result.report.provider_resolution.provider_unknown_or_profile_error, 2);
  });

  it('aggregates identity mismatch fields by profile without raw payment identifiers', async () => {
    const fake = createFakePool({ rows: [canonicalRow(1)], profiles: ['A', 'B', 'C'] });
    const result = await runProductionProviderResolutionAudit({
      args: auditArgs(3), env: approvedEnvironment, pool: fake.pool,
      readPayOSCredentialFile: fakeCredentialReader(['A', 'B', 'C']), loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
      lookupTransaction: async ({ profileCode }) => {
        if (profileCode === 'A') return found({ amount: 9999 });
        if (profileCode === 'B') return found({ id: 'different-link' });
        return found({ orderCode: 9999 });
      },
    });
    assert.deepEqual(result.report.provider_resolution.identity_mismatch_breakdown, {
      identity_mismatch_lookup_pair_count: 3,
      identity_mismatch_target_count: 1,
      by_field: [
        { profile_code: 'A', mismatch_field: 'amount', lookup_pair_count: 1, target_count: 1 },
        { profile_code: 'B', mismatch_field: 'payment_link_id', lookup_pair_count: 1, target_count: 1 },
        { profile_code: 'C', mismatch_field: 'provider_order_code', lookup_pair_count: 1, target_count: 1 },
      ],
    });
  });

  it('groups equivalent credentials anonymously and keeps non-equivalent profile sets separate', () => {
    const groups = buildCredentialEquivalenceGroups(new Map([
      ['A', { clientId: 'same-client', apiKey: 'same-key', checksumKey: 'same-checksum' }],
      ['B', { clientId: 'same-client', apiKey: 'same-key', checksumKey: 'same-checksum' }],
      ['C', { clientId: 'other-client', apiKey: 'other-key', checksumKey: 'other-checksum' }],
    ]), ['A', 'B', 'C']);
    assert.deepEqual(groups, [
      { credential_group: 'credential_group_A', profile_codes: ['A', 'B'] },
      { credential_group: 'credential_group_B', profile_codes: ['C'] },
    ]);
    assert.doesNotMatch(JSON.stringify(groups), /same-client|same-key|checksum|other-client/);
  });

  it('keeps canonical/history SQL CTE/SELECT-only, free of category mapping, and does not log raw identities or secrets', async () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const [canonicalSql, historySql] = await Promise.all([
      readFile(path.join(root, '..', 'database', 'postgres', 'verification', '0026_payment_attempts_legacy_blocker_audit_readonly.sql'), 'utf8'),
      readFile(path.join(root, '..', 'database', 'postgres', 'verification', '0026_ambiguous_legacy_history_audit_readonly.sql'), 'utf8'),
    ]);
    for (const sql of [canonicalSql, historySql]) {
      assert.match(sql, /^\s*--[\s\S]*WITH /m);
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
      assert.doesNotMatch(sql, /\b(?:categories|category_payment_profiles|root_category_id)\b/i);
    }
    const captured = captureLogger();
    await runProductionProviderResolutionAudit({ args: auditArgs(), env: approvedEnvironment, pool: createFakePool({ profiles: ['A'] }).pool, lookupTransaction: async () => found({ orderCode: 998877, id: 'secret-link' }), readPayOSCredentialFile: fakeCredentialReader(['A']), loadRuntimeModules: fakeRuntime(), logger: captured.logger });
    const output = `${captured.logs.join('\n')}\n${captured.errors.join('\n')}`;
    assert.doesNotMatch(output, /release_user|release_secret|998877|secret-link|client|checksum/);
  });
});
