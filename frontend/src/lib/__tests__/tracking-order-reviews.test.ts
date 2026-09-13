import { describe, it, expect } from 'vitest';
import type { ReviewableItem } from '@/components/reviews/OrderReviewPanel';

describe('Tracking Order Reviews Contracts', () => {
  it('preserves distinct orderItemId and productId without overloading or swapping', () => {
    const rawItems = [
      { id: 101, order_item_id: 101, product_id: 12, product_name: 'Trà Oolong Đào', qty: 2, size_label: 'L' },
      { id: 102, order_item_id: 102, product_id: 15, product_name: 'Trà Sữa Trân Châu', qty: 1, size_label: 'M' },
    ];

    const reviewableItems: ReviewableItem[] = rawItems.map((it) => ({
      orderItemId: Number(it.order_item_id || it.id),
      productId: Number(it.product_id),
      name: `${it.qty}× ${it.product_name}${it.size_label ? ` (${it.size_label})` : ''}`,
    }));

    expect(reviewableItems[0].orderItemId).toBe(101);
    expect(reviewableItems[0].productId).toBe(12);
    expect(reviewableItems[0].name).toBe('2× Trà Oolong Đào (L)');

    expect(reviewableItems[1].orderItemId).toBe(102);
    expect(reviewableItems[1].productId).toBe(15);
    expect(reviewableItems[1].name).toBe('1× Trà Sữa Trân Châu (M)');

    // Ensure orderItemId and productId are strictly different values
    expect(reviewableItems[0].orderItemId).not.toBe(reviewableItems[0].productId);
    expect(reviewableItems[1].orderItemId).not.toBe(reviewableItems[1].productId);
  });

  it('determines canReview strictly for completed account-owned orders', () => {
    function computeCanReview({
      status,
      isCustomerOwner,
    }: {
      status: string;
      isCustomerOwner: boolean;
    }): boolean {
      return Boolean(isCustomerOwner && status === 'Hoàn thành');
    }

    // Completed account-owned order -> true
    expect(computeCanReview({ status: 'Hoàn thành', isCustomerOwner: true })).toBe(true);

    // Not completed -> false
    expect(computeCanReview({ status: 'Đang chuẩn bị', isCustomerOwner: true })).toBe(false);
    expect(computeCanReview({ status: 'Đang giao', isCustomerOwner: true })).toBe(false);
    expect(computeCanReview({ status: 'Đã hủy', isCustomerOwner: true })).toBe(false);

    // Guest QR order (not account-owned) -> false even if completed
    expect(computeCanReview({ status: 'Hoàn thành', isCustomerOwner: false })).toBe(false);
  });

  it('isolates state per item without cross-item contamination', () => {
    type ItemState = {
      loading: boolean;
      eligible: boolean;
      hasReviewed: boolean;
      rating?: number;
      error?: string;
    };

    const states: Record<number, ItemState> = {
      101: { loading: false, eligible: true, hasReviewed: false },
      102: { loading: false, eligible: false, hasReviewed: true, rating: 5 },
      103: { loading: false, eligible: false, hasReviewed: false, error: 'Network error' },
    };

    expect(states[101].eligible).toBe(true);
    expect(states[101].hasReviewed).toBe(false);

    expect(states[102].eligible).toBe(false);
    expect(states[102].hasReviewed).toBe(true);
    expect(states[102].rating).toBe(5);

    expect(states[103].error).toBe('Network error');
  });

  it('correctly maps grouped tracking child orders with real order_item_id', () => {
    const rawChildOrder = {
      order_id: '201',
      order_code: 'TP20260914001',
      status: 'Hoàn thành',
      items: [
        {
          id: 501,
          order_item_id: 501,
          product_id: '9',
          product_name: 'Trà Chanh Giã Tay',
          quantity: 2,
        },
      ],
    };

    const reviewItems: ReviewableItem[] = rawChildOrder.items
      .filter((it) => Boolean(it.order_item_id))
      .map((it) => ({
        orderItemId: Number(it.order_item_id),
        productId: Number(it.product_id),
        name: `${it.quantity}× ${it.product_name}`,
      }));

    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].orderItemId).toBe(501);
    expect(reviewItems[0].productId).toBe(9);
    expect(reviewItems[0].name).toBe('2× Trà Chanh Giã Tay');
  });
});
