import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setCustomerToken,
  setCustomerUser,
  clearCustomerToken,
} from '../api';
import {
  CartProvider,
  PreorderCartProvider,
  useCart,
  usePreorderCart,
  getCartStorageKey,
  getPreorderCartStorageKey,
  V3_STORAGE_KEY_PREFIX,
  V3_PREORDER_STORAGE_KEY_PREFIX,
  type CartItem,
} from '../cart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

type CartSnapshot = ReturnType<typeof useCart>;
type PreorderCartSnapshot = ReturnType<typeof usePreorderCart>;

describe('Preorder Cart & Normal Cart Strict Isolation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let normalCartSnapshot: CartSnapshot | null;
  let preorderCartSnapshot: PreorderCartSnapshot | null;
  let queryClient: QueryClient;

  function ProbeComponent() {
    const normal = useCart();
    const preorder = usePreorderCart();
    useEffect(() => {
      normalCartSnapshot = normal;
      preorderCartSnapshot = preorder;
    }, [normal, preorder]);
    return null;
  }

  async function renderBothCarts() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <PreorderCartProvider>
              <ProbeComponent />
            </PreorderCartProvider>
          </CartProvider>
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });
  }

  const normalItem: Omit<CartItem, 'key'> = {
    productId: '101',
    name: 'Trà Sữa Oolong Normal',
    image: '/oolong.jpg',
    size: 'M',
    unitPrice: 35000,
    qty: 2,
    storeId: '1',
    storeName: 'Chi Nhánh Trung Tâm',
  };

  const preorderItem: Omit<CartItem, 'key'> = {
    productId: '202',
    name: 'Bánh Mì Chảo Preorder',
    image: '/banhmi.jpg',
    size: 'L',
    unitPrice: 55000,
    qty: 1,
    storeId: '1',
    storeName: 'Chi Nhánh Trung Tâm',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    normalCartSnapshot = null;
    preorderCartSnapshot = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('verifies storage key prefixes are distinct and adhere to spec', () => {
    expect(V3_STORAGE_KEY_PREFIX).toBe('teaplus_smart_cart_v3:user:');
    expect(V3_PREORDER_STORAGE_KEY_PREFIX).toBe('teaplus_preorder_cart_v3:user:');
    expect(getCartStorageKey(10)).toBe('teaplus_smart_cart_v3:user:10');
    expect(getPreorderCartStorageKey(10)).toBe('teaplus_preorder_cart_v3:user:10');
  });

  it('normal cart and preorder cart are strictly independent in state and storage', async () => {
    setCustomerToken('test_token_10');
    setCustomerUser({ id: 10, fullname: 'Nguyen Van A', phone: '0901234567' });

    await renderBothCarts();

    // Initially both empty
    expect(normalCartSnapshot?.items).toEqual([]);
    expect(preorderCartSnapshot?.items).toEqual([]);

    // 1. Add item to normal cart
    await act(async () => {
      const added = normalCartSnapshot?.addItem(normalItem);
      expect(added).toBe(true);
    });

    // Normal cart has 1 item (qty 2), preorder cart remains empty
    expect(normalCartSnapshot?.count).toBe(2);
    expect(normalCartSnapshot?.subtotal).toBe(70000);
    expect(preorderCartSnapshot?.count).toBe(0);
    expect(preorderCartSnapshot?.items).toEqual([]);

    // Normal storage key has item, preorder storage key is null/empty
    const normalRaw = localStorage.getItem(getCartStorageKey(10));
    const preorderRaw = localStorage.getItem(getPreorderCartStorageKey(10));
    expect(normalRaw).not.toBeNull();
    expect(JSON.parse(normalRaw!)).toHaveLength(1);
    expect(preorderRaw === null || JSON.parse(preorderRaw).length === 0).toBe(true);

    // 2. Add item to preorder cart
    await act(async () => {
      const added = preorderCartSnapshot?.addItem(preorderItem);
      expect(added).toBe(true);
    });

    // Both carts have their own respective items
    expect(normalCartSnapshot?.count).toBe(2);
    expect(normalCartSnapshot?.items[0].productId).toBe('101');
    expect(preorderCartSnapshot?.count).toBe(1);
    expect(preorderCartSnapshot?.items[0].productId).toBe('202');

    // Both storage keys are populated separately
    const normalRaw2 = localStorage.getItem(getCartStorageKey(10));
    const preorderRaw2 = localStorage.getItem(getPreorderCartStorageKey(10));
    expect(JSON.parse(normalRaw2!)[0].productId).toBe('101');
    expect(JSON.parse(preorderRaw2!)[0].productId).toBe('202');
  });

  it('logout clears in-memory items from both normal cart and preorder cart', async () => {
    setCustomerToken('test_token_10');
    setCustomerUser({ id: 10, fullname: 'Nguyen Van A', phone: '0901234567' });

    await renderBothCarts();

    await act(async () => {
      normalCartSnapshot?.addItem(normalItem);
      preorderCartSnapshot?.addItem(preorderItem);
    });

    expect(normalCartSnapshot?.count).toBe(2);
    expect(preorderCartSnapshot?.count).toBe(1);

    // Logout
    await act(async () => {
      clearCustomerToken();
    });

    // Both in-memory carts must be cleared immediately
    expect(normalCartSnapshot?.items).toEqual([]);
    expect(normalCartSnapshot?.count).toBe(0);
    expect(normalCartSnapshot?.subtotal).toBe(0);

    expect(preorderCartSnapshot?.items).toEqual([]);
    expect(preorderCartSnapshot?.count).toBe(0);
    expect(preorderCartSnapshot?.subtotal).toBe(0);

    // User 10's saved carts in localStorage remain intact for future login
    expect(localStorage.getItem(getCartStorageKey(10))).not.toBeNull();
    expect(localStorage.getItem(getPreorderCartStorageKey(10))).not.toBeNull();
  });

  it('logging back in restores both normal cart and preorder cart for User A', async () => {
    // Seed storage for User 10
    localStorage.setItem(getCartStorageKey(10), JSON.stringify([{ ...normalItem, key: 'norm-key' }]));
    localStorage.setItem(getPreorderCartStorageKey(10), JSON.stringify([{ ...preorderItem, key: 'pre-key' }]));

    setCustomerToken('test_token_10');
    setCustomerUser({ id: 10, fullname: 'Nguyen Van A', phone: '0901234567' });

    await renderBothCarts();

    expect(normalCartSnapshot?.count).toBe(2);
    expect(normalCartSnapshot?.items[0].productId).toBe('101');

    expect(preorderCartSnapshot?.count).toBe(1);
    expect(preorderCartSnapshot?.items[0].productId).toBe('202');
  });

  it('guest cannot add items to preorder cart without login', async () => {
    await renderBothCarts();

    let authModalTriggered = false;
    const onAuth = () => { authModalTriggered = true; };
    window.addEventListener('teaplus:open-customer-auth', onAuth);

    let result: boolean | undefined;
    await act(async () => {
      result = preorderCartSnapshot?.addItem(preorderItem);
    });

    expect(result).toBe(false);
    expect(authModalTriggered).toBe(true);
    expect(preorderCartSnapshot?.items).toEqual([]);
    expect(localStorage.length).toBe(0);

    window.removeEventListener('teaplus:open-customer-auth', onAuth);
  });
});
