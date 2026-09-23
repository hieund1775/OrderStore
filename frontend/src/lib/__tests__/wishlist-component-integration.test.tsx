import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WishlistButton } from '@/components/site/Header';
import { CartProvider, useCart, type CartItem } from '@/lib/cart';
import type { WishlistItem } from '@/lib/wishlist';
import type { PublicProductDetails, ResolvedProductConfiguration } from '@/lib/api';

// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockCustomerSession = vi.hoisted(() => ({
  current: { userId: 10, fullname: 'Nguyễn Văn A' } as { userId: number; fullname: string } | null,
}));

const mockBranch = vi.hoisted(() => ({
  current: {
    selectedStore: { id: 2, name: 'Chi Nhánh Quận 1', district: 'Quận 1' },
    stores: [{ id: 2, name: 'Chi Nhánh Quận 1', district: 'Quận 1' }],
    status: 'ready',
  },
}));

vi.mock('@/lib/customer-session', () => ({
  openCustomerLoginModal: vi.fn(),
  useCustomerSession: () => mockCustomerSession.current,
  getCustomerSession: () => mockCustomerSession.current,
  getCustomerToken: () => 'mock-customer-token',
  clearCustomerToken: vi.fn(),
}));

vi.mock('@/lib/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notifications')>();
  return {
    ...actual,
    useCustomerIdentity: () => ({
      token: 'mock-customer-token',
      user: { id: 10, fullname: 'Nguyễn Văn A', phone: '0901234567' },
    }),
  };
});
vi.mock('@/lib/branch', () => ({
  useBranch: () => mockBranch.current,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPut: vi.fn(),
    fetchPublicProductDetails: vi.fn(),
    resolveProductConfiguration: vi.fn(),
  };
});

import { apiGet, fetchPublicProductDetails, resolveProductConfiguration } from '@/lib/api';

describe('Wishlist Component Integration Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let queryClient: QueryClient;
  let capturedCartItems: CartItem[] = [];

  function CartProbe() {
    const { items } = useCart();
    useEffect(() => {
      capturedCartItems = items;
    }, [items]);
    return <div data-testid="cart-count">{items.length}</div>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    capturedCartItems = [];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    document.body.innerHTML = '';
  });

  it('executes full flow: open wishlist sheet -> click +Gio -> open configurator -> select modifier -> confirm -> verify cart', async () => {
    const sampleWishlistItem: WishlistItem = {
      id: 1,
      user_id: 10,
      product_id: 43,
      product_name: 'Cà Phê Sữa',
      product_slug: 'ca-phe-sua',
      base_tea: 'Cà phê truyền thống',
      price: 35000,
      image_url: '/images/ca-phe-sua.jpg',
      is_available: true,
      has_options: true,
      sku: 'SKU-43-DEF',
      variant_id: 430,
      variant_name: 'Size M',
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
      created_at: new Date().toISOString(),
    };

    // 1. Mock API responses
    vi.mocked(apiGet).mockImplementation(async (url: string) => {
      if (url.includes('/api/users/10/wishlist')) {
        return [sampleWishlistItem];
      }
      return [];
    });

    const productDetails: PublicProductDetails = {
      id: 43,
      name: 'Cà Phê Sữa',
      slug: 'ca-phe-sua',
      description: 'Cà phê pha phin truyền thống',
      price: 35000,
      image_url: '/images/ca-phe-sua.jpg',
      category_id: 1,
      fulfillment_lane: 'kitchen',
      stock_mode: 'made_to_order',
      variants: [
        {
          id: 430,
          sku: 'SKU-43-M',
          variant_signature: 'size_m',
          name_suffix: 'Size M',
          price: 35000,
          compare_at_price: null,
          is_available: true,
          available_stock: 100,
        },
        {
          id: 432,
          sku: 'SKU-43-L',
          variant_signature: 'size_l',
          name_suffix: 'Size L',
          price: 45000,
          compare_at_price: null,
          is_available: true,
          available_stock: 100,
        },
      ],
      attributes: [
        {
          id: 10,
          code: 'size',
          name: 'Kích cỡ',
          role: 'variant',
          input_type: 'single_select',
          is_required: true,
          min_selections: 1,
          max_selections: 1,
          sort_order: 1,
          values: [
            { id: 101, code: 'm', label: 'Size M', price_adjustment: 0, sort_order: 1, is_active: true },
            { id: 102, code: 'l', label: 'Size L', price_adjustment: 10000, sort_order: 2, is_active: true },
          ],
        },
        {
          id: 20,
          code: 'sugar',
          name: 'Mức đường',
          role: 'modifier',
          input_type: 'single_select',
          is_required: true,
          min_selections: 1,
          max_selections: 1,
          sort_order: 2,
          values: [
            { id: 201, code: '100_sugar', label: '100% Đường', price_adjustment: 0, sort_order: 1, is_active: true },
            { id: 202, code: '70_sugar', label: '70% Đường', price_adjustment: 0, sort_order: 2, is_active: true },
          ],
        },
      ],
    };

    vi.mocked(fetchPublicProductDetails).mockResolvedValue(productDetails);

    const resolvedPricing: ResolvedProductConfiguration = {
      product: {
        id: 43,
        name: 'Cà Phê Sữa',
        slug: 'ca-phe-sua',
        fulfillment_lane: 'kitchen',
        stock_mode: 'made_to_order',
      },
      variant: {
        id: 432,
        sku: 'SKU-43-L',
        variant_signature: 'size_l',
        name_suffix: 'Size L',
        base_price: 45000,
        compare_at_price: null,
        is_available: true,
        available_stock: 100,
      },
      applied_modifiers: [
        {
          attribute_definition_id: 10,
          attribute_code: 'size',
          attribute_name: 'Kích cỡ',
          attribute_value_id: 102,
          value_code: 'l',
          value_label: 'Size L',
          attribute_label: 'Size L',
          price_adjustment: 10000,
        },
        {
          attribute_definition_id: 20,
          attribute_code: 'sugar',
          attribute_name: 'Mức đường',
          attribute_value_id: 202,
          value_code: '70_sugar',
          value_label: '70% Đường',
          attribute_label: '70% Đường',
          price_adjustment: 0,
        },
      ],
      pricing: {
        variant_base_price: 45000,
        modifiers_extra_total: 0,
        final_price: 45000,
      },
      base_price: 45000,
      modifier_extra: 0,
      unit_price: 45000,
    };

    vi.mocked(resolveProductConfiguration).mockResolvedValue(resolvedPricing);

    // 2. Mount WishlistButton inside providers
    await act(async () => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <WishlistButton />
            <CartProbe />
          </CartProvider>
        </QueryClientProvider>
      );
    });

    // Allow React Query to resolve initial wishlist fetch
    await act(async () => {
      await Promise.resolve();
    });

    // 3. Find and click Wishlist trigger button (SheetTrigger)
    const triggerBtn = document.body.querySelector('button[aria-label^="Yêu thích"]') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();

    await act(async () => {
      triggerBtn.click();
    });

    // 4. In Wishlist Sheet, find the "+ Giỏ" button for "Cà Phê Sữa"
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const quickAddBtn = buttons.find((b) => b.textContent?.includes('+ Giỏ'));
    expect(quickAddBtn).toBeTruthy();

    // 5. Click "+ Giỏ" -> triggers configurator dialog because has_options is true
    await act(async () => {
      quickAddBtn?.click();
    });

    // Allow DynamicProductConfigurator to load product details and resolve initial config
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 50));
    });

    // 6. Configurator is now open. Verify dialog content is present.
    const allButtons = Array.from(document.body.querySelectorAll('button'));
    const sizeLBtn = allButtons.find((b) => b.textContent?.includes('Size L'));
    expect(sizeLBtn).toBeTruthy();

    // Click modifier button "Size L"
    await act(async () => {
      sizeLBtn?.click();
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 20));
    });

    // 7. Click confirm button "Thêm vào giỏ"
    const confirmButtons = Array.from(document.body.querySelectorAll('button'));
    const addToCartConfirmBtn = confirmButtons.find((b) => b.textContent?.includes('Thêm vào giỏ'));
    expect(addToCartConfirmBtn).toBeTruthy();

    await act(async () => {
      addToCartConfirmBtn?.click();
      await Promise.resolve();
    });

    // 8. Assert item successfully arrived in Cart with preserved IDs and exact properties
    expect(capturedCartItems).toHaveLength(1);
    const itemInCart = capturedCartItems[0];

    expect(itemInCart.productId).toBe('43');
    expect(itemInCart.productSlug).toBe('ca-phe-sua');
    expect(itemInCart.name).toBe('Cà Phê Sữa');
    expect(itemInCart.storeId).toBe('2');
    expect(itemInCart.storeName).toBe('Chi Nhánh Quận 1');
    expect(itemInCart.sku).toBe('SKU-43-L');
    expect(itemInCart.variantId).toBe(432);
    expect(itemInCart.variantName).toBe('Size L');
    expect(itemInCart.unitPrice).toBe(45000);
    expect(itemInCart.stockMode).toBe('made_to_order');
    expect(itemInCart.fulfillmentLane).toBe('kitchen');

    // Modifiers & preserved IDs
    expect(itemInCart.appliedModifiers).toHaveLength(2);
    const sizeMod = itemInCart.appliedModifiers?.find((m) => m.attribute_code === 'size');
    expect(sizeMod?.attribute_definition_id).toBe(10);
    expect(sizeMod?.attribute_value_id).toBe(102);
    expect(sizeMod?.attribute_label).toBe('Size L');
    expect(sizeMod?.value_label).toBe('Size L');

    const sugarMod = itemInCart.appliedModifiers?.find((m) => m.attribute_code === 'sugar');
    expect(sugarMod?.attribute_definition_id).toBe(20);
    expect(sugarMod?.attribute_value_id).toBe(202);
    expect(sugarMod?.attribute_label).toBe('70% Đường');

    // Check that undefined attributes were NOT fabricated
    expect(itemInCart.ice).toBeUndefined();
    expect(itemInCart.toppings).toEqual([]);
  });
});
