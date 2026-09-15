import { describe, expect, it } from 'vitest';
import { mapApiProduct } from '@/lib/data';

describe('product rating display defaults', () => {
  it('shows 5.0 and zero reviews when the product has no visible verified reviews', () => {
    const product = mapApiProduct({
      id: 1,
      name: 'Trà mới',
      rating: 0,
      review_count: 0,
    });

    expect(product.rating).toBe(5);
    expect(product.reviews).toBe(0);
  });

  it('uses the persisted aggregate instead of fabricating a rating or count', () => {
    const product = mapApiProduct({
      id: 2,
      name: 'Trà đã có đánh giá',
      rating: 4.3,
      review_count: 7,
    });

    expect(product.rating).toBe(4.3);
    expect(product.reviews).toBe(7);
  });
});
