import { describe, expect, it } from 'vitest';
import {
  collectCategorySubtreeIds,
  getLeafCategories,
  getRootCategories,
} from '@/lib/catalog-navigation';

describe('Admin catalog root selector contracts', () => {
  const categories = [
    { id: 1, name: 'Thực đơn', parent_id: null, depth: 0 },
    { id: 2, name: 'Trà', parent_id: 1, depth: 1 },
    { id: 3, name: 'Trà đào', parent_id: 2, depth: 2 },
    { id: 10, name: 'Quần áo', parent_id: null, depth: 0 },
    { id: 11, name: 'Áo thun', parent_id: 10, depth: 1 },
  ];

  it('keeps All separate and derives dynamic roots', () => {
    expect(getRootCategories(categories).map((category) => category.id)).toEqual([1, 10]);
  });

  it('scopes both category tree and product category leaves to the selected root', () => {
    const ids = collectCategorySubtreeIds(categories, 1);
    const scoped = categories.filter((category) => ids.has(category.id));

    expect(scoped.map((category) => category.id)).toEqual([1, 2, 3]);
    expect(getLeafCategories(scoped).map((category) => category.id)).toEqual([3]);
  });
});
