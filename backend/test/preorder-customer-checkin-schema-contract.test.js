import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateChecksum } from '../database/postgres/migrate.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('0033 preorder customer checkin schema contract', () => {
  it('is additive and defines preorder checkin requests and slot strike idempotency without touching prior migrations', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'migrations', '0033_preorder_customer_checkin.sql'), 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS preorder_checkin_requests/i);
    assert.match(sql, /preorder_id BIGINT NOT NULL REFERENCES preorders\(id\)/i);
    assert.match(sql, /customer_user_id BIGINT NOT NULL REFERENCES users\(id\)/i);
    assert.match(sql, /scheduled_start_at TIMESTAMPTZ NOT NULL/i);
    assert.match(sql, /CHECK \(status IN \('PENDING', 'CONFIRMED', 'REJECTED', 'RESCHEDULED'\)\)/i);
    assert.match(sql, /CONSTRAINT uq_preorder_checkin_slot UNIQUE \(preorder_id, scheduled_start_at\)/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS preorder_slot_strike_events/i);
    assert.match(sql, /CHECK \(strike_source IN \('CONFIRMATION_BREACH', 'CHECKIN_BREACH'\)\)/i);
    assert.match(sql, /CONSTRAINT uq_preorder_slot_strike UNIQUE \(preorder_id, scheduled_start_at\)/i);
    assert.doesNotMatch(sql, /ALTER TABLE preorders/i);
    assert.doesNotMatch(sql, /ALTER TABLE payment_attempts/i);
    assert.doesNotMatch(sql, /DROP\s+(TABLE|INDEX|CONSTRAINT)/i);
    assert.match(calculateChecksum(sql), /^[a-f0-9]{64}$/);
  });

  it('keeps its production preflight read-only', async () => {
    const sql = await readFile(path.join(root, 'database', 'postgres', 'verification', '0033_preorder_customer_checkin_preflight_readonly.sql'), 'utf8');
    assert.match(sql, /^--[\s\S]*\b(?:SELECT|WITH)\b/i);
    const stripped = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
      .replace(/'(?:''|[^'])*'/g, "''");
    assert.doesNotMatch(stripped, /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/im);
  });
});
