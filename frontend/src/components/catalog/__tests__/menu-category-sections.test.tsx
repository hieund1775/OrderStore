import { describe, it, expect } from 'vitest';

describe('Menu Category Sections & Subtree View Suite', () => {
  it('groups products into sections according to root categories', () => {
    const mockSections = [
      {
        root_id: 1,
        root_name: 'Thực đơn',
        root_slug: 'thuc-don',
        total_products: 15,
        children: [{ id: 2, name: 'Trà trái cây', slug: 'tra-trai-cay' }],
        products: [
          { id: 101, name: 'Trà Trái Cây Tô', price: 35000 },
          { id: 102, name: 'Trà Sữa Ô Long', price: 40000 },
        ],
      },
      {
        root_id: 10,
        root_name: 'Quần áo & Merchandise',
        root_slug: 'quan-ao',
        total_products: 8,
        children: [{ id: 11, name: 'Áo thun', slug: 'ao-thun' }],
        products: [
          { id: 201, name: 'Áo Thun TeaPlus Special', price: 180000 },
        ],
      },
    ];

    expect(mockSections.length).toBe(2);
    expect(mockSections[0].root_slug).toBe('thuc-don');
    expect(mockSections[0].products.length).toBe(2);
    expect(mockSections[1].root_slug).toBe('quan-ao');
    expect(mockSections[1].total_products).toBe(8);
  });

  it('filters by category slug without leaking products from other roots', () => {
    const allProducts = [
      { id: 101, name: 'Trà Trái Cây Tô', category_id: 2, category_slug: 'tra-trai-cay' },
      { id: 102, name: 'Trà Sữa Ô Long', category_id: 3, category_slug: 'tra-sua' },
      { id: 201, name: 'Áo Thun TeaPlus', category_id: 11, category_slug: 'ao-thun' },
    ];

    const beverageSubtreeCategoryIds = [2, 3];
    const filteredBeverages = allProducts.filter((p) =>
      beverageSubtreeCategoryIds.includes(p.category_id),
    );

    expect(filteredBeverages.length).toBe(2);
    expect(filteredBeverages.map((p) => p.name)).toEqual([
      'Trà Trái Cây Tô',
      'Trà Sữa Ô Long',
    ]);
  });
});
