import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { CartProvider, buildCartItemKey } from '@/lib/cart';
import { SmartCartDrawer } from '../SmartCartDrawer';

describe('Smart Cart V2 & Multi-Branch Drawer Suite', () => {
  it('generates consistent fingerprint keys for cart items', () => {
    const key1 = buildCartItemKey({
      storeId: 1,
      productId: '10',
      sku: 'AO-THUN-L',
      size: 'L',
      sugar: '100%',
      ice: '100%',
      toppings: ['tran-chau'],
    });

    const key2 = buildCartItemKey({
      storeId: 1,
      productId: '10',
      sku: 'AO-THUN-L',
      size: 'L',
      sugar: '100%',
      ice: '100%',
      toppings: ['tran-chau'],
    });

    expect(key1).toBe(key2);
    expect(key1).toContain('1__10__AO-THUN-L');
  });

  it('renders SmartCartDrawer empty state correctly', () => {
    const html = renderToString(
      <CartProvider>
        <SmartCartDrawer />
      </CartProvider>,
    );

    // Sheet trigger button renders
    expect(html).toContain('button');
  });
});
