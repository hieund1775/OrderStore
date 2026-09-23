import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Route as HoSoRoute } from '@/routes/ho-so';
import * as api from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue({
    success: true,
    message: 'Cập nhật thông tin thành công!',
    user: { id: 10, fullname: 'Nguyễn Văn Đạt', phone: '0901234567', tier: 'Đồng', points: 100 },
  }),
  setCustomerUser: vi.fn(),
  getCustomerToken: vi.fn().mockReturnValue('mock-token'),
  resolveProductConfiguration: vi.fn(),
}));

vi.mock('@/lib/auth-logout', () => ({
  explicitCustomerLogout: vi.fn(),
  LOGOUT_SUCCESS_MESSAGE: 'Đã đăng xuất tài khoản',
}));

vi.mock('@/lib/notifications', () => ({
  useCustomerNotifications: () => ({
    user: { id: 10, fullname: 'Nguyễn Văn Cũ', phone: '0901234567', tier: 'Đồng', points: 100 },
    token: 'mock-token',
    notifications: [],
    pagination: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
  isSafeInternalLink: () => false,
}));

vi.mock('@/lib/cart', () => ({
  useCart: () => ({ addItem: vi.fn() }),
  mapConfiguredItemToCartItem: vi.fn(),
}));

vi.mock('@/lib/branch', () => ({
  useBranch: () => ({ selectedStore: { id: 1, name: 'Chi nhánh 1' } }),
}));

vi.mock('@/lib/wishlist', () => ({
  useWishlist: () => ({
    items: [],
    count: 0,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    removeFavorite: vi.fn(),
    isPending: () => false,
  }),
  buildWishlistQuickCartItem: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

describe('Customer Profile Update & CTA Suite', () => {
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
    container = null;
    root = null;
  });

  it('contract: ho-so.tsx contains controlled name input, CTA button, and red logout button', () => {
    const hoSoPath = path.resolve(process.cwd(), 'src/routes/ho-so.tsx');
    const content = fs.readFileSync(hoSoPath, 'utf8');

    // Name input has label "Họ và tên" and is bound to fullNameInput
    expect(content).toContain('<Label htmlFor="p-name">Họ và tên</Label>');
    expect(content).toContain('value={fullNameInput}');
    expect(content).toContain('onChange={(e) => setFullNameInput(e.target.value)}');

    // CTA button with "Lưu thay đổi" and loading indicator
    expect(content).toContain('onClick={handleSaveName}');
    expect(content).toContain('Lưu thay đổi');
    expect(content).toContain('Đang lưu...');
    expect(content).toContain('apiPatch');

    // Logout button in aside
    expect(content).toContain('Đăng xuất tài khoản');
    expect(content).toContain('text-destructive');
  });

  it('renders "Thông tin cá nhân" tab with input and CTA button, and triggers update API on click', async () => {
    (HoSoRoute as any).useSearch = () => ({ tab: 'info' });
    const Component = HoSoRoute.options.component as React.ComponentType;

    await act(async () => {
      root?.render(<Component />);
    });

    // Switch to info tab
    const tabs = container?.querySelectorAll('[role="tab"]');
    const infoTab = Array.from(tabs || []).find((t) => t.textContent?.includes('Thông tin'));
    expect(infoTab).toBeDefined();

    await act(async () => {
      infoTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Check input is rendered with current name
    const input = container?.querySelector('#p-name') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('Nguyễn Văn Cũ');

    // Check CTA button "Lưu thay đổi" is rendered
    const buttons = container?.querySelectorAll('button');
    const saveButton = Array.from(buttons || []).find((b) => b.textContent?.includes('Lưu thay đổi'));
    expect(saveButton).toBeDefined();

    // Type a new valid name using nativeInputValueSetter for React 18/19
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, 'Nguyễn Văn Đạt');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click Save changes button
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Check apiPatch was called
    expect(api.apiPatch).toHaveBeenCalledWith(
      '/api/users/10',
      { fullname: 'Nguyễn Văn Đạt' }
    );

    // Check success toast was displayed
    expect(toast.success).toHaveBeenCalledWith('Cập nhật thông tin thành công!');
    expect(api.setCustomerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        fullname: 'Nguyễn Văn Đạt',
      })
    );
  });
});
