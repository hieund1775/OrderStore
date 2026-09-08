import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  parseProductionLegacyFinalDecisionAuditArgs,
  runProductionLegacyFinalDecisionAudit,
} from '../database/postgres/audit-production-legacy-payment-final-decision.js';

const approvedEnvironment = Object.freeze({
  NODE_ENV: 'production',
  MIGRATION_MODE: 'production',
  POSTGRES_PRODUCTION_MIGRATIONS: '1',
  PRODUCTION_LEGACY_DECISION_AUDIT: '1',
  PRODUCTION_DATABASE_URL: 'postgresql://release_user:release_secret@prod.db.example:5432/teaplus',
  POSTGRES_PRODUCTION_ALLOWED_HOSTS: 'prod.db.example',
  POSTGRES_PRODUCTION_ALLOWED_DATABASES: 'teaplus',
  TEST_DATABASE_URL: null,
  POSTGRES_INTEGRATION: null,
});

function canonicalRow(id, classification = 'ACTIVE_PAYMENT_REQUIRES_REPAIR') {
  return {
    target_kind: id % 2 ? 'direct_order' : 'checkout_group',
    target_id: id,
    provider_order_code: 9000 + id,
    expected_payment_link_id: `internal-link-${id}`,
    transaction_id: `internal-transaction-${id}`,
    classification,
    reconciliation_needed: classification === 'ACTIVE_PAYMENT_REQUIRES_REPAIR',
  };
}

function finalReport({
  inputCount = 1,
  distinctCount = inputCount,
  resolvedCount = inputCount,
  unresolvedCount = inputCount - resolvedCount,
  missingCount = 0,
  extraCount = 0,
  kindMismatchCount = 0,
  classes = [],
} = {}) {
  return {
    input_diagnostics: {
      canonical_active_count: inputCount,
      serialized_input_count: inputCount,
      distinct_input_target_count: distinctCount,
      duplicate_input_count: inputCount - distinctCount,
      detail_resolved_count: resolvedCount,
      unresolved_input_count: unresolvedCount,
      missing_from_detail_count: missingCount,
      unexpected_extra_detail_count: extraCount,
      target_kind_mismatch_count: kindMismatchCount,
      by_target_kind: [{
        target_kind: 'direct_order', serialized_input_count: inputCount,
        distinct_input_target_count: distinctCount, duplicate_input_count: inputCount - distinctCount,
        detail_resolved_count: resolvedCount, unresolved_input_count: unresolvedCount,
        missing_from_detail_count: missingCount, unexpected_extra_detail_count: extraCount,
        target_kind_mismatch_count: kindMismatchCount,
      }],
    },
    age_breakdown: [{ artifact_age_bucket: 'GT_30D', target_count: inputCount }],
    payment_status_breakdown: [{ payment_status: 'unpaid', target_count: inputCount }],
    lifecycle_status_breakdown: [{ lifecycle_status: 'NOT_APPLICABLE_OR_UNKNOWN', target_count: inputCount }],
    expiry_breakdown: [{ expiry_state: 'EXPIRED', target_count: inputCount }],
    payos_artifact_breakdown: [{ has_payos_artifact: true, target_count: inputCount }],
    post_expiry_payment_evidence_breakdown: [{ has_payment_event_after_expiry: false, has_processed_paid_event: false, has_payment_evidence: false, target_count: inputCount }],
    payment_or_lifecycle_change_after_artifact_breakdown: [{ has_payment_or_lifecycle_change_after_artifact: false, target_count: inputCount }],
    final_classification_counts: classes.length ? classes : [{ final_classification: 'STALE_LEGACY_SAFE_TO_QUARANTINE', target_count: inputCount }],
    remediation_decision: 'PROPOSE_ADDITIVE_QUARANTINE_ONLY',
  };
}

function createFakePool({ rows = [canonicalRow(1)], report = finalReport() } = {}) {
  const calls = [];
  let connectCalls = 0;
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('P1 / 0026 canonical legacy blocker classification')) return { rows };
      if (sql.includes('P1 / 0026 final decision audit')) return { rows: [{ report }] };
      return { rows: [] };
    },
    release() {},
  };
  return {
    pool: { async connect() { connectCalls += 1; return client; }, async end() {} },
    calls,
    getConnectCalls: () => connectCalls,
  };
}

function captureLogger() {
  const logs = []; const errors = [];
  return { logger: { log: (...args) => logs.push(args.join(' ')), error: (...args) => errors.push(args.join(' ')) }, logs, errors };
}

function fakeRuntime(onImport = null) {
  return async () => {
    onImport?.();
    return {
      Pool: class Pool {},
      getPostgresPoolConfig: (url) => ({ connectionString: url }),
    };
  };
}

describe('production legacy final decision audit', () => {
  it('accepts only the explicit DB-only audit command', () => {
    assert.deepEqual(parseProductionLegacyFinalDecisionAuditArgs(['--audit=0026-final-decision']), { audit: '0026-final-decision' });
    assert.throws(() => parseProductionLegacyFinalDecisionAuditArgs([]), /only --audit=0026-final-decision/);
    assert.throws(() => parseProductionLegacyFinalDecisionAuditArgs(['--apply']), /only --audit=0026-final-decision/);
  });

  it('fails guard and explicit opt-in before runtime import or DB connect', async () => {
    const fake = createFakePool();
    let runtimeImported = false;
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'],
      env: { ...approvedEnvironment, PRODUCTION_LEGACY_DECISION_AUDIT: '0' },
      pool: fake.pool,
      loadRuntimeModules: fakeRuntime(() => { runtimeImported = true; }),
      logger: captureLogger().logger,
    }), /PRODUCTION_LEGACY_DECISION_AUDIT=1/);
    assert.equal(runtimeImported, false);
    assert.equal(fake.getConnectCalls(), 0);

    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'],
      env: { ...approvedEnvironment, TEST_DATABASE_URL: 'postgresql://test.example/test' },
      pool: fake.pool,
      logger: captureLogger().logger,
    }), /test migration variables must not be present/);
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('uses the exact canonical active input, reports aggregates only, and never mutates', async () => {
    const rows = [
      ...Array.from({ length: 100 }, (_, index) => canonicalRow(index + 1)),
      ...Array.from({ length: 27 }, (_, index) => canonicalRow(200 + index, 'AMBIGUOUS_BLOCK')),
    ];
    const fake = createFakePool({ rows, report: finalReport({ inputCount: 100 }) });
    const captured = captureLogger();
    let receivedConfig = null;
    const result = await runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'],
      env: { ...approvedEnvironment, DATABASE_URL: 'postgresql://wrong_user:wrong_secret@wrong.db.example:5432/wrong_database' },
      createPool(config) { receivedConfig = config; return fake.pool; },
      loadRuntimeModules: fakeRuntime(),
      logger: captured.logger,
    });

    assert.equal(result.report.input_diagnostics.canonical_active_count, 100);
    assert.equal(receivedConfig.connectionString, approvedEnvironment.PRODUCTION_DATABASE_URL);
    const detailCall = fake.calls.find((call) => call.sql.includes('P1 / 0026 final decision audit'));
    assert.equal(JSON.parse(detailCall.params[0]).length, 100, 'detail audit receives only the canonical ACTIVE set');
    assert.equal(detailCall.params[1], 100);
    assert.equal(fake.calls.some((call) => /\b(?:BEGIN|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|COMMIT|ROLLBACK)\b/i.test(call.sql)), false);
    const output = `${captured.logs.join('\n')}\n${captured.errors.join('\n')}`;
    assert.match(output, /host=prod\.db\.example, database=teaplus/);
    assert.equal(output.includes('release_secret'), false);
    assert.equal(output.includes('wrong_secret'), false);
    assert.equal(output.includes('internal-link-1'), false);
    assert.equal(output.includes('internal-transaction-1'), false);
  });

  it('fails closed when canonical active input drifts, duplicates, or does not resolve', async () => {
    const drift = createFakePool({ rows: [canonicalRow(1)], report: finalReport({ inputCount: 1, resolvedCount: 0, unresolvedCount: 1, missingCount: 1 }) });
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: drift.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /input drift detected/);

    const duplicate = createFakePool({ rows: [canonicalRow(1), canonicalRow(1)], report: finalReport({ inputCount: 2, distinctCount: 1, resolvedCount: 2 }) });
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: duplicate.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /input drift detected/);
  });

  it('reproduces old UNION fan-out diagnostics and accepts exactly one detail row per valid target after branch filters', async () => {
    const oldFanout = createFakePool({ rows: [canonicalRow(1)], report: finalReport({ inputCount: 1, resolvedCount: 1, extraCount: 1 }) });
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: oldFanout.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /input drift detected/);

    const direct = canonicalRow(1);
    const group = canonicalRow(2);
    const fixed = createFakePool({ rows: [direct, group], report: finalReport({
      inputCount: 2,
      classes: [{ final_classification: 'STALE_LEGACY_SAFE_TO_QUARANTINE', target_count: 2 }],
    }) });
    const result = await runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: fixed.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    });
    assert.equal(result.report.input_diagnostics.unexpected_extra_detail_count, 0);
    assert.equal(result.report.input_diagnostics.detail_resolved_count, 2);
  });

  it('keeps final SQL CTE/SELECT-only, category-free, and ordered by the safe classification precedence', async () => {
    const currentFile = fileURLToPath(import.meta.url);
    const sql = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'verification', '0026_active_legacy_payment_final_decision_audit_readonly.sql'), 'utf8');
    assert.match(sql, /^\s*--[\s\S]*WITH serialized_input AS/m);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
    assert.doesNotMatch(sql, /\b(?:categories|category_payment_profiles|root_category_id|updated_at)\b/i);
    assert.doesNotMatch(sql, /\b(?:customer_name|customer_phone|order_code|group_code|receiver_account_number)\b/i);
    assert.match(sql, /FROM serialized_input si[\s\S]*WHERE si\.target_kind = 'direct_order'[\s\S]*UNION ALL[\s\S]*FROM serialized_input si[\s\S]*WHERE si\.target_kind = 'checkout_group'/);
    const evidenceIndex = sql.indexOf("WHEN has_payment_evidence THEN 'HAS_PAYMENT_EVIDENCE'");
    const recentIndex = sql.indexOf("THEN 'RECENT_OR_POTENTIALLY_LIVE'");
    const staleIndex = sql.indexOf("THEN 'STALE_LEGACY_SAFE_TO_QUARANTINE'");
    const unresolvedIndex = sql.indexOf("ELSE 'UNRESOLVED'");
    assert.ok(evidenceIndex >= 0 && evidenceIndex < recentIndex && recentIndex < staleIndex && staleIndex < unresolvedIndex);
    assert.match(sql, /payment_expires_at IS NOT NULL[\s\S]*payment_expires_at <= CURRENT_TIMESTAMP[\s\S]*payment_status IN \('unpaid', 'expired'\)[\s\S]*NOT has_payment_evidence[\s\S]*NOT has_payment_or_lifecycle_change_after_artifact/);
  });
});
