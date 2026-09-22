import { describe, it, expect, beforeEach } from 'vitest';
import { setBuyNowIntent, getBuyNowIntent, updateBuyNowIntent, clearBuyNowIntent } from '../buy-now';
import type { CartItem } from '../cart';

describe('Cart Checkout Overwrites Buy Now Intent Contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const sampleBuyNowItem: CartItem = {
    key: 'prod-1-default',
    productId: '1',
    productSlug: 'tra-dau-tam-pha-le',
    name: 'Trà Dâu Tằm Pha Lê',
    image: '/images/tra-dau.jpg',
    unitPrice: 45000,
    qty: 1,
    size: 'M',
  };

  it('allows cart checkout action to immediately clear buy now intent so cart items take priority', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    // User previously clicked "Mua ngay"
    setBuyNowIntent(101, sampleBuyNowItem);
    expect(getBuyNowIntent(101)).not.toBeNull();

    // User opens cart and clicks "Mua Hàng (Thanh toán)"
    clearBuyNowIntent(101);

    // Buy now intent is purged immediately
    expect(getBuyNowIntent(101)).toBeNull();
  });

  it('preserves normal cart in localStorage when buy now intent is cleared', () => {
    const userCart = [
      {
        key: 'prod-2-default',
        productId: '2',
        name: 'Trà Đào Cam Sả',
        image: '/images/tra-dao.jpg',
        unitPrice: 40000,
        qty: 2,
        selected: true,
      },
    ];
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));
    localStorage.setItem('teaplus_smart_cart_v3:user:101', JSON.stringify(userCart));

    // Staged buy now intent
    setBuyNowIntent(101, sampleBuyNowItem);

    // Clear buy now intent on cart checkout
    clearBuyNowIntent(101);

    // Cart items remain intact
    const storedCartRaw = localStorage.getItem('teaplus_smart_cart_v3:user:101');
    expect(storedCartRaw).not.toBeNull();
    const storedCart = JSON.parse(storedCartRaw!);
    expect(storedCart).toHaveLength(1);
    expect(storedCart[0].name).toBe('Trà Đào Cam Sả');
  });

  it('allows inline quantity adjustment on buy now item', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    setBuyNowIntent(101, sampleBuyNowItem);
    const updated = updateBuyNowIntent(101, { ...sampleBuyNowItem, qty: 3 });

    expect(updated.qty).toBe(3);
    const restored = getBuyNowIntent(101);
    expect(restored?.qty).toBe(3);
  });

  it('allows removing buy now item directly', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    setBuyNowIntent(101, sampleBuyNowItem);
    expect(getBuyNowIntent(101)).not.toBeNull();

    clearBuyNowIntent(101);
    expect(getBuyNowIntent(101)).toBeNull();
  });
});

