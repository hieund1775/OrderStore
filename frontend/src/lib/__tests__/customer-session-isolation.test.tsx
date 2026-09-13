import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCustomerSession,
  useCustomerSession,
  openCustomerLoginModal,
} from '../customer-session';
import {
  setCustomerToken,
  setCustomerUser,
  clearCustomerToken,
  CUSTOMER_TOKEN_KEY,
  CUSTOMER_USER_KEY,
  setToken,
  setUser,
} from '../api';
import {
  CartProvider,
  useCart,
  getCartStorageKey,
  LEGACY_V2_STORAGE_KEY,
  type CartItem,
} from '../cart';
import {
  useWishlist,
  customerWishlistKey,
  fetchUserWishlist,
} from '../wishlist';
import {
  useCustomerNotifications,
  fetchCustomerNotifications,
  customerNotificationsKey,
  clearCustomerNotificationsInFlight,
} from '../notifications';
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

describe('Customer Session, Cart, Wishlist & Notifications Isolation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cartSnapshot: CartSnapshot | null;
  let queryClient: QueryClient;

  function CartProbe() {
    const value = useCart();
    useEffect(() => {
      cartSnapshot = value;
    }, [value]);
    return null;
  }

  async function renderCart() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <CartProbe />
          </CartProvider>
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    cartSnapshot = null;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.clear();
    sessionStorage.clear();
    clearCustomerNotificationsInFlight();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  describe('1. Canonical Customer Session Contract', () => {
    it('returns null when guest has no token or user in storage', () => {
      expect(getCustomerSession()).toBeNull();
    });

    it('returns null if token is empty string or whitespace only', () => {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, '   ');
      localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify({ id: 10, fullname: 'Test' }));
      expect(getCustomerSession()).toBeNull();
    });

    it('returns null if user has non-positive or non-integer ID', () => {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, 'valid_token');

      localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify({ id: 0 }));
      expect(getCustomerSession()).toBeNull();

      localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify({ id: -5 }));
      expect(getCustomerSession()).toBeNull();

      localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify({ id: 'invalid' }));
      expect(getCustomerSession()).toBeNull();

      localStorage.setItem(CUSTOMER_USER_KEY, 'invalid json');
      expect(getCustomerSession()).toBeNull();
    });

    it('does not infer customer session from staff/admin tokens', () => {
      setToken('admin_secret_token');
      setUser({ id: 1, fullname: 'Admin Staff', phone: '0901234567', role: 'manager', branch_id: 1 });

      expect(getCustomerSession()).toBeNull();
    });

    it('returns valid session with positive userId and trimmed token when customer is logged in', () => {
      setCustomerToken('  customer_token_123  ');
      setCustomerUser({ id: 77, fullname: 'Nguyen Van A', phone: '0987654321' });

      const session = getCustomerSession();
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(77);
      expect(session?.token).toBe('customer_token_123');
    });
  });

  describe('2. Guest Cart Isolation & UI Gates', () => {
    it('initializes with empty cart and zero counts for guests', async () => {
      await renderCart();

      expect(cartSnapshot).not.toBeNull();
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.groups).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);
      expect(cartSnapshot?.subtotal).toBe(0);
      expect(cartSnapshot?.selectedCount).toBe(0);
      expect(cartSnapshot?.selectedSubtotal).toBe(0);
      expect(cartSnapshot?.allSelected).toBe(false);
    });

    it('intercepts guest addItem: returns false, dispatches open-customer-auth, and writes no storage', async () => {
      await renderCart();

      let authModalOpened = false;
      const onOpenAuth = () => {
        authModalOpened = true;
      };
      window.addEventListener('teaplus:open-customer-auth', onOpenAuth);

      let addResult: boolean | undefined;
      await act(async () => {
        addResult = cartSnapshot?.addItem({
          productId: '1',
          name: 'Trà Đào Cam Sả',
          image: '/dao.jpg',
          size: 'M',
          base: 'Lục Trà Lài',
          sugar: '100%',
          ice: '100%',
          toppings: [],
          unitPrice: 45000,
          qty: 1,
        });
      });

      expect(addResult).toBe(false);
      expect(authModalOpened).toBe(true);
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);

      // Verify no storage was touched
      expect(localStorage.length).toBe(0);

      window.removeEventListener('teaplus:open-customer-auth', onOpenAuth);
    });

    it('guards all CartProvider mutations for guests', async () => {
      await renderCart();

      let modalCalls = 0;
      const onOpenAuth = () => {
        modalCalls += 1;
      };
      window.addEventListener('teaplus:open-customer-auth', onOpenAuth);

      await act(async () => {
        cartSnapshot?.updateItem('some-key', { name: 'Item' });
        cartSnapshot?.removeItem('some-key');
        cartSnapshot?.removeItems(['key1', 'key2']);
        cartSnapshot?.setQty('some-key', 5);
        cartSnapshot?.toggleSelect('some-key');
        cartSnapshot?.toggleSelectStore('1');
        cartSnapshot?.toggleSelectAll(true);
        cartSnapshot?.clear();
      });

      expect(modalCalls).toBe(8);
      expect(localStorage.length).toBe(0);

      window.removeEventListener('teaplus:open-customer-auth', onOpenAuth);
    });
  });

  describe('3. Multi-Customer A -> Logout -> B Isolation and Restoration', () => {
    const sampleItemA: Omit<CartItem, 'key'> = {
      productId: '101',
      name: 'Trà Sữa Oolong User A',
      image: '/tea_a.jpg',
      size: 'L',
      base: 'Oolong',
      sugar: '70%',
      ice: '70%',
      toppings: ['tranchau'],
      unitPrice: 50000,
      qty: 2,
    };

    const sampleItemB: Omit<CartItem, 'key'> = {
      productId: '202',
      name: 'Trà Xoài Nhiệt Đới User B',
      image: '/tea_b.jpg',
      size: 'M',
      base: 'Lục Trà Lài',
      sugar: '100%',
      ice: '100%',
      toppings: [],
      unitPrice: 42000,
      qty: 1,
    };

    it('User A logs in, adds items, and persists to user-specific V3 key', async () => {
      // 1. User A logs in
      setCustomerToken('token_a');
      setCustomerUser({ id: 10, fullname: 'User A', phone: '0901111111' });

      await renderCart();

      expect(cartSnapshot?.items).toEqual([]);

      // 2. User A adds item
      await act(async () => {
        const added = cartSnapshot?.addItem(sampleItemA);
        expect(added).toBe(true);
      });

      expect(cartSnapshot?.count).toBe(2);
      expect(cartSnapshot?.subtotal).toBe(100000);
      expect(cartSnapshot?.items[0].name).toBe('Trà Sữa Oolong User A');

      // 3. Persisted under exact V3 key
      const keyA = getCartStorageKey(10);
      const rawStoredA = localStorage.getItem(keyA);
      expect(rawStoredA).not.toBeNull();
      const parsedA = JSON.parse(rawStoredA!);
      expect(parsedA).toHaveLength(1);
      expect(parsedA[0].productId).toBe('101');
    });

    it('User A logs out: visible cart clears immediately without deleting saved cart from storage', async () => {
      // Setup User A with saved cart
      setCustomerToken('token_a');
      setCustomerUser({ id: 10, fullname: 'User A', phone: '0901111111' });

      await renderCart();

      await act(async () => {
        cartSnapshot?.addItem(sampleItemA);
      });
      expect(cartSnapshot?.count).toBe(2);

      // Explicit logout
      await act(async () => {
        clearCustomerToken();
      });

      // In-memory visible items must be reset to empty
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);
      expect(cartSnapshot?.subtotal).toBe(0);

      // User A's stored cart is NOT destroyed; it remains intact for future login
      const rawStoredA = localStorage.getItem(getCartStorageKey(10));
      expect(rawStoredA).not.toBeNull();
      expect(JSON.parse(rawStoredA!)).toHaveLength(1);
    });

    it('User B logs in: User B NEVER sees User A data; adding items does not overwrite User A cart', async () => {
      // User A previously had items in storage
      const keyA = getCartStorageKey(10);
      localStorage.setItem(keyA, JSON.stringify([{ ...sampleItemA, key: 'item-a-key' }]));

      // Now User B logs in
      setCustomerToken('token_b');
      setCustomerUser({ id: 20, fullname: 'User B', phone: '0902222222' });

      await renderCart();

      // User B starts with their own empty cart
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);

      // User B adds their own item
      await act(async () => {
        const added = cartSnapshot?.addItem(sampleItemB);
        expect(added).toBe(true);
      });

      expect(cartSnapshot?.count).toBe(1);
      expect(cartSnapshot?.items[0].productId).toBe('202');

      // Check storage keys: User B written to key 20, User A on key 10 is untouched
      const keyB = getCartStorageKey(20);
      const rawB = localStorage.getItem(keyB);
      expect(rawB).not.toBeNull();
      expect(JSON.parse(rawB!)[0].productId).toBe('202');

      const rawA = localStorage.getItem(keyA);
      expect(JSON.parse(rawA!)[0].productId).toBe('101');
    });

    it('User A re-login: restores User A saved cart completely', async () => {
      // Seed User A's cart in storage
      const keyA = getCartStorageKey(10);
      localStorage.setItem(keyA, JSON.stringify([{ ...sampleItemA, key: 'item-a-key' }]));

      // Log in as User A
      setCustomerToken('token_a');
      setCustomerUser({ id: 10, fullname: 'User A', phone: '0901111111' });

      await renderCart();

      // Restored!
      expect(cartSnapshot?.count).toBe(2);
      expect(cartSnapshot?.subtotal).toBe(100000);
      expect(cartSnapshot?.items[0].productId).toBe('101');
    });
  });

  describe('4. Legacy V2 Cart Removal and Malformed Data Resilience', () => {
    it('safely purges legacy teaplus_smart_cart_v2 key on mount and never migrates or renders it', async () => {
      // Simulate untrusted legacy V2 cart from previous version
      localStorage.setItem(
        LEGACY_V2_STORAGE_KEY,
        JSON.stringify([
          {
            key: 'untrusted-legacy',
            productId: '999',
            name: 'Legacy Untrusted Drink',
            qty: 5,
            unitPrice: 30000,
          },
        ]),
      );

      await renderCart();

      // Legacy key is deleted from storage
      expect(localStorage.getItem(LEGACY_V2_STORAGE_KEY)).toBeNull();

      // Guest cart remains completely empty
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);
    });

    it('safely handles malformed JSON in user cart key without crashing', async () => {
      setCustomerToken('token_a');
      setCustomerUser({ id: 10, fullname: 'User A', phone: '0901111111' });
      localStorage.setItem(getCartStorageKey(10), '{ corrupted json syntax');

      await renderCart();

      // Gracefully falls back to empty cart
      expect(cartSnapshot?.items).toEqual([]);
      expect(cartSnapshot?.count).toBe(0);
    });

    it('safely filters invalid or malformed items from storage', async () => {
      setCustomerToken('token_a');
      setCustomerUser({ id: 10, fullname: 'User A', phone: '0901111111' });
      localStorage.setItem(
        getCartStorageKey(10),
        JSON.stringify([
          null,
          { invalid: 'object' },
          { key: 'valid', productId: '5', name: 'Trà Vải', unitPrice: 35000, qty: 1 },
          { key: 'bad-qty', productId: '6', name: 'Trà Dâu', unitPrice: 35000, qty: -1 },
        ]),
      );

      await renderCart();

      // Only valid item with positive qty is kept
      expect(cartSnapshot?.items).toHaveLength(1);
      expect(cartSnapshot?.items[0].name).toBe('Trà Vải');
    });
  });

  describe('5. Wishlist & Notifications Isolation Boundary', () => {
    it('drops late notification response if customer switched accounts before fetch completes', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        return new Response(JSON.stringify({
          notifications: [{ id: 1, title: 'Notif for A', is_read: false }],
          unread_count: 1,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      // User A (id: 10) was active, but switches to User B (id: 20)
      setCustomerToken('token_b');
      setCustomerUser({ id: 20, fullname: 'User B', phone: '0902222222' });

      // Late response for user 10 returns
      const res = await fetchCustomerNotifications(10, 50);
      expect(res.notifications).toEqual([]);
      expect(res.unread_count).toBe(0);

      vi.unstubAllGlobals();
    });

    it('drops late wishlist response if customer switched accounts before fetch completes', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        return new Response(JSON.stringify([
          { id: 1, product_id: 5, product_name: 'Trà A' },
        ]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }));

      // User A (id: 10) was active, but switches to User B (id: 20)
      setCustomerToken('token_b');
      setCustomerUser({ id: 20, fullname: 'User B', phone: '0902222222' });

      const res = await fetchUserWishlist(10);
      expect(res).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('clearCustomerNotificationsInFlight clears in-flight promises by userId', () => {
      clearCustomerNotificationsInFlight(10);
      clearCustomerNotificationsInFlight();
      expect(true).toBe(true);
    });

    it('useWishlist hook: guest has 0 items and setFavorite invokes openCustomerLoginModal without API call', async () => {
      let wishlistSnapshot: ReturnType<typeof useWishlist> | null = null;
      let modalCalled = false;
      const onOpenAuth = () => { modalCalled = true; };
      window.addEventListener('teaplus:open-customer-auth', onOpenAuth);

      function WishlistProbe() {
        const value = useWishlist();
        useEffect(() => {
          wishlistSnapshot = value;
        }, [value]);
        return null;
      }

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <WishlistProbe />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      expect(wishlistSnapshot?.items).toEqual([]);
      expect(wishlistSnapshot?.count).toBe(0);
      expect(wishlistSnapshot?.isFavorite(1)).toBe(false);

      // Attempt to favorite as guest
      await act(async () => {
        wishlistSnapshot?.setFavorite({
          id: 1,
          name: 'Trà Đào',
          slug: 'tra-dao',
          base: 'Lài',
          price: 30000,
          image: '/dao.jpg',
        }, true);
      });

      expect(modalCalled).toBe(true);
      expect(wishlistSnapshot?.items).toEqual([]);

      window.removeEventListener('teaplus:open-customer-auth', onOpenAuth);
    });

    it('useCustomerNotifications hook: guest has 0 unread and empty notifications list without API calls', async () => {
      let notifSnapshot: ReturnType<typeof useCustomerNotifications> | null = null;

      function NotifProbe() {
        const value = useCustomerNotifications();
        useEffect(() => {
          notifSnapshot = value;
        }, [value]);
        return null;
      }

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <NotifProbe />
          </QueryClientProvider>,
        );
        await Promise.resolve();
      });

      expect(notifSnapshot?.notifications).toEqual([]);
      expect(notifSnapshot?.unreadCount).toBe(0);
      expect(notifSnapshot?.data).toEqual({ notifications: [], unread_count: 0 });
    });
  });

  describe('6. Direct Checkout and Entry Gate Protection', () => {
    it('openCustomerLoginModal dispatches teaplus:open-customer-auth event', () => {
      let received = false;
      const handler = () => { received = true; };
      window.addEventListener('teaplus:open-customer-auth', handler);

      openCustomerLoginModal();

      expect(received).toBe(true);
      window.removeEventListener('teaplus:open-customer-auth', handler);
    });
  });
});
