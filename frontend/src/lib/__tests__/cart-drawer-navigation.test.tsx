import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SmartCartDrawer } from '@/components/cart/SmartCartDrawer';
import { CartProvider } from '@/lib/cart';

// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, onClick, children, ...props }: any) => (
    <a
      href={to}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/customer-session', () => ({
  openCustomerLoginModal: vi.fn(),
  useCustomerSession: () => null,
  getCustomerSession: () => null,
  getCustomerToken: () => null,
  clearCustomerToken: vi.fn(),
}));

describe('SmartCartDrawer Navigation Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    document.body.innerHTML = '';
  });

  it('immediately closes drawer and navigates to /menu when clicking "Khám phá Thực Đơn" in empty cart', async () => {
    await act(async () => {
      root!.render(
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <SmartCartDrawer />
          </CartProvider>
        </QueryClientProvider>,
      );
    });

    // 1. Open the cart drawer
    const trigger = container!.querySelector('button[aria-label^="Giỏ hàng"]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger.click();
    });

    // Drawer is now open
    expect(document.body.textContent).toContain('Giỏ hàng của bạn đang trống.');

    // 2. Find "Khám phá Thực Đơn" button / link
    const exploreButton = Array.from(document.querySelectorAll('a, button')).find(
      (el) => el.textContent?.includes('Khám phá Thực Đơn'),
    ) as HTMLElement;

    expect(exploreButton).not.toBeNull();
    expect(exploreButton.classList.contains('touch-manipulation')).toBe(true);

    // 3. Click / Tap "Khám phá Thực Đơn"
    await act(async () => {
      exploreButton.click();
    });

    // 4. Verify navigate({ to: '/menu' }) was called
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/menu' });

    // 5. Verify the drawer is closed (open state updated)
    // Radix Dialog content sets data-state="closed" when open is false
    const sheetContent = document.querySelector('[role="dialog"]');
    if (sheetContent) {
      expect(sheetContent.getAttribute('data-state')).toBe('closed');
    }
  });
});
