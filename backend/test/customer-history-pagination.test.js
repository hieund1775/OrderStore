import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeCursor,
  decodeCursor,
  validatePaginationLimit,
  buildPageInfo,
  CursorValidationError,
} from '../services/cursor-pagination.js';
import { batchLoadOrderDetails } from '../services/order-batch-loader.js';

describe('Customer History & Cursor Pagination Service Suite', () => {
  it('encodes and decodes pagination cursor deterministically', () => {
    const createdAt = new Date('2026-08-17T10:30:00.000Z');
    const cursor = encodeCursor({ createdAt, id: 1234 });

    assert.ok(cursor);
    assert.equal(typeof cursor, 'string');

    const decoded = decodeCursor(cursor);
    assert.equal(decoded.id, 1234);
    assert.equal(decoded.createdAt.toISOString(), createdAt.toISOString());
  });

  it('rejects malformed or tampered cursor with 400 status error', () => {
    assert.throws(
      () => decodeCursor('invalid-base64-random-string'),
      (err) => err instanceof CursorValidationError && err.status === 400
    );

    // Missing fields in valid base64 json
    const badPayload = Buffer.from(JSON.stringify({ c: '2026-01-01' })).toString('base64url');
    assert.throws(
      () => decodeCursor(badPayload),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
  });

  it('validates pagination limit within boundary (1 to 100)', () => {
    assert.equal(validatePaginationLimit(undefined), 50); // Default 50
    assert.equal(validatePaginationLimit('25'), 25);
    assert.equal(validatePaginationLimit(100), 100);

    assert.throws(
      () => validatePaginationLimit(0),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
    assert.throws(
      () => validatePaginationLimit(150),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
  });

  it('builds page_info with has_more and next_cursor accurately', () => {
    const rows = [
      { id: 1, created_at: new Date('2026-08-17T12:00:00Z') },
      { id: 2, created_at: new Date('2026-08-17T11:00:00Z') },
      { id: 3, created_at: new Date('2026-08-17T10:00:00Z') }, // 3 rows, limit 2 -> has_more = true
    ];

    const result = buildPageInfo({ rows, limit: 2 });
    assert.equal(result.rows.length, 2);
    assert.equal(result.page_info.has_more, true);
    assert.ok(result.page_info.next_cursor);

    const nextDecoded = decodeCursor(result.page_info.next_cursor);
    assert.equal(nextDecoded.id, 2);
  });

  it('proves batchLoadOrderDetails executes EXACTLY 2 queries for 50 orders (eliminating N+1)', async () => {
    const executedQueries = [];

    const mockQuery = async (sqlText, params = []) => {
      executedQueries.push({ sql: sqlText, params });

      if (sqlText.includes('FROM order_items')) {
        // Return 2 items per order
        const items = [];
        for (const orderId of params) {
          items.push({ id: orderId * 10 + 1, order_id: orderId, product_id: 1, product_name: 'Trà Sữa', qty: 1, unit_price: 30000 });
          items.push({ id: orderId * 10 + 2, order_id: orderId, product_id: 2, product_name: 'Trà Đào', qty: 1, unit_price: 35000 });
        }
        return [items, items.length];
      }

      if (sqlText.includes('FROM order_item_toppings')) {
        const toppings = [];
        for (const itemId of params) {
          toppings.push({ id: itemId * 100 + 1, order_item_id: itemId, topping_name: 'Trân châu', topping_price: 5000 });
        }
        return [toppings, toppings.length];
      }

      return [[], 0];
    };

    // Simulate 50 orders
    const orders = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, order_code: `TP${i + 1}` }));

    const enriched = await batchLoadOrderDetails(orders, mockQuery);

    assert.equal(enriched.length, 50);
    assert.equal(enriched[0].items.length, 2);
    assert.equal(enriched[0].items[0].toppings.length, 1);
    assert.equal(enriched[49].items.length, 2);

    // CRITICAL ASSERTION: Exactly 2 batch queries executed instead of 50 individual queries
    assert.equal(executedQueries.length, 2, 'Must execute exactly 2 queries (1 items + 1 toppings) for 50 orders');
  });

  it('handles 0 orders with 0 database queries', async () => {
    let queryCount = 0;
    const mockQuery = async () => {
      queryCount++;
      return [[], 0];
    };

    const emptyResult = await batchLoadOrderDetails([], mockQuery);
    assert.deepEqual(emptyResult, []);
    assert.equal(queryCount, 0);
  });
});
