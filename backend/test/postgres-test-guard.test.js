import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describePostgresTarget, validatePostgresTestGuard, redactDatabaseUrl } from '../config/postgres-guard.js';

describe('PostgreSQL Test Guard & Redaction Suite', () => {
  it('redacts password from connection strings safely', () => {
    const urlWithPass = 'postgresql://admin_user:SuperSecretPassword123@db.supabase.co:5432/teaplus_test';
    const redacted = redactDatabaseUrl(urlWithPass);

    assert.equal(redacted.includes('SuperSecretPassword123'), false);
    assert.ok(redacted.includes('*****'));
    assert.ok(redacted.includes('admin_user'));
    assert.ok(redacted.includes('teaplus_test'));
  });

  it('strictly rejects execution when NODE_ENV is production', () => {
    assert.throws(
      () => {
        validatePostgresTestGuard('postgresql://user:pass@localhost:5432/teaplus_test', {
          env: 'production',
          confirmFlag: '1',
        });
      },
      /GUARDS VIOLATION: PostgreSQL test operations require NODE_ENV=test/
    );
  });

  it('strictly permits only NODE_ENV=test', () => {
    assert.throws(
      () => validatePostgresTestGuard('postgresql://user:pass@localhost:5432/teaplus_test', {
        env: 'development', confirmFlag: '1',
      }),
      /GUARDS VIOLATION: PostgreSQL test operations require NODE_ENV=test/
    );
  });

  const stagingGuardOptions = {
    env: 'test',
    confirmFlag: '1',
    allowedHosts: 'aws-0-ap-southeast-2.pooler.supabase.com',
    allowedProjectRefs: 'stagingref',
    productionProjectRefs: 'productionref',
  };

  it('strictly rejects execution when POSTGRES_INTEGRATION confirmation flag is missing', () => {
    assert.throws(
      () => {
        validatePostgresTestGuard('postgresql://user:pass@localhost:5432/teaplus_test', {
          env: 'test',
          // Do not rely on the process environment: integration runs set this
          // flag globally, but the guard must still reject an absent/invalid value.
          confirmFlag: '0',
        });
      },
      /GUARDS VIOLATION: PostgreSQL integration tests require explicit POSTGRES_INTEGRATION=1/
    );
  });

  it('rejects remote production databases not ending in _test, _perf, or _dev', () => {
    assert.throws(
      () => {
        validatePostgresTestGuard('postgresql://user:pass@aws.supabase.co:5432/teaplus_production', {
          env: 'test',
          confirmFlag: '1',
        });
      },
      /GUARDS VIOLATION: Target database "teaplus_production" on host "aws.supabase.co" is not recognized as a dedicated test database/
    );
  });

  it('requires a dedicated name and a distinct Supabase project ref', () => {
    assert.throws(() => validatePostgresTestGuard('postgresql://postgres:pass@localhost:5432/any_db', {
      env: 'test',
      confirmFlag: '1',
    }), /not recognized as a dedicated test database/);

    const remoteResult = validatePostgresTestGuard('postgresql://postgres:pass@db.stagingref.supabase.co:5432/teaplus_test', {
      ...stagingGuardOptions,
      allowedHosts: '',
    });
    assert.equal(remoteResult.valid, true);
    assert.equal(remoteResult.dbName, 'teaplus_test');
    assert.equal(remoteResult.redactedUrl.includes('pass'), false);
    assert.equal(remoteResult.projectRef, 'stagingref');

    const allowlisted = validatePostgresTestGuard('postgresql://postgres.stagingref:pass@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', stagingGuardOptions);
    assert.equal(allowlisted.valid, true);
  });

  it('fails closed when no Supabase project ref can be derived', () => {
    assert.throws(
      () => validatePostgresTestGuard('postgresql://postgres:pass@localhost:5432/teaplus_test', stagingGuardOptions),
      /must expose a Supabase project ref/
    );
  });

  it('rejects a production project ref even when its pooler host is allowlisted', () => {
    assert.throws(
      () => validatePostgresTestGuard('postgresql://postgres.productionref:pass@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', stagingGuardOptions),
      /resolves to a production project ref/
    );
  });

  it('formats a migration target without credentials or query values', () => {
    const target = describePostgresTarget({ host: 'db.test.example', dbName: 'teaplus_test' });
    assert.equal(target, 'host=db.test.example, database=teaplus_test');
    assert.equal(target.includes('user'), false);
    assert.equal(target.includes('secret'), false);
  });
});
