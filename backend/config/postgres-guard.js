/**
 * Redacts credentials and password from a PostgreSQL connection string
 */
export function redactDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '*****';
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/:([^@]+)@/, ':*****@');
  }
}

/**
 * Validates that a PostgreSQL URL is dedicated for test/perf execution and strictly avoids production
 */
export function validatePostgresTestGuard(databaseUrl, { env = process.env.NODE_ENV, confirmFlag = process.env.POSTGRES_INTEGRATION } = {}) {
  if (env === 'production') {
    throw new Error('GUARDS VIOLATION: PostgreSQL integration tests cannot run when NODE_ENV is production.');
  }

  if (confirmFlag !== '1' && confirmFlag !== true) {
    throw new Error('GUARDS VIOLATION: PostgreSQL integration tests require explicit POSTGRES_INTEGRATION=1 confirmation flag.');
  }

  if (!databaseUrl || typeof databaseUrl !== 'string') {
    throw new Error('GUARDS VIOLATION: TEST_DATABASE_URL or DATABASE_URL is missing or empty.');
  }

  let dbName = '';
  let host = '';

  try {
    const parsed = new URL(databaseUrl);
    dbName = parsed.pathname.replace(/^\//, '');
    host = parsed.hostname;
  } catch {
    throw new Error('GUARDS VIOLATION: Malformed PostgreSQL connection URL.');
  }

  const isDedicatedTestName = /(_test|_perf|_dev)$/i.test(dbName);
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (!isDedicatedTestName && !isLocalHost) {
    throw new Error(
      `GUARDS VIOLATION: Target database "${dbName}" on host "${host}" is not recognized as a dedicated test database (must end in _test, _perf, or _dev, or run on localhost).`
    );
  }

  return {
    valid: true,
    host,
    dbName,
    redactedUrl: redactDatabaseUrl(databaseUrl),
  };
}
