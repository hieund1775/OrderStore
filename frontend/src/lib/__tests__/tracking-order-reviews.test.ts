import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderReviewPanel, type ReviewableItem } from '@/components/reviews/OrderReviewPanel';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getCustomerToken: vi.fn(),
}));

describe('Tracking Order Reviews Component and Contracts', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  });

  it('renders nothing when canReview is false', async () => {
    const items: ReviewableItem[] = [
      { orderItemId: 101, productId: 12, name: '2× Trà Oolong Đào' },
    ];

    await act(async () => {
      root?.render(<OrderReviewPanel orderCode="TP2609070041" items={items} canReview={false} />);
    });

    expect(container?.innerHTML).toBe('');
  });

  it('renders nothing when items array is empty even if canReview is true', async () => {
    await act(async () => {
      root?.render(<OrderReviewPanel orderCode="TP2609070041" items={[]} canReview={true} />);
    });

    expect(container?.innerHTML).toBe('');
  });

  it('renders review panel with actual items when canReview is true and user is authenticated', async () => {
    vi.mocked(api.getCustomerToken).mockReturnValue('valid-customer-token');
    vi.mocked(api.apiGet).mockResolvedValue({
      eligible: true,
    });

    const items: ReviewableItem[] = [
      { orderItemId: 101, productId: 12, name: '2× Trà Oolong Đào (L)' },
      { orderItemId: 102, productId: 15, name: '1× Trà Sữa Trân Châu (M)' },
    ];

    await act(async () => {
      root?.render(<OrderReviewPanel orderCode="TP2609070041" items={items} canReview={true} />);
    });

    expect(container?.textContent).toContain('Đánh giá món đã đặt');
    expect(container?.textContent).toContain('2× Trà Oolong Đào (L)');
    expect(container?.textContent).toContain('1× Trà Sữa Trân Châu (M)');
    expect(api.apiGet).toHaveBeenCalledWith('/api/orders/TP2609070041/items/101/review');
    expect(api.apiGet).toHaveBeenCalledWith('/api/orders/TP2609070041/items/102/review');
  });

  it('shows already reviewed state when item review is already recorded', async () => {
    vi.mocked(api.getCustomerToken).mockReturnValue('valid-customer-token');
    vi.mocked(api.apiGet).mockResolvedValue({
      eligible: false,
      reason: 'Bạn đã đánh giá món này',
      review: { rating: 5 },
    });

    const items: ReviewableItem[] = [
      { orderItemId: 101, productId: 12, name: '2× Trà Oolong Đào (L)' },
    ];

    await act(async () => {
      root?.render(<OrderReviewPanel orderCode="TP2609070041" items={items} canReview={true} />);
    });

    expect(container?.textContent).toContain('Đã đánh giá');
  });

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

    expect(reviewableItems[0].orderItemId).not.toBe(reviewableItems[0].productId);
    expect(reviewableItems[1].orderItemId).not.toBe(reviewableItems[1].productId);
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
