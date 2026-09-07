import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateLegacyClassificationRows,
  parseProductionLegacyAuditArgs,
  runProductionLegacyPaymentArtifactAudit,
} from '../database/postgres/audit-production-legacy-payment-artifacts.js';

const approvedEnvironment = Object.freeze({
  NODE_ENV: 'production',
  MIGRATION_MODE: 'production',
  POSTGRES_PRODUCTION_MIGRATIONS: '1',
  PRODUCTION_DATABASE_URL: 'postgresql://release_user:release_secret@prod.db.example:5432/teaplus',
  POSTGRES_PRODUCTION_ALLOWED_HOSTS: 'prod.db.example',
  POSTGRES_PRODUCTION_ALLOWED_DATABASES: 'teaplus',
  TEST_DATABASE_URL: null,
  POSTGRES_INTEGRATION: null,
});

function canonicalRow(id, classification = 'ACTIVE_PAYMENT_REQUIRES_REPAIR') {
  return {
    target_kind: 'direct_order', target_id: id, payment_status: 'unpaid', lifecycle_status: null,
    has_payos_order_code: true, has_payment_link_id: true, has_checkout_url: true, has_qr_code: true, has_expires_at: true,
    missing_profile_snapshot: classification !== 'SAFE_TO_SKIP_HISTORY', ambiguous_shape_or_status: classification === 'AMBIGUOUS_BLOCK',
    reconciliation_needed: classification === 'ACTIVE_PAYMENT_REQUIRES_REPAIR', classification,
    deterministic_evidence_source: 'NONE_OR_MULTIPLE_PROFILES',
  };
}

function createFakePool({ lock = true, rows = [canonicalRow(1)] } = {}) {
  const calls = [];
  let connectCalls = 0;
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: lock }] };
      if (sql.includes('P1 / 0026 canonical legacy blocker classification')) return { rows };
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
  const logs = [];
  const errors = [];
  return { logger: { log: (...args) => logs.push(args.join(' ')), error: (...args) => errors.push(args.join(' ')) }, logs, errors };
}

describe('production legacy payment artifact audit', () => {
  it('accepts only the explicit read-only audit command', () => {
    assert.deepEqual(parseProductionLegacyAuditArgs(['--audit=0026-legacy']), { audit: '0026-legacy' });
    assert.throws(() => parseProductionLegacyAuditArgs([]), /only --audit=0026-legacy is supported/);
    assert.throws(() => parseProductionLegacyAuditArgs(['--apply', '--to=0026']), /only --audit=0026-legacy is supported/);
  });

  it('fails the shared production guard before connecting', async () => {
    const fake = createFakePool();
    await assert.rejects(
      () => runProductionLegacyPaymentArtifactAudit({
        args: ['--audit=0026-legacy'],
        env: { ...approvedEnvironment, POSTGRES_PRODUCTION_MIGRATIONS: '0' },
        pool: fake.pool,
        logger: captureLogger().logger,
      }),
      /POSTGRES_PRODUCTION_MIGRATIONS=1 is required/,
    );
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('uses guarded scoped Pool config and emits only aggregate report data', async () => {
    const rows = [canonicalRow(1), canonicalRow(2, 'AMBIGUOUS_BLOCK')];
    const fake = createFakePool({ rows });
    const captured = captureLogger();
    let receivedConfig = null;

    const result = await runProductionLegacyPaymentArtifactAudit({
      args: ['--audit=0026-legacy'],
      env: {
        ...approvedEnvironment,
        PG_SSL_REJECT_UNAUTHORIZED: 'false',
        DATABASE_URL: 'postgresql://wrong_user:wrong_secret@wrong.db.example:5432/wrong_database',
      },
      createPool(config) { receivedConfig = config; return fake.pool; },
      logger: captured.logger,
    });

    assert.equal(result.report.summary.unique_blocked_targets, 2);
    assert.equal(result.report.summary.reconciliation_needed_count, 1);
    assert.equal(receivedConfig.connectionString, approvedEnvironment.PRODUCTION_DATABASE_URL);
    assert.deepEqual(receivedConfig.ssl, { rejectUnauthorized: false });
    assert.equal(fake.calls.some((sql) => /\b(?:BEGIN|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql)), false);
    const output = `${captured.logs.join('\n')}\n${captured.errors.join('\n')}`;
    assert.match(output, /host=prod\.db\.example, database=teaplus/);
    assert.equal(output.includes('release_user'), false);
    assert.equal(output.includes('release_secret'), false);
    assert.equal(output.includes('wrong_secret'), false);
    assert.equal(output.includes('payment_checkout_url'), false);
    assert.equal(output.includes('payment_qr_code'), false);
    assert.equal(output.includes('receiver_account_number'), false);
  });

  it('keeps audit SQL SELECT/CTE-only and free of category mapping or emitted artifacts', async () => {
    const currentFile = fileURLToPath(import.meta.url);
    const sql = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'verification', '0026_payment_attempts_legacy_blocker_audit_readonly.sql'), 'utf8');
    assert.match(sql, /^\s*--[\s\S]*WITH latest_order_lifecycle AS/m);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
    assert.doesNotMatch(sql, /\b(?:categories|category_payment_profiles|root_category_id)\b/i);
    assert.doesNotMatch(sql, /\b(?:order_code|group_code|customer_name|customer_phone|payment_checkout_url\s+AS|payment_qr_code\s+AS|receiver_account_number\s+AS)\b/i);
  });

  it('derives aggregates from the one canonical classifier, including the 100 active and 27 ambiguous regression fixture', () => {
    const rows = [
      ...Array.from({ length: 100 }, (_, index) => canonicalRow(index + 1)),
      ...Array.from({ length: 27 }, (_, index) => canonicalRow(index + 200, 'AMBIGUOUS_BLOCK')),
      ...Array.from({ length: 47 }, (_, index) => canonicalRow(index + 300, 'SAFE_TO_SKIP_HISTORY')),
    ];
    const report = aggregateLegacyClassificationRows(rows);
    assert.equal(report.summary.unique_blocked_targets, 174);
    assert.equal(report.summary.reconciliation_needed_count, 100);
    assert.equal(report.classification_counts.find((row) => row.classification === 'AMBIGUOUS_BLOCK').target_count, 27);
  });
});
