import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileBottomNav } from '../MobileBottomNav';
import * as customerSessionModule from '@/lib/customer-session';
import * as cartModule from '@/lib/cart';

const mockRouterState = vi.hoisted(() => ({
  pathname: '/',
  search: {} as Record<string, string>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    search?: Record<string, unknown>;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
  }) => {
    const searchParam = search?.tab ? `?tab=${search.tab}` : '';
    return (
      <a
        href={`${to}${searchParam}`}
        onClick={onClick}
        className={className}
        data-testid={`bottom-link-${to.replace('/', '') || 'home'}`}
        {...props}
      >
        {children}
      </a>
    );
  },
  useRouterState: ({ select }: { select?: (s: any) => any } = {}) => {
    const state = { location: { pathname: mockRouterState.pathname, search: mockRouterState.search } };
    return select ? select(state) : state;
  },
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/customer-session', () => ({
  useCustomerSession: vi.fn(),
  openCustomerLoginModal: vi.fn(),
}));

vi.mock('@/lib/cart', () => ({
  useCart: vi.fn(),
}));

describe('MobileBottomNav (Thumb-Friendly Navigation Bar)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockRouterState.pathname = '/';
    mockRouterState.search = {};
    vi.mocked(customerSessionModule.useCustomerSession).mockReturnValue(null);
    vi.mocked(cartModule.useCart).mockReturnValue({
      count: 0,
      items: [],
      groups: [],
      subtotal: 0,
    } as any);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('renders 5 thumb-friendly tabs: Trang chủ, Thực đơn, Giỏ hàng, Đơn mua, Tài khoản', () => {
    act(() => {
      root.render(<MobileBottomNav />);
    });

    expect(container.textContent).toContain('Trang chủ');
    expect(container.textContent).toContain('Thực đơn');
    expect(container.textContent).toContain('Giỏ hàng');
    expect(container.textContent).toContain('Đơn mua');
    expect(container.textContent).toContain('Tài khoản');

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.className).toContain('fixed');
    expect(nav?.className).toContain('bottom-0');
    expect(nav?.className).toContain('md:hidden');
  });

  it('renders cart badge with correct item count when count > 0', () => {
    vi.mocked(cartModule.useCart).mockReturnValue({
      count: 3,
      items: [],
      groups: [],
      subtotal: 90000,
    } as any);

    act(() => {
      root.render(<MobileBottomNav />);
    });

    const badge = container.querySelector('span.rounded-full');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('3');
  });

  it('dispatches "teaplus:open-cart" event when clicking Giỏ hàng button', () => {
    act(() => {
      root.render(<MobileBottomNav />);
    });

    const cartEventListener = vi.fn();
    window.addEventListener('teaplus:open-cart', cartEventListener);

    const cartBtn = container.querySelector('button[aria-label^="Giỏ hàng"]');
    expect(cartBtn).not.toBeNull();

    act(() => {
      cartBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(cartEventListener).toHaveBeenCalled();
    window.removeEventListener('teaplus:open-cart', cartEventListener);
  });

  it('invokes openCustomerLoginModal when guest clicks Đơn mua or Tài khoản', () => {
    act(() => {
      root.render(<MobileBottomNav />);
    });

    const links = Array.from(container.querySelectorAll('a'));
    const donMuaLink = links.find((a) => a.textContent?.includes('Đơn mua'));
    const taiKhoanLink = links.find((a) => a.textContent?.includes('Tài khoản'));

    expect(donMuaLink).toBeDefined();
    expect(taiKhoanLink).toBeDefined();

    act(() => {
      donMuaLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(customerSessionModule.openCustomerLoginModal).toHaveBeenCalledTimes(1);

    act(() => {
      taiKhoanLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(customerSessionModule.openCustomerLoginModal).toHaveBeenCalledTimes(2);
  });

  it('highlights active tab according to current route and search param', () => {
    mockRouterState.pathname = '/menu';
    act(() => {
      root.render(<MobileBottomNav />);
    });

    const links = Array.from(container.querySelectorAll('a'));
    const menuLink = links.find((a) => a.textContent?.includes('Thực đơn'));
    const homeLink = links.find((a) => a.textContent?.includes('Trang chủ'));

    expect(menuLink?.className).toContain('text-primary');
    expect(homeLink?.className).not.toContain('text-primary');
  });
});
