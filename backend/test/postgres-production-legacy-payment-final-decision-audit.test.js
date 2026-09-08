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
  paymentEvidenceExplanation = null,
  recentLiveExplanation = null,
  ageByFinalClassification = null,
  unresolvedEvidenceDeepExplanation = null,
  multiplePredicatesChangeExplanation = null,
} = {}) {
  const finalClasses = classes.length ? classes : [{ final_classification: 'STALE_LEGACY_SAFE_TO_QUARANTINE', target_count: inputCount }];
  const classifiedCount = (classification) => finalClasses
    .filter((row) => row.final_classification === classification)
    .reduce((total, row) => total + Number(row.target_count || 0), 0);
  const evidenceTargetCount = classifiedCount('HAS_PAYMENT_EVIDENCE');
  const recentTargetCount = classifiedCount('RECENT_OR_POTENTIALLY_LIVE');
  const resolvedPaymentEvidenceExplanation = paymentEvidenceExplanation || {
    target_count: evidenceTargetCount,
    source_counts: {
      paid_at_present: 0, payment_status_paid: 0, matched_successful_payment_event: 0,
      processed_paid_event: 0, matched_payment_event: 0,
    },
    overlap: evidenceTargetCount ? [{ paid_at_present: false, payment_status_paid: false, matched_payment_event: true, has_matched_successful_payment_event: true, has_processed_paid_event: true, target_count: evidenceTargetCount }] : [],
  };
  const resolvedRecentLiveExplanation = recentLiveExplanation || {
    target_count: recentTargetCount,
    predicate_counts: {
      artifact_age_lt_30d: 0, expiry_still_live: 0, payment_or_lifecycle_change_after_artifact: 0,
    },
    reason_counts: recentTargetCount ? [{ reason: 'RECENCY_ONLY', target_count: recentTargetCount }] : [],
    predicate_overlap: recentTargetCount ? [{ artifact_age_lt_30d: true, expiry_still_live: false, has_payment_or_lifecycle_change_after_artifact: false, target_count: recentTargetCount }] : [],
  };
  const multipleTargetCount = resolvedRecentLiveExplanation.reason_counts
    .filter((row) => row.reason === 'MULTIPLE_PREDICATES')
    .reduce((total, row) => total + Number(row.target_count || 0), 0);
  const simpleBreakdown = (field, count) => count ? [{ [field]: 'NOT_DETERMINABLE_LEGACY', target_count: count }] : [];
  const resolvedDeepExplanation = unresolvedEvidenceDeepExplanation || {
    has_payment_evidence_target_count: evidenceTargetCount,
    event_type_group_counts: simpleBreakdown('event_type_group', evidenceTargetCount),
    processing_status_counts: simpleBreakdown('processing_status', evidenceTargetCount),
    business_code_state_counts: simpleBreakdown('business_code_state', evidenceTargetCount),
    provider_status_state_counts: simpleBreakdown('provider_status_state', evidenceTargetCount),
    artifact_timing_counts: simpleBreakdown('artifact_timing_state', evidenceTargetCount),
    expiry_timing_counts: simpleBreakdown('expiry_timing_state', evidenceTargetCount),
    amount_match_counts: simpleBreakdown('amount_match_state', evidenceTargetCount),
    target_identity_match_counts: simpleBreakdown('target_identity_match_state', evidenceTargetCount),
    profile_evidence_state_counts: simpleBreakdown('profile_evidence_state', evidenceTargetCount),
    p1_transition_interpretation_counts: simpleBreakdown('p1_transition_interpretation', evidenceTargetCount),
    overlap: evidenceTargetCount ? [{ target_count: evidenceTargetCount }] : [],
  };
  const resolvedMultipleExplanation = multiplePredicatesChangeExplanation || {
    target_count: multipleTargetCount,
    source_counts: {
      paid_at_after_artifact: 0, matched_payment_event_after_artifact: 0, lifecycle_change_after_artifact: 0,
    },
    overlap: multipleTargetCount ? [{ paid_at_after_artifact: false, matched_payment_event_after_artifact: true, lifecycle_change_after_artifact: false, target_count: multipleTargetCount }] : [],
  };
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
    final_classification_counts: finalClasses,
    payment_evidence_explanation: resolvedPaymentEvidenceExplanation,
    recent_live_explanation: resolvedRecentLiveExplanation,
    age_by_final_classification: ageByFinalClassification || [
      ...(evidenceTargetCount ? [{ final_classification: 'HAS_PAYMENT_EVIDENCE', artifact_age_bucket: 'D8_TO_D30', target_count: evidenceTargetCount }] : []),
      ...(recentTargetCount ? [{ final_classification: 'RECENT_OR_POTENTIALLY_LIVE', artifact_age_bucket: 'D8_TO_D30', target_count: recentTargetCount }] : []),
    ],
    unresolved_evidence_deep_explanation: resolvedDeepExplanation,
    multiple_predicates_change_explanation: resolvedMultipleExplanation,
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

  it('accepts evidence/recent overlap aggregates only when each class total remains exact', async () => {
    const rows = Array.from({ length: 100 }, (_, index) => canonicalRow(index + 1));
    const report = finalReport({
      inputCount: 100,
      classes: [
        { final_classification: 'HAS_PAYMENT_EVIDENCE', target_count: 27 },
        { final_classification: 'RECENT_OR_POTENTIALLY_LIVE', target_count: 73 },
      ],
      paymentEvidenceExplanation: {
        target_count: 27,
        source_counts: {
          paid_at_present: 7, payment_status_paid: 7, matched_successful_payment_event: 27,
          processed_paid_event: 19, matched_payment_event: 27,
        },
        overlap: [
          { paid_at_present: true, payment_status_paid: true, matched_payment_event: true, has_matched_successful_payment_event: true, has_processed_paid_event: true, target_count: 7 },
          { paid_at_present: false, payment_status_paid: false, matched_payment_event: true, has_matched_successful_payment_event: true, has_processed_paid_event: true, target_count: 12 },
          { paid_at_present: false, payment_status_paid: false, matched_payment_event: true, has_matched_successful_payment_event: true, has_processed_paid_event: false, target_count: 8 },
        ],
      },
      recentLiveExplanation: {
        target_count: 73,
        predicate_counts: {
          artifact_age_lt_30d: 73, expiry_still_live: 0, payment_or_lifecycle_change_after_artifact: 0,
        },
        reason_counts: [{ reason: 'RECENCY_ONLY', target_count: 73 }],
        predicate_overlap: [{ artifact_age_lt_30d: true, expiry_still_live: false, has_payment_or_lifecycle_change_after_artifact: false, target_count: 73 }],
      },
      ageByFinalClassification: [
        { final_classification: 'HAS_PAYMENT_EVIDENCE', artifact_age_bucket: 'D1_TO_D7', target_count: 7 },
        { final_classification: 'HAS_PAYMENT_EVIDENCE', artifact_age_bucket: 'D8_TO_D30', target_count: 20 },
        { final_classification: 'RECENT_OR_POTENTIALLY_LIVE', artifact_age_bucket: 'D1_TO_D7', target_count: 24 },
        { final_classification: 'RECENT_OR_POTENTIALLY_LIVE', artifact_age_bucket: 'D8_TO_D30', target_count: 49 },
      ],
    });
    const good = createFakePool({ rows, report });
    const result = await runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: good.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    });
    assert.equal(result.report.payment_evidence_explanation.overlap.length, 3);
    assert.equal(result.report.recent_live_explanation.reason_counts[0].reason, 'RECENCY_ONLY');

    const invalid = createFakePool({
      rows,
      report: finalReport({
        inputCount: 100,
        classes: [{ final_classification: 'HAS_PAYMENT_EVIDENCE', target_count: 27 }, { final_classification: 'RECENT_OR_POTENTIALLY_LIVE', target_count: 73 }],
        paymentEvidenceExplanation: { ...report.payment_evidence_explanation, overlap: [{ target_count: 26 }] },
        recentLiveExplanation: report.recent_live_explanation,
        ageByFinalClassification: report.age_by_final_classification,
      }),
    });
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: invalid.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /input drift detected/);
  });

  it('requires aggregate-only evidence gates and post-artifact changes to reconcile exactly', async () => {
    const rows = Array.from({ length: 29 }, (_, index) => canonicalRow(index + 1));
    const deep = {
      has_payment_evidence_target_count: 27,
      event_type_group_counts: [{ event_type_group: 'PAYMENT_SUCCEEDED', target_count: 27 }],
      processing_status_counts: [{ processing_status: 'PROCESSED', target_count: 27 }],
      business_code_state_counts: [{ business_code_state: 'CODE_00', target_count: 24 }, { business_code_state: 'NON_00_OR_OTHER', target_count: 3 }],
      provider_status_state_counts: [{ provider_status_state: 'PAID', target_count: 27 }],
      artifact_timing_counts: [{ artifact_timing_state: 'AFTER_ARTIFACT', target_count: 27 }],
      expiry_timing_counts: [{ expiry_timing_state: 'AFTER_EXPIRY', target_count: 27 }],
      amount_match_counts: [{ amount_match_state: 'MATCH', target_count: 27 }],
      target_identity_match_counts: [{ target_identity_match_state: 'DIRECT_TARGET_MATCH', target_count: 27 }],
      profile_evidence_state_counts: [{ profile_evidence_state: 'NOT_DETERMINABLE_NO_PROFILE_SNAPSHOT', target_count: 27 }],
      p1_transition_interpretation_counts: [
        { p1_transition_interpretation: 'NOT_DETERMINABLE_LEGACY_SNAPSHOT_MISSING', target_count: 24 },
        { p1_transition_interpretation: 'WOULD_NOT_TRANSITION', target_count: 3 },
      ],
      overlap: [
        { event_type_group: 'PAYMENT_SUCCEEDED', processing_status: 'PROCESSED', business_code_state: 'CODE_00', provider_status_state: 'PAID', artifact_timing_state: 'AFTER_ARTIFACT', expiry_timing_state: 'AFTER_EXPIRY', amount_match_state: 'MATCH', target_identity_match_state: 'DIRECT_TARGET_MATCH', profile_evidence_state: 'NOT_DETERMINABLE_NO_PROFILE_SNAPSHOT', p1_transition_interpretation: 'NOT_DETERMINABLE_LEGACY_SNAPSHOT_MISSING', target_count: 24 },
        { event_type_group: 'PAYMENT_SUCCEEDED', processing_status: 'PROCESSED', business_code_state: 'NON_00_OR_OTHER', provider_status_state: 'PAID', artifact_timing_state: 'AFTER_ARTIFACT', expiry_timing_state: 'AFTER_EXPIRY', amount_match_state: 'MATCH', target_identity_match_state: 'DIRECT_TARGET_MATCH', profile_evidence_state: 'NOT_DETERMINABLE_NO_PROFILE_SNAPSHOT', p1_transition_interpretation: 'WOULD_NOT_TRANSITION', target_count: 3 },
      ],
    };
    const changes = {
      target_count: 2,
      source_counts: {
        paid_at_after_artifact: 0,
        matched_payment_event_after_artifact: 2,
        lifecycle_change_after_artifact: 1,
      },
      overlap: [
        { paid_at_after_artifact: false, matched_payment_event_after_artifact: true, lifecycle_change_after_artifact: false, target_count: 1 },
        { paid_at_after_artifact: false, matched_payment_event_after_artifact: true, lifecycle_change_after_artifact: true, target_count: 1 },
      ],
    };
    const report = finalReport({
      inputCount: 29,
      classes: [
        { final_classification: 'HAS_PAYMENT_EVIDENCE', target_count: 27 },
        { final_classification: 'RECENT_OR_POTENTIALLY_LIVE', target_count: 2 },
      ],
      recentLiveExplanation: {
        target_count: 2,
        predicate_counts: {
          artifact_age_lt_30d: 2, expiry_still_live: 0, payment_or_lifecycle_change_after_artifact: 2,
        },
        reason_counts: [{ reason: 'MULTIPLE_PREDICATES', target_count: 2 }],
        predicate_overlap: [{ artifact_age_lt_30d: true, expiry_still_live: false, has_payment_or_lifecycle_change_after_artifact: true, target_count: 2 }],
      },
      unresolvedEvidenceDeepExplanation: deep,
      multiplePredicatesChangeExplanation: changes,
    });
    const good = createFakePool({ rows, report });
    await runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: good.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    });

    const invalid = createFakePool({
      rows,
      report: finalReport({
        inputCount: 29,
        classes: report.final_classification_counts,
        recentLiveExplanation: report.recent_live_explanation,
        unresolvedEvidenceDeepExplanation: { ...deep, overlap: [{ target_count: 26 }] },
        multiplePredicatesChangeExplanation: changes,
      }),
    });
    await assert.rejects(() => runProductionLegacyFinalDecisionAudit({
      args: ['--audit=0026-final-decision'], env: approvedEnvironment, pool: invalid.pool,
      loadRuntimeModules: fakeRuntime(), logger: captureLogger().logger,
    }), /input drift detected/);
  });

  it('keeps final SQL CTE/SELECT-only, category-free, and ordered by the safe classification precedence', async () => {
    const currentFile = fileURLToPath(import.meta.url);
    const sql = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'verification', '0026_active_legacy_payment_final_decision_audit_readonly.sql'), 'utf8');
    assert.match(sql, /^\s*--[\s\S]*WITH serialized_input AS/m);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
    assert.doesNotMatch(sql, /\b(?:categories|category_payment_profiles|root_category_id|updated_at)\b/i);
    assert.doesNotMatch(sql, /\b(?:customer_name|customer_phone|order_code|group_code|receiver_account_number)\b/i);
    assert.match(sql, /FROM serialized_input si[\s\S]*WHERE si\.target_kind = 'direct_order'[\s\S]*UNION ALL[\s\S]*FROM serialized_input si[\s\S]*WHERE si\.target_kind = 'checkout_group'/);
    assert.match(sql, /payment_evidence_explanation[\s\S]*paid_at_present[\s\S]*matched_successful_payment_event[\s\S]*processed_paid_event[\s\S]*matched_payment_event/);
    assert.match(sql, /recent_live_explanation/);
    assert.match(sql, /'RECENCY_ONLY'/);
    assert.match(sql, /'CHANGE_ONLY'/);
    assert.match(sql, /'UNEXPIRED_ONLY'/);
    assert.match(sql, /'MULTIPLE_PREDICATES'/);
    assert.match(sql, /unresolved_evidence_deep_explanation/);
    assert.match(sql, /NOT_DETERMINABLE_NO_PROFILE_SNAPSHOT/);
    assert.match(sql, /NOT_DETERMINABLE_LEGACY_SNAPSHOT_MISSING/);
    assert.match(sql, /multiple_predicates_change_explanation[\s\S]*paid_at_after_artifact[\s\S]*matched_payment_event_after_artifact[\s\S]*lifecycle_change_after_artifact/);
    const evidenceIndex = sql.indexOf("WHEN has_payment_evidence THEN 'HAS_PAYMENT_EVIDENCE'");
    const recentIndex = sql.indexOf("THEN 'RECENT_OR_POTENTIALLY_LIVE'");
    const staleIndex = sql.indexOf("THEN 'STALE_LEGACY_SAFE_TO_QUARANTINE'");
    const unresolvedIndex = sql.indexOf("ELSE 'UNRESOLVED'");
    assert.ok(evidenceIndex >= 0 && evidenceIndex < recentIndex && recentIndex < staleIndex && staleIndex < unresolvedIndex);
    assert.match(sql, /payment_expires_at IS NOT NULL[\s\S]*payment_expires_at <= CURRENT_TIMESTAMP[\s\S]*payment_status IN \('unpaid', 'expired'\)[\s\S]*NOT has_payment_evidence[\s\S]*NOT has_payment_or_lifecycle_change_after_artifact/);
  });
});
