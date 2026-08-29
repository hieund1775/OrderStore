import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';

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
});
