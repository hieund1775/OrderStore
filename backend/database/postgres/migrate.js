import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';
import { redactDatabaseUrl } from '../../config/postgres-guard.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Calculates SHA-256 checksum of a string content
 */
export function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content.trim().replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Runs all pending PostgreSQL migrations in order
 */
export async function runMigrations({ customUrl = null, pool = null } = {}) {
  const activePool = pool || new Pool(getPostgresPoolConfig(customUrl));
  const targetUrl = customUrl || process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  console.log(`🚀 [PostgreSQL Migrator] Target DB: ${redactDatabaseUrl(targetUrl)}`);

  const client = await activePool.connect();
  let lockHeld = false;

  try {
    // One migrator per database: prevents two deploys from applying/checking the
    // same version concurrently. This is released in finally even on failure.
    await client.query("SELECT pg_advisory_lock(hashtext('teaplus_postgres_migrations'))");
    lockHeld = true;

    // 1. Ensure schema_migrations tracker exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Discover and sort migration files
    const allFiles = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = allFiles.filter((f) => f.endsWith('.sql')).sort();
    const versions = sqlFiles.map((file) => file.split('_')[0]);
    if (new Set(versions).size !== versions.length || versions.some((version) => !/^\d+$/.test(version))) {
      throw new Error('MIGRATION INTEGRITY ERROR: migration filenames must have unique numeric version prefixes.');
    }

    const appliedRes = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version ASC');
    const appliedMap = new Map(appliedRes.rows.map((r) => [r.version, r.checksum]));

    const results = [];

    for (const file of sqlFiles) {
      const version = file.split('_')[0];
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = await fs.readFile(filePath, 'utf8');
      const checksum = calculateChecksum(sqlContent);

      if (appliedMap.has(version)) {
        const storedChecksum = appliedMap.get(version);
        if (storedChecksum !== checksum) {
          throw new Error(
            `MIGRATION INTEGRITY ERROR: Migration file "${file}" (version ${version}) has been altered after being applied. Stored checksum: ${storedChecksum}, Current: ${checksum}`
          );
        }
        results.push({ version, file, status: 'already_applied' });
        continue;
      }

      // Execute migration inside atomic transaction
      console.log(`⏳ Applying migration [${version}] ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [version, file, checksum]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied [${version}] ${file}`);
        results.push({ version, file, status: 'applied' });
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed applying migration [${version}] ${file}:`, migrationErr.message);
        throw migrationErr;
      }
    }

    console.log(`🎉 All ${results.length} PostgreSQL migrations verified/applied successfully.`);
    return results;
  } finally {
    if (lockHeld) {
      await client.query("SELECT pg_advisory_unlock(hashtext('teaplus_postgres_migrations'))");
    }
    client.release();
    if (!pool) {
      await activePool.end();
    }
  }
}

// If executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration runner failed:', err);
      process.exit(1);
    });
}
