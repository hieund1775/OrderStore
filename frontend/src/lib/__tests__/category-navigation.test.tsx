import { describe, it, expect } from 'vitest';

describe('Category Navigation Suite', () => {
  it('filters root categories with depth 0 and no parent_id', () => {
    const categories = [
      { id: 1, name: 'Thực đơn', slug: 'thuc-don', depth: 0, parent_id: null, is_visible: true, children: [{ id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay' }] },
      { id: 10, name: 'Quần áo', slug: 'quan-ao', depth: 0, parent_id: null, is_visible: true, children: [{ id: 11, name: 'Áo thun', slug: 'ao-thun' }] },
      { id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay', depth: 1, parent_id: 1, is_visible: true },
    ];

    const roots = categories.filter((c) => Number(c.depth || 0) === 0 && !c.parent_id);
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

    const rootId = 1;
    const ids = new Set<number>([rootId]);
    let added = true;
    while (added) {
      added = false;
      for (const cat of categories) {
        if (cat.parent_id && ids.has(Number(cat.parent_id)) && !ids.has(Number(cat.id))) {
          ids.add(Number(cat.id));
          added = true;
        }
      }
    }

    expect(Array.from(ids)).toEqual([1, 2, 3]);
  });
});
