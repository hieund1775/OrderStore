import { describe, it, expect } from 'vitest';
import {
  buildCategoryBreadcrumb,
  collectCategorySubtreeIds,
  getChildrenByParentId,
  getLeafCategories,
  getRootCategories,
  isCategoryActive,
  isRootCategoryActive,
  publicCategoryTreeQueryKey,
  shouldUseMegaMenu,
} from '../catalog-navigation';
import type { PublicCategoryNode } from '../api';

describe('Category Navigation Suite', () => {
  it('filters root categories with depth 0 and no parent_id', () => {
    const categories = [
      { id: 1, name: 'Thực đơn', slug: 'thuc-don', depth: 0, parent_id: null, is_visible: true, children: [{ id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay' }] },
      { id: 10, name: 'Quần áo', slug: 'quan-ao', depth: 0, parent_id: null, is_visible: true, children: [{ id: 11, name: 'Áo thun', slug: 'ao-thun' }] },
      { id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay', depth: 1, parent_id: 1, is_visible: true },
    ];

    const roots = getRootCategories(categories);
    expect(roots.length).toBe(2);
    expect(roots[0].slug).toBe('thuc-don');
    expect(roots[1].slug).toBe('quan-ao');
  });

  it('collects all subtree category IDs for a selected root', () => {
    const categories = [
      { id: 1, name: 'Thực đơn', parent_id: null, depth: 0 },
      { id: 2, name: 'Trà trái cây', parent_id: 1, depth: 1 },
      { id: 3, name: 'Trà xoài', parent_id: 2, depth: 2 },
      { id: 10, name: 'Quần áo', parent_id: null, depth: 0 },
      { id: 11, name: 'Áo thun', parent_id: 10, depth: 1 },
    ];

    const ids = collectCategorySubtreeIds(categories, 1);

    expect(Array.from(ids)).toEqual([1, 2, 3]);
  });

  it('exposes only leaf categories to product forms with a complete breadcrumb', () => {
    const categories = [
      { id: 1, name: 'Thực đơn', parent_id: null, depth: 0 },
      { id: 2, name: 'Trà', parent_id: 1, depth: 1 },
      { id: 3, name: 'Trà đào', parent_id: 2, depth: 2 },
      { id: 10, name: 'Quần áo', parent_id: null, depth: 0 },
      { id: 11, name: 'Áo thun', parent_id: 10, depth: 1 },
    ];

    expect(getLeafCategories(categories).map((category) => category.id)).toEqual([3, 11]);
    expect(buildCategoryBreadcrumb(categories, 3)).toBe('Thực đơn / Trà / Trà đào');
    expect(buildCategoryBreadcrumb(categories, 11)).toBe('Quần áo / Áo thun');
  });

  it('uses one stable React Query key for Header and menu consumers', () => {
    expect(publicCategoryTreeQueryKey).toEqual(['public-catalog', 'category-tree']);
  });

  describe('shouldUseMegaMenu rules', () => {
    it('returns false for 0 roots', () => {
      expect(shouldUseMegaMenu([])).toBe(false);
    });

    it('returns false for 1-2 roots even if they have subcategories', () => {
      const oneRoot: PublicCategoryNode[] = [
        {
          id: 1,
          name: 'Nước uống',
          slug: 'nuoc-uong',
          parent_id: null,
          depth: 0,
          sort_order: 1,
          children: [
            { id: 2, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
            { id: 3, name: 'Cà phê', slug: 'ca-phe', parent_id: 1, depth: 1, sort_order: 2 },
          ],
        },
      ];
      expect(shouldUseMegaMenu(oneRoot)).toBe(false);

      const twoRoots: PublicCategoryNode[] = [
        ...oneRoot,
        {
          id: 10,
          name: 'Đồ ăn',
          slug: 'do-an',
          parent_id: null,
          depth: 0,
          sort_order: 2,
          children: [
            { id: 11, name: 'Bánh ngọt', slug: 'banh-ngot', parent_id: 10, depth: 1, sort_order: 1 },
          ],
        },
      ];
      expect(shouldUseMegaMenu(twoRoots)).toBe(false);
    });

    it('returns false for >= 3 roots but 0 children', () => {
      const threeRootsNoChildren: PublicCategoryNode[] = [
        { id: 1, name: 'Nước uống', slug: 'nuoc-uong', parent_id: null, depth: 0, sort_order: 1, children: [] },
        { id: 2, name: 'Đồ ăn', slug: 'do-an', parent_id: null, depth: 0, sort_order: 2, children: [] },
        { id: 3, name: 'Thời trang', slug: 'thoi-trang', parent_id: null, depth: 0, sort_order: 3, children: [] },
      ];
      expect(shouldUseMegaMenu(threeRootsNoChildren)).toBe(false);
    });

    it('returns false for >= 3 roots but only 1 root has children', () => {
      const threeRootsOneChildGroup: PublicCategoryNode[] = [
        {
          id: 1,
          name: 'Nước uống',
          slug: 'nuoc-uong',
          parent_id: null,
          depth: 0,
          sort_order: 1,
          children: [
            { id: 4, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
          ],
        },
        { id: 2, name: 'Đồ ăn', slug: 'do-an', parent_id: null, depth: 0, sort_order: 2, children: [] },
        { id: 3, name: 'Thời trang', slug: 'thoi-trang', parent_id: null, depth: 0, sort_order: 3, children: [] },
      ];
      expect(shouldUseMegaMenu(threeRootsOneChildGroup)).toBe(false);
    });

    it('returns true for >= 3 roots and >= 2 roots have children', () => {
      const richDataset: PublicCategoryNode[] = [
        {
          id: 1,
          name: 'Nước uống',
          slug: 'nuoc-uong',
          parent_id: null,
          depth: 0,
          sort_order: 1,
          children: [
            { id: 11, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
            { id: 12, name: 'Cà phê', slug: 'ca-phe', parent_id: 1, depth: 1, sort_order: 2 },
          ],
        },
        {
          id: 2,
          name: 'Đồ ăn',
          slug: 'do-an',
          parent_id: null,
          depth: 0,
          sort_order: 2,
          children: [
            { id: 21, name: 'Trái cây tô', slug: 'trai-cay-to', parent_id: 2, depth: 1, sort_order: 1 },
          ],
        },
        {
          id: 3,
          name: 'Thời trang',
          slug: 'thoi-trang',
          parent_id: null,
          depth: 0,
          sort_order: 3,
          children: [],
        },
      ];
      expect(shouldUseMegaMenu(richDataset)).toBe(true);
    });
  });

  describe('Category active detection', () => {
    const rootNode: PublicCategoryNode = {
      id: 1,
      name: 'Nước uống',
      slug: 'nuoc-uong',
      parent_id: null,
      depth: 0,
      sort_order: 1,
      children: [
        { id: 11, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
        { id: 12, name: 'Cà phê', slug: 'ca-phe', parent_id: 1, depth: 1, sort_order: 2 },
      ],
    };

    it('identifies exact category active', () => {
      expect(isCategoryActive('tra-sua', 'tra-sua')).toBe(true);
      expect(isCategoryActive('tra-sua', 'ca-phe')).toBe(false);
      expect(isCategoryActive('tra-sua', undefined)).toBe(false);
    });

    it('identifies root category active if root itself or any of its children is active', () => {
      expect(isRootCategoryActive(rootNode, 'nuoc-uong')).toBe(true);
      expect(isRootCategoryActive(rootNode, 'tra-sua')).toBe(true);
      expect(isRootCategoryActive(rootNode, 'ca-phe')).toBe(true);
      expect(isRootCategoryActive(rootNode, 'do-an')).toBe(false);
      expect(isRootCategoryActive(rootNode, undefined)).toBe(false);
    });
  });

  describe('getChildrenByParentId', () => {
    it('retrieves children either from nested children or flat list', () => {
      const tree: PublicCategoryNode[] = [
        {
          id: 1,
          name: 'Root 1',
          slug: 'r1',
          parent_id: null,
          depth: 0,
          sort_order: 1,
          children: [
            { id: 11, name: 'Child 11', slug: 'c11', parent_id: 1, depth: 1, sort_order: 1 },
          ],
        },
      ];
      expect(getChildrenByParentId(tree, 1)).toHaveLength(1);
      expect(getChildrenByParentId(tree, 1)[0].slug).toBe('c11');
      expect(getChildrenByParentId(tree, 999)).toEqual([]);
    });
  });
});
