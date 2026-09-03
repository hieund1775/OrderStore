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

  it('requires a dedicated name even on localhost, unless a host is explicitly allowlisted', () => {
    assert.throws(() => validatePostgresTestGuard('postgresql://postgres:pass@localhost:5432/any_db', {
      env: 'test',
      confirmFlag: '1',
    }), /not recognized as a dedicated test database/);

    const localResult = validatePostgresTestGuard('postgresql://postgres:pass@localhost:5432/teaplus_test', {
      env: 'test', confirmFlag: '1',
    });
    assert.equal(localResult.host, 'localhost');

    // Remote test database ending in _test
    const remoteResult = validatePostgresTestGuard('postgresql://user:pass@db.supabase.co:5432/teaplus_test', {
      env: 'test',
      confirmFlag: '1',
    });
    assert.equal(remoteResult.valid, true);
    assert.equal(remoteResult.dbName, 'teaplus_test');
    assert.equal(remoteResult.redactedUrl.includes('pass'), false);

    const allowlisted = validatePostgresTestGuard('postgresql://user:pass@db.example.test:5432/postgres', {
      env: 'test', confirmFlag: '1', allowedHosts: 'db.example.test',
    });
    assert.equal(allowlisted.valid, true);
  });

  it('formats a migration target without credentials or query values', () => {
    const target = describePostgresTarget({ host: 'db.test.example', dbName: 'teaplus_test' });
    assert.equal(target, 'host=db.test.example, database=teaplus_test');
    assert.equal(target.includes('user'), false);
    assert.equal(target.includes('secret'), false);
  });
});
