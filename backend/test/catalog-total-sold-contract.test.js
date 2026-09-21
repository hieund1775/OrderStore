import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRepository } from '../repositories/postgres/catalog.js';
import { toProductDto } from '../dto/catalog-dto.js';

describe('catalog total_sold & review data contract', () => {
  it('includes total_sold in listProducts and findProductBySlug queries', async () => {
    const statements = [];
    const database = {
      async query(sql, params) {
        statements.push({ sql, params });
        return [[{
          id: 1,
          name: 'Trà Đào Cam Sả',
          slug: 'tra-dao-cam-sa',
          category_id: 1,
          rating: '5.0',
          review_count: 1,
          total_sold: 70,
        }]];
      },
    };

    const repo = createCatalogRepository(database);
    const products = await repo.listProducts();
    const product = await repo.findProductBySlug('tra-dao-cam-sa');

    assert.equal(products.length, 1);
    assert.equal(products[0].total_sold, 70);
    assert.equal(product.total_sold, 70);

    const listSql = statements[0].sql;
    assert.ok(listSql.includes('total_sold'), 'Expected listProducts query to include total_sold');
    assert.ok(listSql.includes('order_items'), 'Expected listProducts query to join order_items');

    const slugSql = statements[1].sql;
    assert.ok(slugSql.includes('total_sold'), 'Expected findProductBySlug query to include total_sold');
    assert.ok(slugSql.includes('order_items'), 'Expected findProductBySlug query to join order_items');
  });

  it('correctly maps total_sold in toProductDto', () => {
    const dto = toProductDto({
      id: 1,
      category_id: 2,
      name: 'Trà Đào Cam Sả',
      slug: 'tra-dao-cam-sa',
      price: 35000,
      rating: 5,
      review_count: 3,
      total_sold: 45,
    });

    assert.equal(dto.total_sold, 45);
    assert.equal(dto.rating, 5);
    assert.equal(dto.review_count, 3);
  });

  it('defaults total_sold to 0 if null or undefined', () => {
    const dto = toProductDto({
      id: 2,
      category_id: 2,
      name: 'Món mới',
      slug: 'mon-moi',
    });

    assert.equal(dto.total_sold, 0);
  });
});
