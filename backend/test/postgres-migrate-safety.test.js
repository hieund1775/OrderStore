import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../database/postgres/migrate.js';

function createFakePool() {
  let connectCalls = 0;
  const client = {
    async query(sql) {
      if (sql.includes('SELECT version, checksum FROM schema_migrations')) return { rows: [] };
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
    },
    getConnectCalls: () => connectCalls,
  };
}

async function withGuardEnvironment(values, callback) {
  const keys = [
    'NODE_ENV',
    'POSTGRES_INTEGRATION',
    'POSTGRES_TEST_ALLOWED_HOSTS',
    'POSTGRES_TEST_ALLOWED_PROJECT_REFS',
    'POSTGRES_PRODUCTION_PROJECT_REFS',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function captureMigrationLogs(callback) {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    return { result: await callback(), logs };
  } finally {
    console.log = originalLog;
  }
}

describe('PostgreSQL migration safety guard', () => {
  it('denies an unapproved target before Pool.connect', async () => {
    const fake = createFakePool();
    await withGuardEnvironment({ NODE_ENV: 'test', POSTGRES_INTEGRATION: '1', POSTGRES_TEST_ALLOWED_HOSTS: '', POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref', POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref' }, async () => {
      await assert.rejects(
        () => runMigrations({ customUrl: 'postgresql://user:secret@db.example.test:5432/production', pool: fake.pool }),
        /not recognized as a dedicated test database/
      );
    });
    assert.equal(fake.getConnectCalls(), 0);
  });

  it('denies missing confirmation and a non-test environment before Pool.connect', async () => {
    const missingConfirmation = createFakePool();
    await withGuardEnvironment({ NODE_ENV: 'test', POSTGRES_INTEGRATION: '0', POSTGRES_TEST_ALLOWED_HOSTS: '', POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref', POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref' }, async () => {
      await assert.rejects(
        () => runMigrations({ customUrl: 'postgresql://user:secret@localhost:5432/teaplus_test', pool: missingConfirmation.pool }),
        /require explicit POSTGRES_INTEGRATION=1/
      );
    });
    assert.equal(missingConfirmation.getConnectCalls(), 0);

    const nonTestEnvironment = createFakePool();
    await withGuardEnvironment({ NODE_ENV: 'development', POSTGRES_INTEGRATION: '1', POSTGRES_TEST_ALLOWED_HOSTS: '', POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref', POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref' }, async () => {
      await assert.rejects(
        () => runMigrations({ customUrl: 'postgresql://user:secret@localhost:5432/teaplus_test', pool: nonTestEnvironment.pool }),
        /require NODE_ENV=test/
      );
    });
    assert.equal(nonTestEnvironment.getConnectCalls(), 0);
  });

  it('allows a dedicated test database and an explicitly allowlisted host', async () => {
    await withGuardEnvironment({ NODE_ENV: 'test', POSTGRES_INTEGRATION: '1', POSTGRES_TEST_ALLOWED_HOSTS: '', POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref', POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref' }, async () => {
      const fake = createFakePool();
      const { result: results, logs } = await captureMigrationLogs(() => runMigrations({
        customUrl: 'postgresql://user.stagingref:secret@db.stagingref.supabase.co:5432/teaplus_test', pool: fake.pool,
      }));
      assert.ok(results.length > 0);
      assert.equal(fake.getConnectCalls(), 1);
      const output = logs.join('\n');
      assert.match(output, /Target DB: host=db\.stagingref\.supabase\.co, database=teaplus_test/);
      assert.equal(output.includes('user.stagingref:secret'), false);
      assert.equal(output.includes('?'), false);
    });

    await withGuardEnvironment({ NODE_ENV: 'test', POSTGRES_INTEGRATION: '1', POSTGRES_TEST_ALLOWED_HOSTS: 'aws-0-ap-southeast-2.pooler.supabase.com', POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref', POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref' }, async () => {
      const fake = createFakePool();
      const { result: results } = await captureMigrationLogs(() => runMigrations({
        customUrl: 'postgresql://postgres.stagingref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', pool: fake.pool,
      }));
      assert.ok(results.length > 0);
      assert.equal(fake.getConnectCalls(), 1);
    });
  });

  it('denies a production project ref even when the shared Supabase pooler host is allowlisted', async () => {
    const fake = createFakePool();
    await withGuardEnvironment({
      NODE_ENV: 'test',
      POSTGRES_INTEGRATION: '1',
      POSTGRES_TEST_ALLOWED_HOSTS: 'aws-0-ap-southeast-2.pooler.supabase.com',
      POSTGRES_TEST_ALLOWED_PROJECT_REFS: 'stagingref',
      POSTGRES_PRODUCTION_PROJECT_REFS: 'productionref',
    }, async () => {
      await assert.rejects(
        () => runMigrations({
          customUrl: 'postgresql://postgres.productionref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
          pool: fake.pool,
        }),
        /resolves to a production project ref/
      );
    });
    assert.equal(fake.getConnectCalls(), 0);
  });
});
