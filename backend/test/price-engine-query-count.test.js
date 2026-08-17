import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcLineTotals } from '../services/price-engine.js';

describe('Price Engine & Create Order Query Optimization Suite', () => {
  it('returns server-verified product_name along with calculated line total', async () => {
    const executedQueries = [];

    // Mock query runner that tracks queries
    const mockQuery = async (sqlText, params = []) => {
      executedQueries.push({ sql: sqlText, params });
      if (sqlText.includes('FROM products')) {
        return [[{ id: 10, name: 'Trà Sữa Trân Châu Hoàng Gia', price: 35000 }], 1];
      }
      if (sqlText.includes('FROM size_options')) {
        return [[{ id: 2, price_extra: 5000 }], 1];
      }
      if (sqlText.includes('FROM toppings')) {
        return [[{ id: 1, name: 'Trân châu đen', price: 5000 }], 1];
      }
      return [[], 0];
    };

    const line = await calcLineTotals(
      { product_id: 10, size_id: 2, topping_ids: [1], qty: 2 },
      mockQuery
    );

    assert.equal(line.product_id, 10);
    assert.equal(line.product_name, 'Trà Sữa Trân Châu Hoàng Gia');
    assert.equal(line.unit_price, 40000); // 35k + 5k size
    assert.equal(line.toppingsTotal, 5000);
    assert.equal(line.line_total, 90000); // (40k + 5k) * 2

    // Verify products table was queried exactly once for this line
    const productQueries = executedQueries.filter((q) => q.sql.includes('FROM products'));
    assert.equal(productQueries.length, 1);
  });

  it('eliminates duplicate product name lookup for multi-item orders', async () => {
    let productQueryCount = 0;

    const mockQuery = async (sqlText, params = []) => {
      if (sqlText.includes('FROM products')) {
        productQueryCount++;
        const id = params[0];
        return [[{ id, name: `Trà Trái Cây #${id}`, price: 30000 }], 1];
      }
      return [[], 0];
    };

    const items = [
      { product_id: 1, qty: 1 },
      { product_id: 2, qty: 2 },
      { product_id: 3, qty: 1 },
    ];

    const lines = [];
    for (const item of items) {
      const line = await calcLineTotals(item, mockQuery);
      lines.push({ ...item, ...line });
    }

    assert.equal(lines.length, 3);
    assert.equal(lines[0].product_name, 'Trà Trái Cây #1');
    assert.equal(lines[1].product_name, 'Trà Trái Cây #2');
    assert.equal(lines[2].product_name, 'Trà Trái Cây #3');

    // Exactly 3 product queries for 3 items during pricing, 0 duplicate lookups during insert
    assert.equal(productQueryCount, 3);
  });
});
