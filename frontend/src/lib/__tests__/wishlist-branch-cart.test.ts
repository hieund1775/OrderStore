import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  customerWishlistKey,
  buildWishlistQuickCartItem,
  fetchUserWishlist,
  type WishlistItem,
} from '../wishlist';
import { mapConfiguredItemToCartItem } from '../cart';
import { handleLocalMock } from '../mock-engine';

describe('Wishlist Branch & Cart Integration Contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const baseItem: WishlistItem = {
    id: 1,
    user_id: 10,
    product_id: 43,
    product_name: 'Cà Phê Sữa',
    product_slug: 'ca-phe-sua',
    image_url: '/images/ca-phe-sua.jpg',
    base_tea: 'Cà phê truyền thống',
    price: 35000,
    created_at: new Date().toISOString(),
    is_available: true,
    has_options: true,
    sku: 'SKU-43-DEF',
    variant_id: 43,
    variant_name: 'Size M',
    fulfillment_lane: 'kitchen',
    stock_mode: 'made_to_order',
  };

  it('partitions query cache by userId and storeId', () => {
    const keyStore1 = customerWishlistKey(10, 1);
    const keyStore2 = customerWishlistKey(10, 2);
    const keyNoStore = customerWishlistKey(10);

    expect(keyStore1).toEqual(['customer-wishlist', 10, '1']);
    expect(keyStore2).toEqual(['customer-wishlist', 10, '2']);
    expect(keyNoStore).toEqual(['customer-wishlist', 10]);

    // Ensure store 1 and store 2 have completely isolated cache keys
    expect(keyStore1).not.toEqual(keyStore2);
  });

  it('preserves branch price divergence without cross-branch leakage', () => {
    const itemStore1: WishlistItem = {
      ...baseItem,
      price: 35000,
    };
    const itemStore2: WishlistItem = {
      ...baseItem,
      price: 38000,
    };

    const cartItem1 = buildWishlistQuickCartItem(itemStore1, { id: 1, name: 'Chi Nhánh Quận 1' });
    const cartItem2 = buildWishlistQuickCartItem(itemStore2, { id: 2, name: 'Chi Nhánh Quận 3' });

    expect(cartItem1).not.toBeNull();
    expect(cartItem2).not.toBeNull();

    expect(cartItem1?.storeId).toBe('1');
    expect(cartItem1?.unitPrice).toBe(35000);

    expect(cartItem2?.storeId).toBe('2');
    expect(cartItem2?.unitPrice).toBe(38000);
  });

  it('rejects adding to cart if product is unavailable at branch or has no offer', () => {
    const unavailableItem: WishlistItem = {
      ...baseItem,
      is_available: false,
      price: null,
      sku: null,
      variant_id: null,
    };

    const cartItem = buildWishlistQuickCartItem(unavailableItem, { id: 2, name: 'Chi Nhánh Quận 3' });
    expect(cartItem).toBeNull();
  });

  it('rejects adding to cart if price is 0 or negative', () => {
    const zeroPriceItem: WishlistItem = {
      ...baseItem,
      price: 0,
    };

    const cartItem = buildWishlistQuickCartItem(zeroPriceItem, { id: 1, name: 'Chi Nhánh 1' });
    expect(cartItem).toBeNull();
  });

  it('strictly returns null when missing storeId, sku, variantId, fulfillmentLane, or stockMode', () => {
    // Missing storeInfo -> returns null (cannot create cart item)
    expect(buildWishlistQuickCartItem(baseItem, null)).toBeNull();
    expect(buildWishlistQuickCartItem(baseItem, undefined)).toBeNull();

    // Missing sku -> returns null
    const noSku = { ...baseItem, sku: null };
    expect(buildWishlistQuickCartItem(noSku, { id: 5 })).toBeNull();

    // Missing variantId -> returns null
    const noVariant = { ...baseItem, variant_id: null };
    expect(buildWishlistQuickCartItem(noVariant, { id: 5 })).toBeNull();

    // Missing fulfillmentLane -> returns null
    const noLane = { ...baseItem, fulfillment_lane: undefined };
    expect(buildWishlistQuickCartItem(noLane, { id: 5 })).toBeNull();

    // Missing stockMode -> returns null
    const noStockMode = { ...baseItem, stock_mode: undefined };
    expect(buildWishlistQuickCartItem(noStockMode, { id: 5 })).toBeNull();
  });

  it('supports multi-variant Catalog V2 products without default variant signature', () => {
    const multiVariantItem: WishlistItem = {
      ...baseItem,
      sku: null,
      variant_id: null,
      variant_name: null,
      has_options: true,
    };

    // When backend resolves to specific variant (e.g. Size L instead of default)
    const resolvedSizeL = {
      sku: 'SKU-43-L',
      variantId: 432,
      variantName: 'Size L',
      price: 42000,
      fulfillmentLane: 'kitchen' as const,
      stockMode: 'made_to_order' as const,
    };

    const cartItem = buildWishlistQuickCartItem(
      multiVariantItem,
      { id: 2, name: 'Chi nhánh Quận 3', district: 'Quận 3' },
      resolvedSizeL,
    );

    expect(cartItem).not.toBeNull();
    expect(cartItem?.sku).toBe('SKU-43-L');
    expect(cartItem?.variantId).toBe(432);
    expect(cartItem?.size).toBe('L');
    expect(cartItem?.unitPrice).toBe(42000);
    expect(cartItem?.storeId).toBe('2');
  });

  it('disables quick-add when the branch offer is unavailable', () => {
    const disabledOfferItem: WishlistItem = {
      ...baseItem,
      is_available: false,
    };

    const cartItem = buildWishlistQuickCartItem(
      disabledOfferItem,
      { id: 1, name: 'Chi nhánh 1' },
      { sku: 'SKU-43-DEF', variantId: 43, price: 35000, fulfillmentLane: 'kitchen', stockMode: 'made_to_order' },
    );

    expect(cartItem).toBeNull();
  });

  it('rejects invalid store_id with 400 when fetching wishlist', async () => {
    window.localStorage.setItem('teaplus_customer_token', 'token-10');
    window.localStorage.setItem('teaplus_customer_user', JSON.stringify({ id: 10 }));

    // Test through handleLocalMock
    await expect(handleLocalMock('/api/users/10/wishlist?store_id=abc')).rejects.toThrow('Mã chi nhánh không hợp lệ');
    await expect(handleLocalMock('/api/users/10/wishlist?store_id=-1')).rejects.toThrow('Mã chi nhánh không hợp lệ');
    await expect(handleLocalMock('/api/users/10/wishlist?store_id=0')).rejects.toThrow('Mã chi nhánh không hợp lệ');

    // Test through fetchUserWishlist with server returning 400 for invalid store_id
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const parsed = new URL(String(url));
      const storeId = parsed.searchParams.get('store_id');
      const num = Number(storeId);
      if (!Number.isInteger(num) || num <= 0) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'Mã chi nhánh không hợp lệ' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUserWishlist(10, 'abc')).rejects.toThrow('Mã chi nhánh không hợp lệ');
    await expect(fetchUserWishlist(10, -1)).rejects.toThrow('Mã chi nhánh không hợp lệ');
    await expect(fetchUserWishlist(10, 0)).rejects.toThrow('Mã chi nhánh không hợp lệ');

    vi.unstubAllGlobals();
  });

  it('blocks cart item lacking storeId from being edited or shifted to current branch', () => {
    const legacyCartItemWithoutStore = {
      productId: '43',
      productName: 'Cà Phê Sữa',
      productSlug: 'ca-phe-sua',
      sku: 'SKU-43-DEF',
      variantId: 43,
      quantity: 1,
      unitPrice: 35000,
      appliedModifiers: [],
    };

    // When storeInfo is undefined or null (such as old cart items lacking storeId)
    const mapped = mapConfiguredItemToCartItem(
      legacyCartItemWithoutStore,
      null, // No valid storeInfo
      { base: 'Cà phê truyền thống', size: 'M' },
    );

    // storeId must NOT be secretly populated with any fallback branch
    expect(mapped.storeId).toBeUndefined();
    expect(mapped.storeName).toBeUndefined();
    expect(mapped.storeDistrict).toBeUndefined();
  });

  it('configures wishlist item with options and preserves quantity, appliedModifiers, SKU, variant, and store', () => {
    const wishlistBeverage: WishlistItem = {
      ...baseItem,
      has_options: true,
      sku: 'SKU-43-BASE',
      variant_id: 430,
    };

    const selectedStore = { id: '3', name: 'Chi Nhánh Ba Đình', district: 'Ba Đình' };

    // Payload emitted by DynamicProductConfigurator when user configures size, sugar, ice, toppings
    const configuredPayload = {
      productId: wishlistBeverage.product_id,
      productName: wishlistBeverage.product_name,
      productSlug: wishlistBeverage.product_slug,
      variantId: 432,
      sku: 'SKU-43-L',
      variantName: 'Size L',
      quantity: 3,
      unitPrice: 48000,
      appliedModifiers: [
        {
          attribute_code: 'size',
          attribute_name: 'Kích cỡ',
          value_code: 'l',
          value_label: 'Size L',
          price_adjustment: 6000,
        },
        {
          attribute_code: 'sugar',
          attribute_name: 'Mức đường',
          value_code: '70_sugar',
          value_label: '70% Đường',
          price_adjustment: 0,
        },
        {
          attribute_code: 'ice',
          attribute_name: 'Mức đá',
          value_code: '50_ice',
          value_label: '50% Đá',
          price_adjustment: 0,
        },
        {
          attribute_code: 'toppings',
          attribute_name: 'Topping',
          value_code: 'tran_chau_den',
          value_label: 'Trân Châu Đen',
          price_adjustment: 7000,
        },
      ],
      stockMode: 'made_to_order' as const,
      fulfillmentLane: 'kitchen' as const,
      image: wishlistBeverage.image_url || undefined,
    };

    // Derived using standard helper
    const cartItem = mapConfiguredItemToCartItem(
      configuredPayload,
      selectedStore,
      {
        image: wishlistBeverage.image_url || undefined,
        base: wishlistBeverage.base_tea,
      },
    );

    // Verify preservation
    expect(cartItem.storeId).toBe('3');
    expect(cartItem.storeName).toBe('Chi Nhánh Ba Đình');
    expect(cartItem.storeDistrict).toBe('Ba Đình');
    expect(cartItem.productId).toBe('43');
    expect(cartItem.productSlug).toBe('ca-phe-sua');
    expect(cartItem.name).toBe('Cà Phê Sữa');
    expect(cartItem.sku).toBe('SKU-43-L');
    expect(cartItem.variantId).toBe(432);
    expect(cartItem.variantName).toBe('Size L');
    expect(cartItem.qty).toBe(3);
    expect(cartItem.unitPrice).toBe(48000);
    expect(cartItem.stockMode).toBe('made_to_order');
    expect(cartItem.fulfillmentLane).toBe('kitchen');

    // Verify derived modifier values
    expect(cartItem.size).toBe('L');
    expect(cartItem.sugar).toBe('70% Đường');
    expect(cartItem.ice).toBe('50% Đá');
    expect(cartItem.toppings).toEqual(['Trân Châu Đen']);
    expect(cartItem.appliedModifiers).toHaveLength(4);
    expect(cartItem.appliedModifiers?.[0].attribute_code).toBe('size');
    expect(cartItem.appliedModifiers?.[0].value_label).toBe('Size L');
  });
});
