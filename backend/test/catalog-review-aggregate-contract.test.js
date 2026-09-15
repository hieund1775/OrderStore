import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCatalogV2Repository } from '../repositories/postgres/public-catalog-v2.js';
import { toProductV2Dto } from '../dto/catalog-v2-dto.js';

describe('public catalog review aggregate contract', () => {
  it('reads only visible verified review aggregates for menu cards and product detail', async () => {
    const statements = [];
    const database = {
      async query(sql) {
        statements.push(sql);
        if (sql.includes('COUNT(DISTINCT p.id)')) return [[{ total: 1 }]];
        return [[{
          id: 1,
          name: 'Trà cam',
          slug: 'tra-cam',
          rating: '4.5',
          review_count: 2,
        }]];
      },
    };
    const repo = createPublicCatalogV2Repository(database);

    await repo.listProducts({ storeId: 1, limit: 10, offset: 0 });
    await repo.getProductBySlug('tra-cam', { storeId: 1 });

    const aggregateQueries = statements.filter((sql) => sql.includes('FROM reviews rev'));
    assert.ok(aggregateQueries.length >= 2);
    for (const sql of aggregateQueries) {
      assert.ok(sql.includes("rev.purchase_verified_at IS NOT NULL"));
      assert.ok(sql.includes("rev.visibility_status = 'visible'"));
      assert.ok(sql.includes('AVG(rr.rating)'));
    }
    assert.ok(aggregateQueries.some((sql) => sql.includes('COUNT(*)::int')));
  });

  it('keeps the API aggregate zero/zero so the UI can present 5.0 / 0 honestly', () => {
    const dto = toProductV2Dto({ id: 1, category_id: 1, name: 'Trà mới', slug: 'tra-moi', price: 30000, rating: 0, review_count: 0 });
    assert.equal(dto.rating, 0);
    assert.equal(dto.review_count, 0);
  });
});
