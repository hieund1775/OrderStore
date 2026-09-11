import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateChecksum } from '../database/postgres/migrate.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('0030 preorder schema contract', () => {
  it('is additive and pins the preorder aggregate invariants without touching P1 tables', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'migrations', '0030_preorder_v1.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS preorder_store_settings/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS preorders/i);
    assert.match(sql, /customer_user_id BIGINT NOT NULL/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS preorder_table_reservations/i);
    assert.match(sql, /EXCLUDE USING gist/i);
    assert.match(sql, /preorder_reschedule_history/i);
    assert.match(sql, /manager_preorder_strikes/i);
    assert.match(sql, /preorder_notification_deliveries/i);
    assert.match(sql, /validate_preorder_checkout_group_link/i);
    assert.match(sql, /'processing'/i);
    assert.match(sql, /processing_at TIMESTAMPTZ/i);
    assert.match(sql, /applies_to_preorder BOOLEAN NOT NULL DEFAULT FALSE/i);
    assert.doesNotMatch(sql, /ALTER TABLE payment_attempts/i);
    assert.doesNotMatch(sql, /DROP\s+(TABLE|INDEX|CONSTRAINT)/i);
    assert.match(calculateChecksum(sql), /^[a-f0-9]{64}$/);
  });

  it('makes T-60 reminders due before scheduled start and claims email delivery idempotently', async () => {
    const repository = await readFile(path.join(root, 'repositories', 'postgres', 'preorders.js'), 'utf8');
    assert.match(repository, /scheduled_start_at <= \$1 \+ INTERVAL '1 hour'/);
    assert.match(repository, /FOR UPDATE SKIP LOCKED/);
    assert.match(repository, /status = 'processing'/);
  });

  it('keeps its production preflight read-only', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'verification', '0030_preorder_preflight_readonly.sql'), 'utf8');
    assert.match(sql, /^--[\s\S]*\bSELECT\b/i);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  });
});
