import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../config/postgres-production-migration-guard.js';
import {
  parseProductionMigrationArgs,
  readProductionMigrationFiles,
  runProductionMigrationExecutor,
} from '../database/postgres/migrate-production.js';
import { calculateChecksum } from '../database/postgres/migrate.js';

const approvedEnvironment = Object.freeze({
  NODE_ENV: 'production',
  MIGRATION_MODE: 'production',
  POSTGRES_PRODUCTION_MIGRATIONS: '1',
  PRODUCTION_DATABASE_URL: 'postgresql://release_user:release_secret@prod.db.example:5432/teaplus',
  POSTGRES_PRODUCTION_ALLOWED_HOSTS: 'prod.db.example',
  POSTGRES_PRODUCTION_ALLOWED_DATABASES: 'teaplus',
  // The full PostgreSQL suite intentionally loads .env for integration tests.
  // Explicit nulls keep this production-executor fixture isolated from those
  // test-only values without weakening the production guard itself.
  TEST_DATABASE_URL: null,
  POSTGRES_INTEGRATION: null,
});

function createFakePool({ appliedRows, tryLock = true, trackerExists = true, preflightRows = null } = {}) {
  let connectCalls = 0;
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: tryLock }] };
      if (sql.includes("to_regclass('schema_migrations')")) {
        return { rows: [{ relation_name: trackerExists ? 'schema_migrations' : null }] };
      }
      if (sql.includes('SELECT version, checksum FROM schema_migrations')) return { rows: appliedRows || [] };
      if (sql.includes('checks AS (')) return { rows: preflightRows || [{ check_name: 'fixture_preflight', issue_count: '0', status: 'PASS' }] };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  return {
    pool: {
      async connect() {
        connectCalls += 1;
        return client;
      },
      async end() {},
    },
    calls,
    getConnectCalls: () => connectCalls,
  };
}

function captureLogger() {
  const logs = [];
  const errors = [];
  return {
    logger: { log: (...args) => logs.push(args.join(' ')), error: (...args) => errors.push(args.join(' ')) },
    logs,
    errors,
  };
}

const testManifest = Object.freeze({ classifier_version: 'test-fixture', targets: [{ target_kind: 'direct_order', target_id: 1, classification: 'ACTIVE_PAYMENT_REQUIRES_REPAIR' }] });
const loadTestManifest = async () => testManifest;
const compareTestManifest = () => ({ count: testManifest.targets.length, fingerprints: {} });

describe('PostgreSQL production migration guard', () => {
  it('uses the canonical migration checksum contract for 0028, not the raw file hash', async () => {
    const sql = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'postgres', 'migrations', '0028_product_reviews.sql'), 'utf8');
    const rawHash = crypto.createHash('sha256').update(sql).digest('hex');
    const canonicalHash = calculateChecksum(sql);
    assert.notEqual(rawHash, canonicalHash);
    assert.equal(canonicalHash, '70cef278ca765171cfeec93f8ca6043a19b294871f9769be32c898764db3db6e');
  });

  it('normalizes CRLF/LF and surrounding whitespace identically, while SQL changes mismatch', () => {
    assert.equal(calculateChecksum('  SELECT 1;\r\n'), calculateChecksum('\nSELECT 1;\n'));
    assert.notEqual(calculateChecksum('SELECT 1;'), calculateChecksum('SELECT 2;'));
  });

  it('requires explicit production mode and exact host/database allowlists', () => {
    const target = validatePostgresProductionMigrationGuard(approvedEnvironment.PRODUCTION_DATABASE_URL, {
      env: approvedEnvironment.NODE_ENV,
      mode: approvedEnvironment.MIGRATION_MODE,
      confirmFlag: approvedEnvironment.POSTGRES_PRODUCTION_MIGRATIONS,
      allowedHosts: approvedEnvironment.POSTGRES_PRODUCTION_ALLOWED_HOSTS,
      allowedDatabases: approvedEnvironment.POSTGRES_PRODUCTION_ALLOWED_DATABASES,
      testDatabaseUrl: approvedEnvironment.TEST_DATABASE_URL,
      testConfirmFlag: approvedEnvironment.POSTGRES_INTEGRATION,
    });
    assert.equal(describeProductionMigrationTarget(target), 'host=prod.db.example, database=teaplus');

    assert.throws(
      () => validatePostgresProductionMigrationGuard(approvedEnvironment.PRODUCTION_DATABASE_URL, {
        env: 'test', mode: 'production', confirmFlag: '1', allowedHosts: 'prod.db.example', allowedDatabases: 'teaplus', testDatabaseUrl: null, testConfirmFlag: null,
      }),
      /NODE_ENV must be production/,
    );
    assert.throws(
      () => validatePostgresProductionMigrationGuard(approvedEnvironment.PRODUCTION_DATABASE_URL, {
        env: 'production', mode: 'production', confirmFlag: '1', allowedHosts: 'other.db.example', allowedDatabases: 'teaplus', testDatabaseUrl: null, testConfirmFlag: null,
      }),
      /target host .* is not allowlisted/,
    );
    assert.throws(
      () => validatePostgresProductionMigrationGuard(approvedEnvironment.PRODUCTION_DATABASE_URL, {
        env: 'production', mode: 'production', confirmFlag: '1', allowedHosts: 'prod.db.example', allowedDatabases: 'other_db', testDatabaseUrl: null, testConfirmFlag: null,
      }),
      /target database .* is not allowlisted/,
    );
    assert.throws(
      () => validatePostgresProductionMigrationGuard(approvedEnvironment.PRODUCTION_DATABASE_URL, {
        env: 'production', mode: 'production', confirmFlag: '1', allowedHosts: 'prod.db.example', allowedDatabases: 'teaplus', testDatabaseUrl: 'postgresql://test/db', testConfirmFlag: null,
      }),
      /test migration variables must not be present/,
    );
  });

  it('accepts only reviewed targets and explicit apply syntax', () => {
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0024']), {
      apply: false, dryRun: true, toVersion: '0024', legacyManifest: null,
    });
    assert.deepEqual(parseProductionMigrationArgs(['--apply', '--to', '0024']), {
      apply: true, dryRun: false, toVersion: '0024', legacyManifest: null,
    });
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0025']), {
      apply: false, dryRun: true, toVersion: '0025', legacyManifest: null,
    });
    assert.throws(() => parseProductionMigrationArgs(['--apply']), /--to=<numeric migration version> is required/);
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0026', '--legacy-manifest=C:\\Secrets\\manifest.json']), {
      apply: false, dryRun: true, toVersion: '0026', legacyManifest: 'C:\\Secrets\\manifest.json',
    });
    assert.deepEqual(parseProductionMigrationArgs(['--apply', '--to=0027']), {
      apply: true, dryRun: false, toVersion: '0027', legacyManifest: null,
    });
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0028']), {
      apply: false, dryRun: true, toVersion: '0028', legacyManifest: null,
    });
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0030']), {
      apply: false, dryRun: true, toVersion: '0030', legacyManifest: null,
    });
    assert.throws(() => parseProductionMigrationArgs(['--apply', '--to=0031']), /supports only/);
  });

  it('fails before Pool.connect when production guard denies the target', async () => {
    const fake = createFakePool();
    const captured = captureLogger();
    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0024'],
        env: { ...approvedEnvironment, POSTGRES_PRODUCTION_MIGRATIONS: '0' },
        pool: fake.pool,
        logger: captured.logger,
      }),
      /POSTGRES_PRODUCTION_MIGRATIONS=1 is required/,
    );
    assert.equal(fake.getConnectCalls(), 0);
    assert.match(captured.errors.join('\n'), /POSTGRES_PRODUCTION_MIGRATIONS=1 is required/);
    assert.equal(captured.errors.join('\n').includes('release_secret'), false);
  });

  it('prints a sanitized preflight failure after a guarded connection', async () => {
    const fake = createFakePool({ trackerExists: false });
    const captured = captureLogger();
    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0024'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
      }),
      /schema_migrations is missing/,
    );
    assert.equal(fake.getConnectCalls(), 1);
    const output = captured.errors.join('\n');
    assert.match(output, /schema_migrations is missing/);
    assert.equal(output.includes('release_user'), false);
    assert.equal(output.includes('release_secret'), false);
  });

  it('runs a locked dry-run without executing migration SQL or leaking credentials', async () => {
    const migrations = await readProductionMigrationFiles();
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0024')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0024'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
    });

    assert.deepEqual(result.pendingVersions, ['0024']);
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.equal(fake.calls.some((call) => call.sql.includes('INSERT INTO schema_migrations')), false);
    assert.equal(fake.calls.some((call) => call.sql.includes('pg_try_advisory_lock')), true);
    const output = captured.logs.join('\n');
    assert.match(output, /host=prod\.db\.example, database=teaplus/);
    assert.match(output, /Guard passed/);
    assert.match(output, /Tracker\/checksum status: verified through 0024/);
    assert.match(output, /Pending migrations: 0024/);
    assert.match(output, /Plan confirmed: only 0024 is pending/);
    assert.match(output, /DRY RUN: no changes applied/);
    assert.equal(output.includes('release_user'), false);
    assert.equal(output.includes('release_secret'), false);
  });

  it('preflights only 0025 when that reviewed target is requested', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0025' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0025')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0025'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
    });

    assert.deepEqual(result.pendingVersions, ['0025']);
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.equal(fake.calls.some((call) => call.sql.includes('INSERT INTO schema_migrations')), false);
    assert.match(captured.logs.join('\n'), /Plan confirmed: only 0025 is pending/);
  });

  it('plans only 0026 and compares the canonical manifest before any apply', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0026' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0026')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0026', '--legacy-manifest=C:\\Secrets\\manifest.json'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
      loadManifest: loadTestManifest, compareRows: compareTestManifest,
    });

    assert.deepEqual(result.pendingVersions, ['0026']);
    assert.equal(result.preflight.filename, 'canonical-legacy-classifier');
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.match(captured.logs.join('\n'), /0026 read-only preflight passed/);
  });

  it('fails closed when canonical manifest comparison reports a blocker', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0026' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0026')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });

    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--apply', '--to=0026', '--legacy-manifest=C:\\Secrets\\manifest.json'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
        loadManifest: loadTestManifest, compareRows: () => { throw new Error('0026 canonical manifest mismatch'); },
      }),
      /0026 canonical manifest mismatch/,
    );
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
  });

  it('keeps the 0026 production preflight SQL read-only', async () => {
    const currentFile = fileURLToPath(import.meta.url);
    const preflight = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'verification', '0026_payment_attempts_preflight_readonly.sql'), 'utf8');
    assert.match(preflight, /^\s*--[\s\S]*WITH checks AS/m);
    assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it('fails closed for 0027 before preflight or apply when 0026 is not tracked', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0027' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => !['0026', '0027'].includes(migration.version))
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0027'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
      }),
      /target 0027 requires tracked migration 0026/,
    );
    assert.equal(fake.calls.some((call) => call.sql.includes('WITH checks AS')), false);
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
  });

  it('fails closed for 0028 when 0027 is not tracked', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0028' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => !['0027', '0028'].includes(migration.version))
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });

    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0028'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
      }),
      /target 0028 requires tracked migration 0027/,
    );
    assert.equal(fake.calls.some((call) => call.sql.includes('checks AS (')), false);
  });

  it('plans only 0028 and runs its read-only Reviews preflight', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0028' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0028')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0028'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
    });

    assert.deepEqual(result.pendingVersions, ['0028']);
    assert.equal(result.preflight.filename, '0028_product_reviews_preflight_readonly.sql');
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.equal(fake.calls.some((call) => call.sql.includes('INSERT INTO schema_migrations')), false);
    assert.match(captured.logs.join('\n'), /0028 read-only preflight passed/);
  });

  it('rejects a mismatched tracked 0027 checksum before the 0028 preflight', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0028' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0028')
      .map((migration) => ({ version: migration.version, checksum: migration.version === '0027' ? 'bad-checksum' : migration.checksum }));
    const fake = createFakePool({ appliedRows });

    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0028'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
      }),
      /checksum mismatch for migration 0027/,
    );
    assert.equal(fake.calls.some((call) => call.sql.includes('checks AS (')), false);
  });

  it('rejects a mismatched tracked 0028 checksum before preflight', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0028' });
    const appliedRows = migrations.throughTarget
      .map((migration) => ({ version: migration.version, checksum: migration.version === '0028' ? 'bad-checksum' : migration.checksum }));
    const fake = createFakePool({ appliedRows });

    // A later version is rejected by plan ordering; the test asserts the target
    // remains fail-closed if a future tracker row is supplied.
    await assert.rejects(
      () => runProductionMigrationExecutor({
        args: ['--dry-run', '--to=0028'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
      }),
      /checksum mismatch for migration 0028/,
    );
  });

  it('accepts 0029 and requires the already-applied P1 and Reviews prerequisites', async () => {
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0029']), {
      apply: false, dryRun: true, toVersion: '0029', legacyManifest: null,
    });
    const migrations = await readProductionMigrationFiles({ toVersion: '0029' });
    assert.ok(migrations.throughTarget.some((migration) => migration.version === '0029'));
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0029')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0029'], env: approvedEnvironment, pool: fake.pool,
      logger: captureLogger().logger,
    });
    assert.deepEqual(result.pendingVersions, ['0029']);
    assert.equal(result.preflight.filename, '0029_auth_email_staff_accounts_preflight_readonly.sql');
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
  });

  it('keeps the 0029 migration and preflight additive/read-only', async () => {
    const currentFile = fileURLToPath(import.meta.url);
    const migration = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'migrations', '0029_auth_email_staff_accounts.sql'), 'utf8');
    const preflight = await readFile(path.join(path.dirname(currentFile), '..', 'database', 'postgres', 'verification', '0029_auth_email_staff_accounts_preflight_readonly.sql'), 'utf8');
    assert.match(migration, /ADD COLUMN IF NOT EXISTS/);
    const migrationSql = migration.replace(/--.*$/gm, '');
    assert.doesNotMatch(migrationSql, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
    assert.match(preflight, /^\s*--[\s\S]*WITH required_columns/m);
    assert.doesNotMatch(preflight, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it('rejects 0029 when 0028 is missing or has a mismatched checksum', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0029' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => !['0028', '0029'].includes(migration.version))
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    await assert.rejects(
      runProductionMigrationExecutor({ args: ['--dry-run', '--to=0029'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger }),
      /target 0029 requires tracked migration 0028/,
    );

    const mismatchRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0029')
      .map((migration) => ({ version: migration.version, checksum: migration.version === '0028' ? 'bad-checksum' : migration.checksum }));
    const mismatch = createFakePool({ appliedRows: mismatchRows });
    await assert.rejects(
      runProductionMigrationExecutor({ args: ['--dry-run', '--to=0029'], env: approvedEnvironment, pool: mismatch.pool, logger: captureLogger().logger }),
      /checksum mismatch for migration 0028/,
    );
  });

  it('plans only 0030 after all finalized P1, Reviews, and Auth prerequisites', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0030' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0030')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0030'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
    });
    assert.deepEqual(result.pendingVersions, ['0030']);
    assert.equal(result.preflight.filename, '0030_preorder_preflight_readonly.sql');
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.equal(fake.calls.some((call) => call.sql.includes('INSERT INTO schema_migrations')), false);
  });

  it('fails closed for 0030 before preflight when 0029 is absent or checksum-mismatched', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0030' });
    const withoutAuth = migrations.throughTarget
      .filter((migration) => !['0029', '0030'].includes(migration.version))
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const missing = createFakePool({ appliedRows: withoutAuth });
    await assert.rejects(
      runProductionMigrationExecutor({ args: ['--dry-run', '--to=0030'], env: approvedEnvironment, pool: missing.pool, logger: captureLogger().logger }),
      /target 0030 requires tracked migration 0029/,
    );
    assert.equal(missing.calls.some((call) => call.sql.includes('checks AS (')), false);

    const mismatchRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0030')
      .map((migration) => ({ version: migration.version, checksum: migration.version === '0029' ? 'bad-checksum' : migration.checksum }));
    const mismatch = createFakePool({ appliedRows: mismatchRows });
    await assert.rejects(
      runProductionMigrationExecutor({ args: ['--dry-run', '--to=0030'], env: approvedEnvironment, pool: mismatch.pool, logger: captureLogger().logger }),
      /checksum mismatch for migration 0029/,
    );
  });

  it('plans only 0027 after a tracked/checksummed 0026 and gates it with the enforcement preflight', async () => {
    const migrations = await readProductionMigrationFiles({ toVersion: '0027' });
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0027')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();

    const result = await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0027'], env: approvedEnvironment, pool: fake.pool, logger: captured.logger,
    });

    assert.deepEqual(result.pendingVersions, ['0027']);
    assert.equal(result.preflight.filename, '0027_payment_attempts_preflight_readonly.sql');
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), false);
    assert.match(captured.logs.join('\n'), /0027 read-only preflight passed/);
  });

  it('uses the backend scoped Pool SSL policy with the explicit production URL', async () => {
    const migrations = await readProductionMigrationFiles();
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0024')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });
    const captured = captureLogger();
    let receivedConfig = null;

    await runProductionMigrationExecutor({
      args: ['--dry-run', '--to=0024'],
      env: {
        ...approvedEnvironment,
        PG_SSL_REJECT_UNAUTHORIZED: 'false',
        DATABASE_URL: 'postgresql://wrong_user:wrong_secret@wrong.db.example:5432/wrong_database',
      },
      createPool(config) {
        receivedConfig = config;
        return fake.pool;
      },
      logger: captured.logger,
    });

    assert.equal(receivedConfig.connectionString, approvedEnvironment.PRODUCTION_DATABASE_URL);
    assert.deepEqual(receivedConfig.ssl, { rejectUnauthorized: false });
    assert.equal(captured.logs.join('\n').includes('release_secret'), false);
    assert.equal(captured.logs.join('\n').includes('wrong_secret'), false);
  });

  it('applies only 0024 under the advisory lock after preflight passes', async () => {
    const migrations = await readProductionMigrationFiles();
    const appliedRows = migrations.throughTarget
      .filter((migration) => migration.version !== '0024')
      .map((migration) => ({ version: migration.version, checksum: migration.checksum }));
    const fake = createFakePool({ appliedRows });

    const result = await runProductionMigrationExecutor({
      args: ['--apply', '--to=0024'], env: approvedEnvironment, pool: fake.pool, logger: captureLogger().logger,
    });

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].version, '0024');
    assert.equal(fake.calls.some((call) => call.sql.includes('pg_advisory_lock')), true);
    assert.equal(fake.calls.some((call) => call.sql === 'BEGIN'), true);
    assert.equal(fake.calls.some((call) => call.sql.includes('P0: resolved-profile routing')), true);
    assert.equal(fake.calls.some((call) => call.sql.includes('INSERT INTO schema_migrations')), true);
  });
});
