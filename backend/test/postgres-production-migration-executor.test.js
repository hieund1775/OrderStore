import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../config/postgres-production-migration-guard.js';
import {
  parseProductionMigrationArgs,
  readProductionMigrationFiles,
  runProductionMigrationExecutor,
} from '../database/postgres/migrate-production.js';

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

function createFakePool({ appliedRows, tryLock = true, trackerExists = true } = {}) {
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

describe('PostgreSQL production migration guard', () => {
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

  it('accepts only the reviewed P0 target and explicit apply syntax', () => {
    assert.deepEqual(parseProductionMigrationArgs(['--dry-run', '--to=0024']), {
      apply: false, dryRun: true, toVersion: '0024',
    });
    assert.deepEqual(parseProductionMigrationArgs(['--apply', '--to', '0024']), {
      apply: true, dryRun: false, toVersion: '0024',
    });
    assert.throws(() => parseProductionMigrationArgs(['--apply']), /--to=<numeric migration version> is required/);
    assert.throws(() => parseProductionMigrationArgs(['--apply', '--to=0025']), /supports only --to=0024/);
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
