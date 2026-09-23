import { describe, it, expect } from 'vitest';
import {
  resolveProductImage,
  getProductPlaceholder,
  PLACEHOLDER_FOOD_IMAGE,
  PLACEHOLDER_GOODS_IMAGE,
} from '@/lib/data';
import { buildWishlistQuickCartItem, type WishlistItem } from '@/lib/wishlist';

describe('Product Category Image Placeholder Suite', () => {
  describe('getProductPlaceholder', () => {
    it('returns food placeholder for default kitchen items', () => {
      expect(getProductPlaceholder({ fulfillment_lane: 'kitchen' })).toBe(PLACEHOLDER_FOOD_IMAGE);
      expect(getProductPlaceholder({ category: 'Trà Trái Cây' })).toBe(PLACEHOLDER_FOOD_IMAGE);
      expect(getProductPlaceholder({ name: 'Cà phê đen' })).toBe(PLACEHOLDER_FOOD_IMAGE);
    });

    it('returns goods placeholder for packing/merch/accessory items', () => {
      expect(getProductPlaceholder({ fulfillment_lane: 'packing' })).toBe(PLACEHOLDER_GOODS_IMAGE);
      expect(getProductPlaceholder({ category: 'Phụ kiện' })).toBe(PLACEHOLDER_GOODS_IMAGE);
      expect(getProductPlaceholder({ category: 'Thời trang' })).toBe(PLACEHOLDER_GOODS_IMAGE);
      expect(getProductPlaceholder({ name: 'Túi tote canvas' })).toBe(PLACEHOLDER_GOODS_IMAGE);
      expect(getProductPlaceholder({ name: 'Bình giữ nhiệt' })).toBe(PLACEHOLDER_GOODS_IMAGE);
    });
  });

  describe('resolveProductImage', () => {
    it('returns PLACEHOLDER_FOOD_IMAGE when food/drink has no image', () => {
      const res = resolveProductImage('mon-moi-la', null, {
        fulfillment_lane: 'kitchen',
        category: 'Trà Đặc Biệt',
        name: 'Món Thử Nghiệm Bếp',
      });
      expect(res).toBe(PLACEHOLDER_FOOD_IMAGE);
    });

    it('returns PLACEHOLDER_GOODS_IMAGE when retail/merch/packing item has no image', () => {
      const res = resolveProductImage('ao-thun-teaplus', null, {
        fulfillment_lane: 'packing',
        category: 'Quà Tặng',
        name: 'Áo Thun TeaPlus Special',
      });
      expect(res).toBe(PLACEHOLDER_GOODS_IMAGE);
    });

    it('upgrades legacy /placeholder.png to proper category placeholder', () => {
      const foodRes = resolveProductImage('mon-an-vat', '/placeholder.png', {
        fulfillment_lane: 'kitchen',
        category: 'Đồ Ăn',
        name: 'Bánh Mì Nướng',
      });
      expect(foodRes).toBe(PLACEHOLDER_FOOD_IMAGE);

      const goodsRes = resolveProductImage('phu-kien-1', '/placeholder.png', {
        fulfillment_lane: 'packing',
        category: 'Phụ kiện',
        name: 'Móc Khóa TeaPlus',
      });
      expect(goodsRes).toBe(PLACEHOLDER_GOODS_IMAGE);
    });

    it('preserves valid custom external/CDN image URLs', () => {
      const validUrl = 'https://images.example.com/products/special.jpg';
      const res = resolveProductImage('special-tea', validUrl, {
        fulfillment_lane: 'kitchen',
        name: 'Trà Đặc Biệt',
      });
      expect(res).toBe(validUrl);
    });

    it('preserves valid /catalog/ images', () => {
      const res = resolveProductImage('ca-phe-sua', '/catalog/ca-phe-sua.png', {
        fulfillment_lane: 'kitchen',
        name: 'Cà Phê Sữa',
      });
      expect(res).toBe('/catalog/ca-phe-sua.png');
    });
  });

  describe('buildWishlistQuickCartItem image resolution', () => {
    const storeInfo = { id: 1, name: 'Chi nhánh Quận 1', district: 'Quận 1' };

    it('assigns PLACEHOLDER_FOOD_IMAGE to food item without image', () => {
      const item: WishlistItem = {
        id: 1,
        user_id: 10,
        product_id: 88,
        product_name: 'Trà Quế Mới',
        product_slug: 'tra-que-moi',
        base_tea: 'Lục trà',
        image_url: null,
        price: 35000,
        is_available: true,
        sku: 'SKU-88-M',
        variant_id: 201,
        variant_name: 'Size M',
        fulfillment_lane: 'kitchen',
        stock_mode: 'made_to_order',
        has_options: false,
        created_at: new Date().toISOString(),
      };

      const cartItem = buildWishlistQuickCartItem(item, storeInfo);
      expect(cartItem).not.toBeNull();
      expect(cartItem!.image).toBe(PLACEHOLDER_FOOD_IMAGE);
    });

    it('assigns PLACEHOLDER_GOODS_IMAGE to packing item without image', () => {
      const item: WishlistItem = {
        id: 2,
        user_id: 10,
        product_id: 99,
        product_name: 'Túi Vải Canvas',
        product_slug: 'tui-vai-canvas',
        base_tea: 'Không cốt trà',
        image_url: null,
        price: 85000,
        is_available: true,
        sku: 'SKU-99-DEF',
        variant_id: 202,
        variant_name: 'Tiêu chuẩn',
        fulfillment_lane: 'packing',
        stock_mode: 'tracked',
        has_options: false,
        created_at: new Date().toISOString(),
      };

      const cartItem = buildWishlistQuickCartItem(item, storeInfo);
      expect(cartItem).not.toBeNull();
      expect(cartItem!.image).toBe(PLACEHOLDER_GOODS_IMAGE);
    });
  });
});
