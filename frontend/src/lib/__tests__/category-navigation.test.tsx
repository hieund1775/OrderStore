import { describe, it, expect } from 'vitest';
import {
  buildCategoryBreadcrumb,
  collectCategorySubtreeIds,
  getLeafCategories,
  getRootCategories,
  publicCategoryTreeQueryKey,
} from '../catalog-navigation';

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
});
