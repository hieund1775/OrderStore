function cleanTargetPart(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function describeProductionMigrationTarget({ host, dbName }) {
  return `host=${cleanTargetPart(host)}, database=${cleanTargetPart(dbName)}`;
}

function parseExactAllowlist(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Guard for the explicitly opt-in production migration executor.
 * This is intentionally independent from the test-only migration guard.
 */
export function validatePostgresProductionMigrationGuard(
  productionDatabaseUrl,
  {
    env = process.env.NODE_ENV,
    mode = process.env.MIGRATION_MODE,
    confirmFlag = process.env.POSTGRES_PRODUCTION_MIGRATIONS,
    allowedHosts = process.env.POSTGRES_PRODUCTION_ALLOWED_HOSTS,
    allowedDatabases = process.env.POSTGRES_PRODUCTION_ALLOWED_DATABASES,
    testDatabaseUrl = process.env.TEST_DATABASE_URL,
    testConfirmFlag = process.env.POSTGRES_INTEGRATION,
  } = {},
) {
  if (env !== 'production') {
    throw new Error('PRODUCTION MIGRATION GUARD: NODE_ENV must be production.');
  }
  if (mode !== 'production') {
    throw new Error('PRODUCTION MIGRATION GUARD: MIGRATION_MODE must be production.');
  }
  if (confirmFlag !== '1' && confirmFlag !== true) {
    throw new Error('PRODUCTION MIGRATION GUARD: POSTGRES_PRODUCTION_MIGRATIONS=1 is required.');
  }
  if (testDatabaseUrl || testConfirmFlag) {
    throw new Error('PRODUCTION MIGRATION GUARD: test migration variables must not be present.');
  }
  if (!productionDatabaseUrl || typeof productionDatabaseUrl !== 'string') {
    throw new Error('PRODUCTION MIGRATION GUARD: PRODUCTION_DATABASE_URL is required.');
  }

  let host;
  let dbName;
  try {
    const parsed = new URL(productionDatabaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('unsupported protocol');
    }
    host = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, '');
  } catch {
    throw new Error('PRODUCTION MIGRATION GUARD: PRODUCTION_DATABASE_URL is malformed.');
  }

  const hosts = parseExactAllowlist(allowedHosts);
  const databases = parseExactAllowlist(allowedDatabases);
  if (hosts.length === 0 || databases.length === 0) {
    throw new Error('PRODUCTION MIGRATION GUARD: host and database allowlists are both required.');
  }
  if (!hosts.includes(host.toLowerCase())) {
    throw new Error(`PRODUCTION MIGRATION GUARD: target host "${cleanTargetPart(host)}" is not allowlisted.`);
  }
  if (!databases.includes(dbName.toLowerCase())) {
    throw new Error(`PRODUCTION MIGRATION GUARD: target database "${cleanTargetPart(dbName)}" is not allowlisted.`);
  }

  return { valid: true, host, dbName };
}
