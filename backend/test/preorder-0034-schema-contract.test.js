import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateChecksum } from '../database/postgres/migrate.js';
import { hasExecutableMutationStatement } from './helpers/sql-readonly.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('0034 preorder store checkin and handover schema contract', () => {
  it('is additive and defines handover confirmed/overdue columns and operational indexes', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'migrations', '0034_preorder_store_checkin_handover.sql'), 'utf8');
    assert.match(sql, /ALTER TABLE preorders/i);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS handover_confirmed_at TIMESTAMPTZ NULL/i);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS handover_confirmed_by BIGINT NULL REFERENCES users\(id\) ON DELETE RESTRICT/i);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS handover_overdue_at TIMESTAMPTZ NULL/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_preorders_active_schedule/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_preorders_handover_overdue/i);
    assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_preorders_unchecked_in_active/i);
    assert.doesNotMatch(sql, /ALTER TABLE payment_attempts/i);
    assert.doesNotMatch(sql, /ALTER TABLE reviews/i);
    assert.doesNotMatch(sql, /DROP\s+(TABLE|INDEX|CONSTRAINT|COLUMN)/i);
    assert.match(calculateChecksum(sql), /^[a-f0-9]{64}$/);
  });

  it('keeps its production preflight read-only', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'verification', '0034_preorder_store_checkin_handover_preflight_readonly.sql'), 'utf8');
    assert.match(sql, /^--[\s\S]*\b(?:SELECT|WITH)\b/i);
    assert.equal(hasExecutableMutationStatement(sql), false);
  });
});
