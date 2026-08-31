import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';
import { createPublicCatalogV2Repository } from '../repositories/postgres/public-catalog-v2.js';
import { validateSubtreeProductsQuery } from '../validation/catalog-v2-schemas.js';

test('Grouped sections repository keeps empty roots and filters unavailable catalog rows', async () => {
  const queries = [];
  const queuedRows = [
    [{
      root_id: 1,
      root_name: 'Thực đơn',
      root_slug: 'thuc-don',
      total_products: 0,
      children: [],
      products: [],
    }],
  ];
  const database = {
    async query(sql, params) {
      queries.push({ sql, params });
      return [queuedRows.shift() || []];
    },
  };

  const repository = createPublicCatalogV2Repository(database);
  const sections = await repository.getGroupedSections({ storeId: 1, limitPerRoot: 12 });

  assert.equal(sections.length, 1);
  assert.equal(sections[0].root_slug, 'thuc-don');
  assert.equal(sections[0].total_products, 0);
  assert.deepEqual(sections[0].products, []);

  assert.equal(queries.length, 1);
  const productSql = queries[0].sql;
  assert.match(productSql, /p\.is_available = TRUE/);
  assert.match(productSql, /bvo\.is_available = TRUE/);
  assert.match(productSql, /JOIN LATERAL \(/);
  assert.doesNotMatch(productSql, /LEFT JOIN LATERAL \(/);
  assert.match(productSql, /COALESCE\(bvi\.on_hand, 0\) - COALESCE\(bvi\.reserved, 0\) > 0/);
});

test('Branch-aware category tree requires an available offer with a branch price', async () => {
  const queries = [];
  const repository = createPublicCatalogV2Repository({
    async query(sql, params) {
      queries.push({ sql, params });
      return [[]];
    },
  });

  await repository.getCategoryTree(7);

  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].params, [7]);
  assert.match(queries[0].sql, /bvo\.is_available = TRUE AND bvo\.price IS NOT NULL/);
});

test('Public product details require branch context', async () => {
  let capturedStoreId = null;
  const service = createPublicCatalogV2Service({
    catalogRepository: {
      async getProductBySlug(_slug, { storeId }) {
        capturedStoreId = storeId;
        return { id: 10, slug: 'tra-dao' };
      },
    },
  });

  await assert.rejects(
    () => service.getProductBySlug('tra-dao'),
    (error) => error.status === 400,
  );
  await service.getProductBySlug('tra-dao', { storeId: '2' });
  assert.equal(capturedStoreId, 2);
});

test('Subtree pagination rejects non-integer query values before reaching SQL', () => {
  assert.throws(
    () => validateSubtreeProductsQuery({ store_id: '1', limit: 'abc' }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => validateSubtreeProductsQuery({ store_id: '1', offset: '-1' }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => validateSubtreeProductsQuery({ store_id: '1', category: 'a'.repeat(151) }),
    (error) => error.status === 400,
  );
});

test('Root Category Navigation Contract Suite', async (t) => {
  await t.test('Characterization: Public tree builds nested hierarchy from repository rows', async () => {
    const mockRepo = {
      async getCategoryTree() {
        return [
          { id: 1, name: 'Thực đơn', parent_id: null, depth: 0 },
          { id: 2, name: 'Trà trái cây', parent_id: 1, depth: 1 },
        ];
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });
    const tree = await service.getCategoryTree();

    assert.equal(tree.length, 1);
    assert.equal(tree[0].name, 'Thực đơn');
    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[0].children[0].name, 'Trà trái cây');
  });

  await t.test('Characterization: Fail-closed when branch offer is missing for product variant', async () => {
    const mockRepo = {
      async getProductBySlug(slug, { storeId }) {
        return {
          id: 10,
          name: 'Trà Đào',
          attributes: [
            {
              id: 100,
              name: 'Size',
              role: 'variant',
              values: [{ id: 1001, label: 'M' }],
            },
          ],
          variants: [
            {
              id: 50,
              variant_signature: '100:1001',
              price: null, // missing branch offer
            },
          ],
        };
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });

    await assert.rejects(
      async () => service.resolveConfiguration({
        storeId: 1,
        productSlug: 'tra-dao',
        selectedVariantValueIds: [1001],
        selectedModifierValueIds: [],
      }),
      /Chi nhánh chưa thiết lập giá bán cho biến thể này/,
    );
  });

  // ═══════════ NEW BEHAVIOR CONTRACTS ═══════════

  await t.test('New Behavior: Grouped sections API returns products per root category with total_products', async () => {
    const mockRepo = {
      async getGroupedSections({ storeId, limitPerRoot }) {
        return [
          {
            root_id: 1,
            root_name: 'Thực đơn',
            root_slug: 'thuc-don',
            total_products: 15,
            products: [{ id: 101, name: 'Trà Trái Cây Tô', price: 35000 }],
            children: [{ id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay' }],
          },
        ];
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });

    assert.equal(
      typeof service.getSections,
      'function',
      'service.getSections must be defined in publicCatalogV2Service',
    );

    const sections = await service.getSections({ storeId: 1, limitPerRoot: 12 });
    assert.ok(Array.isArray(sections));
    assert.equal(sections.length, 1);
    assert.equal(sections[0].root_slug, 'thuc-don');
    assert.equal(sections[0].total_products, 15);
    assert.equal(sections[0].products.length, 1);
  });

  await t.test('New Behavior: Querying root category slug retrieves products across its entire subtree', async () => {
    let capturedParams = null;
    const mockRepo = {
      async findCategoryBySlug(slug) {
        if (slug === 'thuc-don') {
          return { id: 1, name: 'Thực đơn', slug: 'thuc-don', depth: 0, is_visible: true, archived_at: null };
        }
        return null;
      },
      async listProducts(params) {
        capturedParams = params;
        return {
          products: [{ id: 201, name: 'Trà Đào', price: 30000 }],
          total: 1,
        };
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });

    assert.equal(
      typeof service.listSubtreeProducts,
      'function',
      'service.listSubtreeProducts must be defined in publicCatalogV2Service',
    );

    const result = await service.listSubtreeProducts({ storeId: 1, categorySlug: 'thuc-don' });
    assert.equal(result.products.length, 1);
    assert.equal(capturedParams.categorySlug, 'thuc-don');
  });

  await t.test('New Behavior: Unknown or archived category slug returns typed 404 error', async () => {
    const mockRepo = {
      async findCategoryBySlug(slug) {
        return null;
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });

    await assert.rejects(
      async () => service.listSubtreeProducts({ storeId: 1, categorySlug: 'non-existent' }),
      (err) => err.status === 404 || /Không tìm thấy danh mục/.test(err.message),
    );
  });

  await t.test('Characterization: Root identity relies on ID and slug, never array index', async () => {
    const mockRepo = {
      async getCategoryTree() {
        return [
          { id: 10, name: 'Quần áo', slug: 'quan-ao', parent_id: null, depth: 0 },
          { id: 1, name: 'Thực đơn', slug: 'thuc-don', parent_id: null, depth: 0 },
        ];
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });
    const tree = await service.getCategoryTree();

    const beverage = tree.find((c) => c.slug === 'thuc-don' || c.id === 1);
    const apparel = tree.find((c) => c.slug === 'quan-ao' || c.id === 10);

    assert.equal(beverage.id, 1);
    assert.equal(apparel.id, 10);
  });

  await t.test('Alias Resolution: Resolving legacy slug thuc-don returns canonical category nuoc-uong', async () => {
    const mockRepo = {
      async findCategoryBySlug(slug) {
        if (slug === 'thuc-don' || slug === 'nuoc-uong') {
          return {
            id: 1,
            name: 'Nước uống',
            slug: 'nuoc-uong',
            canonical_slug: 'nuoc-uong',
            is_alias_resolved: slug === 'thuc-don',
          };
        }
        return null;
      },
      async listProducts(params) {
        return {
          products: [{ id: 101, name: 'Trà Đào' }],
          total: 1,
        };
      },
    };

    const service = createPublicCatalogV2Service({ catalogRepository: mockRepo });
    const result = await service.listSubtreeProducts({ storeId: 1, categorySlug: 'thuc-don' });

    assert.equal(result.products.length, 1);
    assert.equal(result.category.slug, 'nuoc-uong');
    assert.equal(result.category.is_alias_resolved, true);
  });
});

