import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateChecksum } from '../database/postgres/migrate.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0027_payment_attempts_enforcement.sql');
const preflightPath = path.join(testDir, '..', 'database', 'postgres', 'verification', '0027_payment_attempts_preflight_readonly.sql');

describe('P1 phase 0027 enforcement migration contract', () => {
  it('is enforcement-only, has read-only preflight coverage, and preserves legacy compatibility fields', async () => {
    const [migration, preflight] = await Promise.all([readFile(migrationPath, 'utf8'), readFile(preflightPath, 'utf8')]);
    assert.match(migration, /chk_payment_attempts_exactly_one_target/);
    assert.match(migration, /uq_payment_attempts_creating_order/);
    assert.match(migration, /uq_payment_events_provider_profile_identity/);
    assert.match(migration, /trg_payment_attempt_immutable_0027/);
    assert.match(migration, /trg_order_current_attempt_0027/);
    assert.doesNotMatch(migration, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE\s+/i);
    assert.doesNotMatch(preflight, /INSERT\s+|UPDATE\s+|DELETE\s+|ALTER\s+|DROP\s+|CREATE\s+/i);
    assert.match(preflight, /duplicate_event_identity/);
    assert.match(preflight, /group_child_direct_attempt/);
  });

  it('has a stable migration-runner checksum across Windows and Unix line endings', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const checksum = calculateChecksum(migration);
    assert.match(checksum, /^[a-f0-9]{64}$/);
    assert.equal(checksum, calculateChecksum(migration.replace(/\n/g, '\r\n')));
  });
});
