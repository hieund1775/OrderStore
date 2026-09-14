import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { calculateChecksum, runMigrations } from '../database/postgres/migrate.js';

const { Pool } = pg;
const testDbUrl = process.env.TEST_DATABASE_URL;
const enabled = process.env.POSTGRES_INTEGRATION === '1';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const preflightPath = path.join(root, 'database', 'postgres', 'verification', '0033_preorder_customer_checkin_preflight_readonly.sql');
const migrationPath = path.join(root, 'database', 'postgres', 'migrations', '0033_preorder_customer_checkin.sql');
const teaPlusTestProjectRef = 'sumodxrhsbnirvrvnwpy';
const productionProjectRef = 'duahwveccxdtueweyfov';
const silentMigrationLogger = { log() {}, error() {} };

function schemaName(prefix = 'preorder_checkin_0033') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function assertSafeSchemaName(schema) {
  assert.match(schema, /^[a-z_][a-z0-9_]*$/);
  return schema;
}

function quotedIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function createSchemaScopedPool(schema) {
  // `options` applies search_path to every dedicated pool session, including
  // the session obtained inside runMigrations(). The generated schema name is
  // validated above and public remains read-only from this harness.
  return new Pool({
    ...getPostgresPoolConfig(testDbUrl),
    max: 1,
    options: `-c search_path=${assertSafeSchemaName(schema)},public`,
  });
}

async function createIsolatedSchema(schema) {
  const pool = new Pool({ ...getPostgresPoolConfig(testDbUrl), max: 1 });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quotedIdentifier(schema)}`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function dropIsolatedSchema(schema) {
  const pool = new Pool({ ...getPostgresPoolConfig(testDbUrl), max: 1 });
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function assertSessionSchema(client, schema) {
  const [{ current_schema: activeSchema, search_path: searchPath }] = (await client.query(
    'SELECT current_schema(), current_setting(\'search_path\') AS search_path',
  )).rows;
  assert.equal(activeSchema, schema);
  assert.match(searchPath, new RegExp(`^${schema}(?:,|$)`));
}

async function seedAuditedPre0025State(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO categories (id, name, slug, parent_id, depth) VALUES
        (33, 'Audited legacy root', 'audited-root-33', NULL, 0),
        (1, 'Audited root one', 'audited-root-1', NULL, 0),
        (14, 'Audited root fourteen', 'audited-root-14', NULL, 0),
        (15, 'Audited root fifteen', 'audited-root-15', NULL, 0),
        (22, 'Audited child twenty-two', 'audited-child-22', 15, 1),
        (24, 'Audited child twenty-four', 'audited-child-24', 14, 1),
        (25, 'Audited child twenty-five', 'audited-child-25', 14, 1)
    `);
    await client.query("UPDATE payment_profiles SET purpose = 'industry', status = 'active' WHERE code = 'DEFAULT_LONG'");
    await client.query(`
      INSERT INTO category_payment_profiles (root_category_id, payment_profile_id, is_active)
      SELECT 1, id, TRUE FROM payment_profiles WHERE code = 'DEFAULT_LONG'
    `);
    await client.query('UPDATE categories SET parent_id = 33, depth = 1 WHERE id IN (1, 14, 15)');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function provideMigrationInput({ client, version }) {
  if (version !== '0026') return;
  await client.query(`
    CREATE TEMP TABLE p1_legacy_quarantine_manifest_input (
      target_kind text NOT NULL,
      target_id bigint NOT NULL,
      classification text NOT NULL,
      classifier_version text NOT NULL
    ) ON COMMIT DROP
  `);
}

function migrationGuardOptions() {
  const parsedUrl = new URL(testDbUrl);
  return {
    allowedHosts: parsedUrl.hostname,
    allowedProjectRefs: teaPlusTestProjectRef,
    productionProjectRefs: productionProjectRef,
  };
}

function migrationLockName(schema) {
  return `teaplus_postgres_migrations:${assertSafeSchemaName(schema)}`;
}

async function applyCanonicalPost0032Chain(pool, schema) {
  const guardOptions = migrationGuardOptions();
  const advisoryLockName = migrationLockName(schema);
  await runMigrations({ pool, toVersion: '0024', guardOptions, advisoryLockName, logger: silentMigrationLogger });
  await seedAuditedPre0025State(pool);
  await runMigrations({ pool, toVersion: '0032', beforeMigration: provideMigrationInput, guardOptions, advisoryLockName, logger: silentMigrationLogger });
}

async function seedCheckinFixture(client) {
  await client.query(`
    INSERT INTO stores (id, name, city, district, address, hours, phone)
    VALUES (1, 'Isolated check-in store', 'HCM', '1', 'Test address', '09:00-23:00', '0900000000')
  `);
  await client.query(`
    INSERT INTO users (id, fullname, phone, email, password_hash, is_admin, admin_role, admin_branch_id, is_active)
    VALUES
      (1, 'Check-in customer', '0900000001', 'customer@example.test', 'not-a-real-password', FALSE, NULL, NULL, TRUE),
      (2, 'Check-in manager', '0900000002', 'manager@example.test', 'not-a-real-password', TRUE, 'manager', 1, TRUE),
      (9, 'Other customer', '0900000009', 'other@example.test', 'not-a-real-password', FALSE, NULL, NULL, TRUE)
  `);
  const start = new Date('2026-09-14T15:00:00.000Z');
  const end = new Date('2026-09-14T16:00:00.000Z');
  const result = await client.query(`
    INSERT INTO preorders (
      preorder_code, store_id, customer_user_id, checkout_idempotency_key,
      scheduled_start_at, scheduled_end_at, status, responsible_manager_id
    ) VALUES ('PO-CHECKIN-1', 1, 1, 'checkin-idempotency-1', $1, $2, 'CONFIRMED', 2)
    RETURNING id
  `, [start, end]);
  return { preorderId: result.rows[0].id, start, end };
}

async function readPreflight(client, preflightSql) {
  const result = await client.query(preflightSql);
  return new Map(result.rows.map((row) => [row.check_name, Number(row.issue_count)]));
}

async function assertPreflightPasses(client, preflightSql) {
  const checks = await readPreflight(client, preflightSql);
  for (const [name, count] of checks) assert.equal(count, 0, `${name} must pass`);
}

async function withTrackerHidden(client, action) {
  await client.query('BEGIN');
  try {
    await client.query("DELETE FROM schema_migrations WHERE version = '0033'");
    await action();
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function expectCompatibilityBlock(client, preflightSql, checkName, mutate) {
  await withTrackerHidden(client, async () => {
    await mutate();
    const checks = await readPreflight(client, preflightSql);
    assert.ok((checks.get(checkName) || 0) > 0, `${checkName} must block incompatible shape`);
  });
}

async function dropForeignKeyForColumn(client, table, column) {
  const result = await client.query(`
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = $1::regclass AND c.contype = 'f' AND a.attname = $2
  `, [table, column]);
  assert.equal(result.rows.length, 1, `expected one FK for ${table}.${column}`);
  await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${quotedIdentifier(result.rows[0].conname)}`);
}

describe('0033 Preorder Customer Check-in canonical isolated rehearsal', () => {
  it('runs canonical migrations through 0032, preflights and applies 0033 through the runner, and blocks incompatible existing shapes', async (t) => {
    if (!enabled || !testDbUrl) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');

    const parsedUrl = new URL(testDbUrl);
    const guard = validatePostgresTestGuard(testDbUrl, {
      allowedHosts: parsedUrl.hostname,
      allowedProjectRefs: teaPlusTestProjectRef,
      productionProjectRefs: productionProjectRef,
    });
    assert.equal(guard.valid, true);

    const schema = schemaName();
    const pool = createSchemaScopedPool(schema);
    const preflightSql = await readFile(preflightPath, 'utf8');
    const migrationSql = await readFile(migrationPath, 'utf8');
    let client;
    try {
      await createIsolatedSchema(schema);
      await applyCanonicalPost0032Chain(pool, schema);

      client = await pool.connect();
      await assertSessionSchema(client, schema);
      await seedCheckinFixture(client);

      // Canonical post-0032 baseline: both 0033 tables are absent and every
      // production preflight check must pass before any 0033 mutation.
      await assertPreflightPasses(client, preflightSql);
      client.release();
      client = null;

      const firstRun = await runMigrations({
        pool,
        toVersion: '0033',
        beforeMigration: provideMigrationInput,
        guardOptions: migrationGuardOptions(),
        advisoryLockName: migrationLockName(schema),
        logger: silentMigrationLogger,
      });
      assert.equal(firstRun.at(-1)?.version, '0033');
      assert.equal(firstRun.at(-1)?.status, 'applied');

      client = await pool.connect();
      await assertSessionSchema(client, schema);
      const tracker = await client.query("SELECT version, name, checksum FROM schema_migrations WHERE version = '0033'");
      assert.deepEqual(tracker.rows, [{
        version: '0033',
        name: '0033_preorder_customer_checkin.sql',
        checksum: calculateChecksum(migrationSql),
      }]);

      const { rows: preorderRows } = await client.query("SELECT id, scheduled_start_at, scheduled_end_at FROM preorders WHERE preorder_code = 'PO-CHECKIN-1'");
      const preorder = preorderRows[0];
      assert.ok(preorder?.id);

      // The parent-snapshot trigger runs before row constraints. Disable only
      // that trigger momentarily in this generated schema to exercise the
      // schedule CHECK itself; always restore it before continuing runtime
      // and compatibility checks.
      await client.query('ALTER TABLE preorder_checkin_requests DISABLE TRIGGER trg_preorder_checkin_parent_snapshot');
      try {
        await assert.rejects(
          () => client.query(`
            INSERT INTO preorder_checkin_requests (preorder_id, store_id, customer_user_id, scheduled_start_at, scheduled_end_at, status)
            VALUES ($1, 1, 1, $2, $3, 'PENDING')
          `, [preorder.id, preorder.scheduled_end_at, preorder.scheduled_start_at]),
          /chk_preorder_checkin_schedule/,
        );
      } finally {
        await client.query('ALTER TABLE preorder_checkin_requests ENABLE TRIGGER trg_preorder_checkin_parent_snapshot');
      }
      await assert.rejects(
        () => client.query(`
          INSERT INTO preorder_checkin_requests (preorder_id, store_id, customer_user_id, scheduled_start_at, scheduled_end_at, status)
          VALUES ($1, 1, 9, $2, $3, 'PENDING')
        `, [preorder.id, preorder.scheduled_start_at, preorder.scheduled_end_at]),
        /customer_user_id .* does not match parent preorder/,
      );
      await assert.rejects(
        () => client.query(`
          INSERT INTO preorder_checkin_requests (preorder_id, store_id, customer_user_id, scheduled_start_at, scheduled_end_at, status, resolved_by, resolved_at)
          VALUES ($1, 1, 1, $2, $3, 'PENDING', 2, CURRENT_TIMESTAMP)
        `, [preorder.id, preorder.scheduled_start_at, preorder.scheduled_end_at]),
        /chk_preorder_checkin_status_resolution/,
      );
      const request = await client.query(`
        INSERT INTO preorder_checkin_requests (preorder_id, store_id, customer_user_id, scheduled_start_at, scheduled_end_at, status)
        VALUES ($1, 1, 1, $2, $3, 'PENDING') RETURNING id
      `, [preorder.id, preorder.scheduled_start_at, preorder.scheduled_end_at]);
      assert.ok(request.rows[0]?.id);
      await assert.rejects(
        () => client.query(`
          INSERT INTO preorder_slot_strike_events (preorder_id, scheduled_start_at, manager_id, strike_source)
          VALUES ($1, $2, 2, 'CONFIRMATION_BREACH'), ($1, $2, 2, 'CHECKIN_BREACH')
        `, [preorder.id, preorder.scheduled_start_at]),
        /uq_preorder_slot_strike/,
      );

      // Hide only the tracker row inside each rollback-only negative case so
      // the preflight evaluates the physical object shape, not the expected
      // already-applied tracker blocker.
      await withTrackerHidden(client, () => assertPreflightPasses(client, preflightSql));
      await expectCompatibilityBlock(client, preflightSql, 'partial_0033_installation', async () => {
        await client.query('DROP TABLE preorder_slot_strike_events');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_column_shape_compatible', async () => {
        await client.query('ALTER TABLE preorder_checkin_requests DROP COLUMN late_confirmation_reason');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_column_shape_compatible', async () => {
        await client.query('ALTER TABLE preorder_checkin_requests ALTER COLUMN created_at DROP DEFAULT');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_column_shape_compatible', async () => {
        await client.query('ALTER TABLE preorder_checkin_requests ALTER COLUMN status TYPE VARCHAR(41)');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_unique_constraints_exact', async () => {
        await client.query('ALTER TABLE preorder_checkin_requests DROP CONSTRAINT uq_preorder_checkin_slot');
        await client.query('ALTER TABLE preorder_checkin_requests ADD CONSTRAINT uq_preorder_checkin_slot UNIQUE (store_id, scheduled_start_at)');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_check_constraints_exact', async () => {
        await client.query('ALTER TABLE preorder_checkin_requests DROP CONSTRAINT chk_preorder_checkin_status_resolution');
        await client.query("ALTER TABLE preorder_checkin_requests ADD CONSTRAINT chk_preorder_checkin_status_resolution CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED'))");
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_foreign_keys_exact', async () => {
        await dropForeignKeyForColumn(client, 'preorder_checkin_requests', 'resolved_by');
        await client.query('ALTER TABLE preorder_checkin_requests ADD CONSTRAINT wrong_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE CASCADE');
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_indexes_exact', async () => {
        await client.query('DROP INDEX idx_preorder_checkin_requests_due');
        await client.query("CREATE INDEX idx_preorder_checkin_requests_due ON preorder_checkin_requests (scheduled_start_at, status) WHERE status = 'PENDING'");
      });
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_trigger_function_exact', async () => {
        await client.query('DROP TRIGGER trg_preorder_checkin_parent_snapshot ON preorder_checkin_requests');
        await client.query('CREATE TRIGGER trg_preorder_checkin_parent_snapshot AFTER INSERT ON preorder_checkin_requests FOR EACH ROW EXECUTE FUNCTION trg_verify_preorder_checkin_parent_snapshot()');
      });
      const shadowSchema = schemaName('preorder_checkin_shadow');
      await expectCompatibilityBlock(client, preflightSql, 'existing_0033_trigger_function_exact', async () => {
        await client.query(`CREATE SCHEMA ${quotedIdentifier(shadowSchema)}`);
        await client.query('DROP TRIGGER trg_preorder_checkin_parent_snapshot ON preorder_checkin_requests');
        await client.query('DROP FUNCTION trg_verify_preorder_checkin_parent_snapshot()');
        await client.query(`CREATE FUNCTION ${quotedIdentifier(shadowSchema)}.trg_verify_preorder_checkin_parent_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`);
        await client.query(`CREATE TRIGGER trg_preorder_checkin_parent_snapshot BEFORE INSERT OR UPDATE ON preorder_checkin_requests FOR EACH ROW EXECUTE FUNCTION ${quotedIdentifier(shadowSchema)}.trg_verify_preorder_checkin_parent_snapshot()`);
      });

      client.release();
      client = null;
      const secondRun = await runMigrations({
        pool,
        toVersion: '0033',
        beforeMigration: provideMigrationInput,
        guardOptions: migrationGuardOptions(),
        advisoryLockName: migrationLockName(schema),
        logger: silentMigrationLogger,
      });
      assert.equal(secondRun.find((entry) => entry.version === '0033')?.status, 'already_applied');
    } finally {
      if (client) client.release();
      await pool.end();
      await dropIsolatedSchema(schema);
    }
  });
});
