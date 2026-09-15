import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBuyNowIntent,
  getBuyNowIntent,
  updateBuyNowIntent,
  clearBuyNowIntent,
  hasValidBuyNowIntent,
} from '../buy-now';
import type { CartItem } from '../cart';

describe('Buy Now Tab-Scoped Isolation & Refresh Survival Contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const sampleItem: CartItem = {
    key: 'prod-1-default',
    productId: '1',
    productSlug: 'tra-dau-tam-pha-le',
    name: 'Trà Dâu Tằm Pha Lê',
    image: '/images/tra-dau.jpg',
    unitPrice: 45000,
    qty: 2,
    size: 'L',
    appliedModifiers: [
      {
        attribute_code: 'size',
        attribute_name: 'Size',
        value_code: 'size_l',
        value_label: 'Size L',
        price_adjustment: 10000,
      },
    ],
  };

  it('persists single-item intent in sessionStorage under user-bound key', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    const saved = setBuyNowIntent(101, sampleItem);
    expect(saved.key).toBeDefined();
    expect(saved.selected).toBe(true);

    const storedRaw = sessionStorage.getItem('teaplus_buy_now_intent_v1:user:101');
    expect(storedRaw).toBeTruthy();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.userId).toBe(101);
    expect(parsed.item.name).toBe('Trà Dâu Tằm Pha Lê');

    // Never touches normal cart storage
    expect(localStorage.getItem('teaplus_smart_cart_v3:user:101')).toBeNull();
  });

  it('survives page refresh in same tab and retrieves active intent', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    setBuyNowIntent(101, sampleItem);

    // Simulating page refresh: memory state wiped, sessionStorage intact
    const restored = getBuyNowIntent(101);
    expect(restored).not.toBeNull();
    expect(restored?.productId).toBe('1');
    expect(restored?.qty).toBe(2);
    expect(hasValidBuyNowIntent(101)).toBe(true);
  });

  it('rejects access if active user does not match the intent user ID', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));
    setBuyNowIntent(101, sampleItem);

    // User switches to user 102
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 102, fullname: 'Trần Thị B' }));
    const resultForUser102 = getBuyNowIntent(102);
    expect(resultForUser102).toBeNull();
  });

  it('updates intent dynamically without affecting cart', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    setBuyNowIntent(101, sampleItem);
    const updated = updateBuyNowIntent(101, {
      ...sampleItem,
      qty: 3,
      unitPrice: 55000,
    });

    expect(updated.qty).toBe(3);
    const restored = getBuyNowIntent(101);
    expect(restored?.qty).toBe(3);
    expect(restored?.unitPrice).toBe(55000);
  });

  it('clears intent only on explicit cancel or successful completion', () => {
    localStorage.setItem('teaplus_customer_token', 'cust-token-123');
    localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 101, fullname: 'Nguyễn Văn A' }));

    setBuyNowIntent(101, sampleItem);
    expect(hasValidBuyNowIntent(101)).toBe(true);

    clearBuyNowIntent(101);
    expect(getBuyNowIntent(101)).toBeNull();
    expect(hasValidBuyNowIntent(101)).toBe(false);
  });
});
