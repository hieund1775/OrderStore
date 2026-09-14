import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasExecutableMutationStatement } from './helpers/sql-readonly.js';

describe('read-only SQL assertion helper', () => {
  it('ignores mutation-looking text in comments and literals', () => {
    assert.equal(hasExecutableMutationStatement(`
      -- ON DELETE RESTRICT is an FK action, not a statement
      WITH note AS (SELECT 'CREATE TABLE is only text'::text)
      SELECT * FROM note;
    `), false);
  });

  it('rejects executable mutation statements after a SELECT', () => {
    assert.equal(hasExecutableMutationStatement('SELECT 1; DELETE FROM orders;'), true);
  });
});
