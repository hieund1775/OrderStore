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
 * Builds a log-safe database identity. Credentials, port, query string and
 * connection-string syntax are intentionally absent.
 */
export function describePostgresTarget({ host, dbName }) {
  const clean = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `host=${clean(host)}, database=${clean(dbName)}`;
}

function parseExactAllowlist(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Direct Supabase URLs encode the project ref in db.<ref>.supabase.co.
 * Pooler hosts are shared, so their URLs must use <role>.<ref> as username.
 * The username is never returned or logged.
 */
function resolveSupabaseProjectRef(parsedUrl) {
  const directMatch = parsedUrl.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  if (directMatch) return directMatch[1].toLowerCase();

  let username = '';
  try {
    username = decodeURIComponent(parsedUrl.username || '');
  } catch {
    return null;
  }
  const poolerMatch = username.match(/^[a-z][a-z0-9_]*\.([a-z0-9-]+)$/i);
  return poolerMatch ? poolerMatch[1].toLowerCase() : null;
}

/**
 * Validates that a PostgreSQL URL is dedicated for test/perf execution and strictly avoids production
 */
export function validatePostgresTestGuard(
  databaseUrl,
  {
    env = process.env.NODE_ENV,
    confirmFlag = process.env.POSTGRES_INTEGRATION,
    allowedHosts = process.env.POSTGRES_TEST_ALLOWED_HOSTS,
    allowedProjectRefs = process.env.POSTGRES_TEST_ALLOWED_PROJECT_REFS,
    productionProjectRefs = process.env.POSTGRES_PRODUCTION_PROJECT_REFS,
  } = {}
) {
  if (env !== 'test') {
    throw new Error('GUARDS VIOLATION: PostgreSQL test operations require NODE_ENV=test.');
  }

  if (confirmFlag !== '1' && confirmFlag !== true) {
    throw new Error('GUARDS VIOLATION: PostgreSQL integration tests require explicit POSTGRES_INTEGRATION=1 confirmation flag.');
  }

  if (!databaseUrl || typeof databaseUrl !== 'string') {
    throw new Error('GUARDS VIOLATION: TEST_DATABASE_URL or DATABASE_URL is missing or empty.');
  }

  let dbName = '';
  let host = '';
  let parsed;

  try {
    parsed = new URL(databaseUrl);
    dbName = parsed.pathname.replace(/^\//, '');
    host = parsed.hostname;
  } catch {
    throw new Error('GUARDS VIOLATION: Malformed PostgreSQL connection URL.');
  }

  const isDedicatedTestName = /(_test|_perf|_dev)$/i.test(dbName);
  const explicitlyAllowedHosts = parseExactAllowlist(allowedHosts);
  const isExplicitlyAllowedHost = explicitlyAllowedHosts.includes(host.toLowerCase());

  if (!isDedicatedTestName && !isExplicitlyAllowedHost) {
    throw new Error(
      `GUARDS VIOLATION: Target database "${dbName}" on host "${host}" is not recognized as a dedicated test database (must end in _test, _perf, or _dev, or use an explicitly allowlisted host).`
    );
  }

  const projectRef = resolveSupabaseProjectRef(parsed);
  const testProjectRefs = parseExactAllowlist(allowedProjectRefs);
  const productionRefs = parseExactAllowlist(productionProjectRefs);
  if (!projectRef) {
    throw new Error('GUARDS VIOLATION: PostgreSQL test target must expose a Supabase project ref through a direct host or pooler username.');
  }
  if (testProjectRefs.length === 0 || productionRefs.length === 0) {
    throw new Error('GUARDS VIOLATION: POSTGRES_TEST_ALLOWED_PROJECT_REFS and POSTGRES_PRODUCTION_PROJECT_REFS are both required.');
  }
  if (productionRefs.includes(projectRef)) {
    throw new Error('GUARDS VIOLATION: PostgreSQL test target resolves to a production project ref.');
  }
  if (!testProjectRefs.includes(projectRef)) {
    throw new Error('GUARDS VIOLATION: PostgreSQL test target project ref is not allowlisted for test/staging.');
  }

  return {
    valid: true,
    host,
    dbName,
    projectRef,
    redactedUrl: redactDatabaseUrl(databaseUrl),
  };
}
