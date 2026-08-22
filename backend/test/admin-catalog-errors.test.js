import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminCatalogError, createAdminCatalogRepository } from '../repositories/postgres/admin-catalog.js';
import { validateProductInput } from '../validation/catalog-schemas.js';

describe('Admin Catalog PostgreSQL Error Mapping Suite', () => {
  it('preserves zero calories for PostgreSQL NOT NULL products.calories', () => {
    const validated = validateProductInput({
      category_id: 1,
      name: 'Trà mới',
      slug: 'tra-moi',
      price: 0,
      calories: 0,
    });

    assert.equal(validated.calories, 0);
  });

  it('maps duplicate category slug to HTTP 409 with a category-specific message', async () => {
    const db = {
      async query(sql) {
        if (sql.includes('INSERT INTO categories')) {
          const error = new Error('duplicate key value violates unique constraint');
          error.code = '23505';
          error.constraint = 'categories_slug_key';
          throw error;
        }
        return [[], 0];
      },
    };

    const repo = createAdminCatalogRepository(db);
    await assert.rejects(
      () => repo.createCategory({ name: 'Trà mới', slug: 'tra-moi' }),
      (error) => error instanceof AdminCatalogError
        && error.status === 409
        && error.message.includes('danh mục'),
    );
  });

  it('maps duplicate product slug to HTTP 409 with a product-specific message', async () => {
    const db = {
      async query(sql) {
        if (sql.includes('INSERT INTO products')) {
          const error = new Error('duplicate key value violates unique constraint');
          error.code = '23505';
          error.constraint = 'products_slug_key';
          throw error;
        }
        return [[], 0];
      },
    };

    const repo = createAdminCatalogRepository(db);
    await assert.rejects(
      () => repo.createProduct({ category_id: 1, name: 'Trà mới', slug: 'tra-moi' }),
      (error) => error instanceof AdminCatalogError
        && error.status === 409
        && error.message.includes('món'),
    );
  });
});
