import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileQuery, esc } from '../database/legacy/sqlserver-db.js';

describe('Database Parameter Compiler & Query Contract Suite', () => {
  it('escapes primitives and strings safely for Trusted connection inlining', () => {
    assert.equal(esc(null), 'NULL');
    assert.equal(esc(undefined), 'NULL');
    assert.equal(esc(50), '50');
    assert.equal(esc(3.14), '3.14');
    assert.equal(esc("O'Reilly"), "N'O''Reilly'");
    assert.equal(esc(new Date('2026-08-17T12:00:00.000Z')), "'2026-08-17T12:00:00.000Z'");
  });

  it('compiles queries in SQL Auth mode with @p0..@pN parameters and inputs', () => {
    const sql = 'SELECT TOP (?) * FROM orders WHERE store_id = ? AND total > ?';
    const params = [51, 1, 100000];

    const result = compileQuery(sql, params, false); // SQL Auth mode

    assert.equal(
      result.sqlText,
      'SELECT TOP (@p0) * FROM orders WHERE store_id = @p1 AND total > @p2'
    );
    assert.equal(result.inputs.length, 3);
    assert.deepEqual(result.inputs[0], { name: 'p0', value: 51 });
    assert.deepEqual(result.inputs[1], { name: 'p1', value: 1 });
    assert.deepEqual(result.inputs[2], { name: 'p2', value: 100000 });
  });

  it('compiles queries in Trusted mode with inlined escaped values (zero @p parameters)', () => {
    const sql = 'SELECT TOP (?) * FROM orders WHERE store_id = ? AND customer_name = ?';
    const params = [51, 1, "Nguyen O'Brien"];

    const result = compileQuery(sql, params, true); // Trusted mode

    assert.equal(
      result.sqlText,
      "SELECT TOP (51) * FROM orders WHERE store_id = 1 AND customer_name = N'Nguyen O''Brien'"
    );
    assert.equal(result.inputs.length, 0);
    assert.equal(result.sqlText.includes('@p'), false, 'Must not contain any @p variables in Trusted mode');
  });

  it('throws on parameter count mismatch to prevent corrupt or incomplete queries', () => {
    const sql = 'SELECT * FROM orders WHERE id = ? AND store_id = ?';

    assert.throws(
      () => compileQuery(sql, [1]), // only 1 param for 2 placeholders
      /Parameter count mismatch/
    );

    assert.throws(
      () => compileQuery(sql, [1, 2, 3]), // 3 params for 2 placeholders
      /Parameter count mismatch/
    );
  });

  it('compiles complex Keyset pagination query across both SQL Auth and Trusted modes seamlessly', () => {
    const query = `
      SELECT TOP (?) o.id, o.order_code
      FROM orders o
      WHERE o.store_id = ?
        AND o.created_at >= ? AND o.created_at < ?
        AND (o.created_at < ? OR (o.created_at = ? AND o.id < ?))
      ORDER BY o.created_at DESC, o.id DESC
    `;
    const params = [
      51,
      1,
      '2026-08-01 00:00:00.000',
      '2026-08-18 00:00:00.000',
      '2026-08-17 12:00:00.000',
      '2026-08-17 12:00:00.000',
      105,
    ];

    // 1) SQL Auth verification
    const sqlAuthRes = compileQuery(query, params, false);
    assert.equal(
      sqlAuthRes.sqlText.includes('TOP (@p0)'),
      true
    );
    assert.equal(sqlAuthRes.inputs.length, 7);
    assert.equal(sqlAuthRes.inputs[6].name, 'p6');
    assert.equal(sqlAuthRes.inputs[6].value, 105);

    // 2) Trusted verification
    const trustedRes = compileQuery(query, params, true);
    assert.equal(trustedRes.sqlText.includes('TOP (51)'), true);
    assert.equal(trustedRes.sqlText.includes('105'), true);
    assert.equal(trustedRes.sqlText.includes('@p'), false);
  });
});
