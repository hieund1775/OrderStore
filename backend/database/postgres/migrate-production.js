import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';
import {
  describeProductionMigrationTarget,
  validatePostgresProductionMigrationGuard,
} from '../../config/postgres-production-migration-guard.js';
import { calculateChecksum } from './migrate.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_SQL = "SELECT pg_advisory_lock(hashtext('teaplus_postgres_migrations'))";
const MIGRATION_TRY_LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext('teaplus_postgres_migrations')) AS acquired";
const MIGRATION_UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('teaplus_postgres_migrations'))";
export const PRODUCTION_MIGRATION_TARGET = '0024';
export const PRODUCTION_MIGRATION_TARGETS = Object.freeze(['0024', '0025']);

function sanitizeErrorMessage(error) {
  return String(error?.message || error || 'Unknown migration error')
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s'"`]+/gi, '[redacted-postgres-url]')
    .replace(/\b(?:user(?:name)?|password|token|api[_-]?key)=([^\s&]+)/gi, (matched) => matched.replace(/=.*/, '=[redacted]'));
}

export function parseProductionMigrationArgs(args = []) {
  let apply = false;
  let toVersion = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') {
      apply = true;
      continue;
    }
    if (argument === '--dry-run') continue;
    if (argument === '--to') {
      toVersion = args[index + 1] || null;
      index += 1;
      continue;
    }
    if (argument.startsWith('--to=')) {
      toVersion = argument.slice('--to='.length);
      continue;
    }
    throw new Error(`PRODUCTION MIGRATION CLI: unsupported argument "${argument}".`);
  }

  if (!toVersion || !/^\d+$/.test(toVersion)) {
    throw new Error('PRODUCTION MIGRATION CLI: --to=<numeric migration version> is required.');
  }
  if (!PRODUCTION_MIGRATION_TARGETS.includes(toVersion)) {
    throw new Error(`PRODUCTION MIGRATION CLI: this executor currently supports only --to=${PRODUCTION_MIGRATION_TARGETS.join(', --to=')}.`);
  }

  return { apply, dryRun: !apply, toVersion };
}

export async function readProductionMigrationFiles({ migrationsDir = MIGRATIONS_DIR, toVersion = PRODUCTION_MIGRATION_TARGET } = {}) {
  const allFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const versions = allFiles.map((file) => file.split('_')[0]);
  if (new Set(versions).size !== versions.length || versions.some((version) => !/^\d+$/.test(version))) {
    throw new Error('MIGRATION INTEGRITY ERROR: migration filenames must have unique numeric version prefixes.');
  }
  if (!versions.includes(toVersion)) {
    throw new Error(`PRODUCTION MIGRATION CLI: target migration ${toVersion} is absent from this release artifact.`);
  }

  const migrations = await Promise.all(allFiles.map(async (file) => {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    return {
      file,
      version: file.split('_')[0],
      sql,
      checksum: calculateChecksum(sql),
    };
  }));
  return {
    all: migrations,
    throughTarget: migrations.filter((migration) => Number(migration.version) <= Number(toVersion)),
  };
}

async function inspectProductionMigrationPlan(client, migrations, toVersion) {
  const trackerResult = await client.query("SELECT to_regclass('schema_migrations') AS relation_name");
  if (!trackerResult.rows[0]?.relation_name) {
    throw new Error('PRODUCTION MIGRATION PREFLIGHT: schema_migrations is missing; initialize production through an approved recovery procedure.');
  }

  const appliedResult = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version ASC');
  const applied = new Map(appliedResult.rows.map((row) => [row.version, row.checksum]));
  const knownVersions = new Set(migrations.all.map((migration) => migration.version));
  for (const version of applied.keys()) {
    if (!knownVersions.has(version)) {
      throw new Error(`MIGRATION INTEGRITY ERROR: production has unknown migration version ${version}.`);
    }
    if (Number(version) > Number(toVersion)) {
      throw new Error(`PRODUCTION MIGRATION PREFLIGHT: production is already ahead of requested target ${toVersion}.`);
    }
  }

  for (const migration of migrations.throughTarget) {
    if (applied.has(migration.version) && applied.get(migration.version) !== migration.checksum) {
      throw new Error(`MIGRATION INTEGRITY ERROR: checksum mismatch for migration ${migration.version}.`);
    }
  }

  const pending = migrations.throughTarget.filter((migration) => !applied.has(migration.version));
  const pendingVersions = pending.map((migration) => migration.version);
  const allowedPlans = applied.has(toVersion) ? [[]] : [[toVersion]];
  if (!allowedPlans.some((expected) => expected.join(',') === pendingVersions.join(','))) {
    throw new Error(`PRODUCTION MIGRATION PREFLIGHT: expected only pending ${toVersion}; found ${pendingVersions.join(',') || 'none'}.`);
  }
  return { pending, pendingVersions, alreadyApplied: pending.length === 0 };
}

async function applyMigrationPlan(client, pending, logger) {
  const results = [];
  for (const migration of pending) {
    logger.log(`Applying production migration [${migration.version}] ${migration.file}`);
    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.file, migration.checksum],
      );
      await client.query('COMMIT');
      results.push({ version: migration.version, file: migration.file, status: 'applied' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return results;
}

/**
 * Explicit production-only migration executor. The caller must invoke --apply;
 * otherwise this performs a locked, read-only preflight.
 */
export async function runProductionMigrationExecutor({
  args = process.argv.slice(2),
  env = process.env,
  pool = null,
  createPool = (config) => new Pool(config),
  logger = console,
} = {}) {
  let activePool = null;
  let client = null;
  let lockHeld = false;

  try {
    const options = parseProductionMigrationArgs(args);
    const target = validatePostgresProductionMigrationGuard(env.PRODUCTION_DATABASE_URL, {
      env: env.NODE_ENV,
      mode: env.MIGRATION_MODE,
      confirmFlag: env.POSTGRES_PRODUCTION_MIGRATIONS,
      allowedHosts: env.POSTGRES_PRODUCTION_ALLOWED_HOSTS,
      allowedDatabases: env.POSTGRES_PRODUCTION_ALLOWED_DATABASES,
      testDatabaseUrl: env.TEST_DATABASE_URL,
      testConfirmFlag: env.POSTGRES_INTEGRATION,
    });

    logger.log(`[Production Migrator] ${options.dryRun ? 'Dry-run' : 'Apply'} target: ${describeProductionMigrationTarget(target)}`);
    logger.log('[Production Migrator] Guard passed.');
    const migrations = await readProductionMigrationFiles({ toVersion: options.toVersion });
    // Reuse the backend's Pool/SSL policy, but pass the production URL explicitly:
    // this executor must never fall back to DATABASE_URL or test connection values.
    activePool = pool || createPool(getPostgresPoolConfig(env.PRODUCTION_DATABASE_URL, { env }));
    client = await activePool.connect();

    if (options.dryRun) {
      const lock = await client.query(MIGRATION_TRY_LOCK_SQL);
      lockHeld = lock.rows[0]?.acquired === true;
      if (!lockHeld) throw new Error('PRODUCTION MIGRATION PREFLIGHT: migration advisory lock is currently held.');
    } else {
      await client.query(MIGRATION_LOCK_SQL);
      lockHeld = true;
    }

    const plan = await inspectProductionMigrationPlan(client, migrations, options.toVersion);
    logger.log(`[Production Migrator] Tracker/checksum status: verified through ${options.toVersion}.`);
    logger.log(`[Production Migrator] Pending migrations: ${plan.pendingVersions.join(',') || 'none'}.`);
    logger.log(`[Production Migrator] Plan confirmed: only ${options.toVersion} is ${plan.alreadyApplied ? 'already applied' : 'pending'}.`);
    if (options.dryRun) {
      logger.log('[Production Migrator] DRY RUN: no changes applied.');
      return { ...options, target, ...plan, results: [] };
    }

    const results = await applyMigrationPlan(client, plan.pending, logger);
    logger.log(`[Production Migrator] Apply completed; target ${options.toVersion} is ${plan.alreadyApplied ? 'already applied' : 'applied'}.`);
    return { ...options, target, ...plan, results };
  } catch (error) {
    logger.error(`[Production Migrator] Failed: ${sanitizeErrorMessage(error)}`);
    throw error;
  } finally {
    if (lockHeld && client) {
      await client.query(MIGRATION_UNLOCK_SQL).catch(() => {});
    }
    if (client) client.release();
    if (!pool && activePool) await activePool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate-production.js')) {
  runProductionMigrationExecutor()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
