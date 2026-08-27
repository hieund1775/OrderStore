import { describe, it, expect } from 'vitest';
import { mapApiProduct, sizeOptions, toppingOptions, sugarOptions, iceOptions, baseOptions } from '../data';

describe('Legacy Public Menu Contract Suite', () => {
  it('maps legacy PostgreSQL catalog product DTO to storefront product model accurately', () => {
    const apiProduct = {
      id: 101,
      name: 'Trà Đào Cam Sả',
      slug: 'tra-dao-cam-sa',
      base_tea: 'Trà đen',
      description: 'Hương vị đào tươi hòa quyện cam sả thơm mát',
      price: 35000,
      image_url: '/images/tra-dao.webp',
      rating: 4.8,
      review_count: 120,
      calories: 180,
      category_name: 'Trà Trái Cây Tô',
      is_bestseller: true,
      is_seasonal: false,
    };

    const mapped = mapApiProduct(apiProduct);

    expect(mapped.id).toBe('101');
    expect(mapped.name).toBe('Trà Đào Cam Sả');
    expect(mapped.slug).toBe('tra-dao-cam-sa');
    expect(mapped.base).toBe('Trà đen');
    expect(mapped.desc).toBe('Hương vị đào tươi hòa quyện cam sả thơm mát');
    expect(mapped.price).toBe(35000);
    expect(mapped.image).toBe('/images/tra-dao.webp');
    expect(mapped.rating).toBe(4.8);
    expect(mapped.reviews).toBe(120);
    expect(mapped.calories).toBe(180);
    expect(mapped.line).toBe('Trà Trái Cây Tô');
    expect(mapped.tags).toContain('best-seller');
    expect(mapped.tags).not.toContain('seasonal');
  });

  it('provides baseline fallback values when API fields are omitted or null', () => {
    const minimal = mapApiProduct({ id: 999 });

    expect(minimal.id).toBe('999');
    expect(minimal.name).toBe('Sản phẩm TeaPlus');
    expect(minimal.price).toBe(0);
    expect(minimal.image).toBe('');
    expect(minimal.line).toBe('Trà Trái Cây Tươi');
    expect(minimal.rating).toBe(0);
    expect(minimal.reviews).toBe(0);
    expect(minimal.calories).toBe(0);
    expect(minimal.tags).toEqual([]);
  });

  it('guarantees standard legacy modifier options are intact', () => {
    expect(sizeOptions.length).toBe(2);
    expect(sizeOptions.map((s) => s.id)).toEqual(['M', 'L']);

    expect(sugarOptions).toContain('0% (Không đường)');
    expect(sugarOptions).toContain('100% (Mặc định)');

    expect(iceOptions).toContain('Không đá');
    expect(iceOptions).toContain('100% (Mặc định)');

    expect(baseOptions).toContain('Lục Trà Lài');
    expect(baseOptions).toContain('Trà Đen');
    expect(baseOptions).toContain('Trà Ô Long');

    expect(toppingOptions.length).toBeGreaterThanOrEqual(5);
    const toppingIds = toppingOptions.map((t) => t.id);
    expect(toppingIds).toContain('tran-chau-trang');
    expect(toppingIds).toContain('nha-dam');
    expect(toppingIds).toContain('trai-cay-dam');
  });
});
