import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assessProviderLookup,
  classifyProviderLookupFailure,
  parseProductionProviderResolutionAuditArgs,
  runProductionProviderResolutionAudit,
} from '../database/postgres/audit-production-provider-resolution.js';

const approvedEnvironment = Object.freeze({
  NODE_ENV: 'production', MIGRATION_MODE: 'production', POSTGRES_PRODUCTION_MIGRATIONS: '1', PRODUCTION_PAYOS_AUDIT: '1',
  PRODUCTION_DATABASE_URL: 'postgresql://release_user:release_secret@prod.db.example:5432/teaplus',
  POSTGRES_PRODUCTION_ALLOWED_HOSTS: 'prod.db.example', POSTGRES_PRODUCTION_ALLOWED_DATABASES: 'teaplus',
  TEST_DATABASE_URL: null, POSTGRES_INTEGRATION: null,
});

function candidate(id, providerOrderCode = 9001) {
  return { target_kind: 'direct_order', target_id: id, provider_order_code: providerOrderCode, expected_amount: '10000', expected_payment_link_id: 'link-1' };
}

function createFakePool({ candidates = [candidate(1)], profiles = ['A', 'B'], history = { summary: { ambiguous_block_targets: 27 } } } = {}) {
  const calls = [];
  let connectCalls = 0;
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('0026 provider-resolution candidates')) return { rows: candidates };
      if (sql === 'SELECT code FROM payment_profiles ORDER BY code ASC') return { rows: profiles.map((code) => ({ code })) };
      if (sql.includes('0026 ambiguous legacy-history audit')) return { rows: [{ report: history }] };
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

describe('production provider-resolution audit', () => {
  it('requires explicit audit, lookup cap, audit opt-in, and shared production guard before connect', async () => {
    assert.deepEqual(parseProductionProviderResolutionAuditArgs(['--audit=0026-provider-resolution', '--max-provider-lookups=10']), { audit: '0026-provider-resolution', maxProviderLookups: 10 });
    assert.throws(() => parseProductionProviderResolutionAuditArgs(['--audit=0026-provider-resolution']), /max-provider-lookups/);
    const fake = createFakePool();
    await assert.rejects(() => runProductionProviderResolutionAudit({ args: ['--audit=0026-provider-resolution', '--max-provider-lookups=1'], env: { ...approvedEnvironment, PRODUCTION_PAYOS_AUDIT: '0' }, pool: fake.pool, logger: captureLogger().logger }), /PRODUCTION_PAYOS_AUDIT=1/);
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('requires exact order, amount, and persisted link identity for a provider match', () => {
    assert.equal(assessProviderLookup({ candidate: candidate(1), profileCode: 'A', lookup: found() }).kind, 'match');
    assert.equal(assessProviderLookup({ candidate: candidate(1), profileCode: 'A', lookup: found({ amount: 9999 }) }).kind, 'identity_mismatch');
    assert.equal(assessProviderLookup({ candidate: candidate(1), profileCode: 'A', lookup: found({ id: 'other-link' }) }).kind, 'identity_mismatch');
    assert.equal(assessProviderLookup({ candidate: candidate(1), profileCode: 'A', lookup: found({ orderCode: 9002 }) }).kind, 'identity_mismatch');
  });

  it('treats credential aliases as separate profiles and fails closed on multiple matches', async () => {
    const fake = createFakePool();
    const captured = captureLogger();
    const result = await runProductionProviderResolutionAudit({
      args: ['--audit=0026-provider-resolution', '--max-provider-lookups=2'], env: approvedEnvironment, pool: fake.pool,
      lookupTransaction: async () => found(), isProfileConfigured: () => true, logger: captured.logger,
    });
    assert.equal(result.report.provider_resolution.multi_profile_match, 1);
    assert.equal(result.report.provider_resolution.unique_profile_resolved, 0);
  });

  it('does not resolve one match when another configured profile is unknown, including 401/403/429/malformed responses', async () => {
    const scenarios = [
      { kind: 'unknown' }, { kind: 'profile_error' }, { kind: 'unknown' }, { kind: 'unknown' },
    ];
    for (const second of scenarios) {
      const fake = createFakePool();
      let call = 0;
      const result = await runProductionProviderResolutionAudit({
        args: ['--audit=0026-provider-resolution', '--max-provider-lookups=2'], env: approvedEnvironment, pool: fake.pool,
        lookupTransaction: async () => (call++ === 0 ? found() : second), isProfileConfigured: () => true, logger: captureLogger().logger,
      });
      assert.equal(result.report.provider_resolution.unique_profile_resolved, 0);
      assert.equal(result.report.provider_resolution.provider_unknown_or_profile_error, 1);
    }
  });

  it('counts only explicit not-found as zero match and never converts timeout/network failures into not-found', async () => {
    const fake = createFakePool({ profiles: ['A'] });
    const notFound = await runProductionProviderResolutionAudit({
      args: ['--audit=0026-provider-resolution', '--max-provider-lookups=1'], env: approvedEnvironment, pool: fake.pool,
      lookupTransaction: async () => ({ kind: 'not_found' }), isProfileConfigured: () => true, logger: captureLogger().logger,
    });
    assert.equal(notFound.report.provider_resolution.zero_match, 1);
    const uncertain = await runProductionProviderResolutionAudit({
      args: ['--audit=0026-provider-resolution', '--max-provider-lookups=1'], env: approvedEnvironment, pool: createFakePool({ profiles: ['A'] }).pool,
      lookupTransaction: async () => ({ kind: 'unknown' }), isProfileConfigured: () => true, logger: captureLogger().logger,
    });
    assert.equal(uncertain.report.provider_resolution.zero_match, 0);
    assert.equal(uncertain.report.provider_resolution.provider_unknown_or_profile_error, 1);
  });

  it('reports audit incomplete and unchecked pairs when the explicit lookup limit is exhausted', async () => {
    const fake = createFakePool({ candidates: [candidate(1), candidate(2)], profiles: ['A', 'B'] });
    const result = await runProductionProviderResolutionAudit({
      args: ['--audit=0026-provider-resolution', '--max-provider-lookups=1'], env: approvedEnvironment, pool: fake.pool,
      lookupTransaction: async () => found(), isProfileConfigured: () => true, logger: captureLogger().logger,
    });
    const report = result.report.provider_resolution;
    assert.equal(report.audit_incomplete, true);
    assert.equal(report.unchecked_target_profile_pairs_due_to_limit, 3);
    assert.equal(report.unchecked_targets_due_to_limit, 2);
    assert.equal(report.zero_match, 0);
  });

  it('keeps both SQL files CTE/SELECT-only, has no category mapping, and does not log raw identities or secrets', async () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const [candidateSql, historySql] = await Promise.all([
      readFile(path.join(root, '..', 'database', 'postgres', 'verification', '0026_provider_resolution_candidates_readonly.sql'), 'utf8'),
      readFile(path.join(root, '..', 'database', 'postgres', 'verification', '0026_ambiguous_legacy_history_audit_readonly.sql'), 'utf8'),
    ]);
    for (const sql of [candidateSql, historySql]) {
      assert.match(sql, /^\s*--[\s\S]*WITH /m);
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
      assert.doesNotMatch(sql, /\b(?:categories|category_payment_profiles|root_category_id)\b/i);
    }
    const fake = createFakePool({ profiles: ['A'] });
    const captured = captureLogger();
    await runProductionProviderResolutionAudit({
      args: ['--audit=0026-provider-resolution', '--max-provider-lookups=1'], env: approvedEnvironment, pool: fake.pool,
      lookupTransaction: async () => found({ orderCode: 998877, id: 'secret-link', amount: 10000 }), isProfileConfigured: () => true, logger: captured.logger,
    });
    const output = `${captured.logs.join('\n')}\n${captured.errors.join('\n')}`;
    assert.equal(output.includes('release_user'), false);
    assert.equal(output.includes('release_secret'), false);
    assert.equal(output.includes('998877'), false);
    assert.equal(output.includes('secret-link'), false);
    assert.equal(output.includes('payment_qr_code'), false);
  });

  it('classifies only explicit 404 as not-found and treats 401/403 as profile errors plus 429/5xx/timeouts as unknown', () => {
    assert.equal(classifyProviderLookupFailure({ status: 404 }).kind, 'not_found');
    assert.equal(classifyProviderLookupFailure({ status: 401 }).kind, 'profile_error');
    assert.equal(classifyProviderLookupFailure({ status: 403 }).kind, 'profile_error');
    assert.equal(classifyProviderLookupFailure({ status: 429 }).kind, 'unknown');
    assert.equal(classifyProviderLookupFailure({ status: 500 }).kind, 'unknown');
    assert.equal(classifyProviderLookupFailure({ code: 'AUDIT_TIMEOUT' }).kind, 'unknown');
  });
});
