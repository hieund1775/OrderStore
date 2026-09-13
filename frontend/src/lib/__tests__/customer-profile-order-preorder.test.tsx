import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Route as HoSoRoute } from '@/routes/ho-so';
import { Route as DonDatTruocRoute } from '@/routes/don-dat-truoc';
import {
  CustomerPreordersTab,
  normalizeCustomerPreorders,
  normalizeCustomerPreorder,
  formatSlot,
  getStatusPresentation,
  canCancel,
} from '@/components/profile/CustomerPreordersTab';
import * as api from '@/lib/api';

const customerSession = vi.hoisted(() => ({
  current: null as { userId: number; token: string } | null,
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getCustomerToken: vi.fn(),
}));

vi.mock('@/lib/customer-session', () => ({
  openCustomerLoginModal: vi.fn(),
  useCustomerSession: () => customerSession.current,
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

describe('Customer Profile: Order and Preorder Tabs Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    customerSession.current = null;
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

  describe('1. Profile Route Search Validation & Tabs Contract', () => {
    it('validates allowed tabs and falls back to undefined (defaulting to orders) for malformed tab queries', () => {
      const validateSearch = HoSoRoute.options.validateSearch as (search: Record<string, unknown>) => { tab?: string; code?: string };

      expect(validateSearch({ tab: 'orders' }).tab).toBe('orders');
      expect(validateSearch({ tab: 'preorders' }).tab).toBe('preorders');
      expect(validateSearch({ tab: 'notifications' }).tab).toBe('notifications');
      expect(validateSearch({ tab: 'wishlist' }).tab).toBe('wishlist');
      expect(validateSearch({ tab: 'info' }).tab).toBe('info');

      // Malformed / unknown tabs
      expect(validateSearch({ tab: 'unknown' }).tab).toBeUndefined();
      expect(validateSearch({ tab: 123 }).tab).toBeUndefined();
      expect(validateSearch({ tab: '' }).tab).toBeUndefined();
      expect(validateSearch({}).tab).toBeUndefined();
    });

    it('safely preserves optional code parameter for deep link highlighting', () => {
      const validateSearch = HoSoRoute.options.validateSearch as (search: Record<string, unknown>) => { tab?: string; code?: string };

      expect(validateSearch({ tab: 'preorders', code: 'PRE-123' })).toEqual({
        tab: 'preorders',
        code: 'PRE-123',
      });
      expect(validateSearch({ code: '   ' }).code).toBeUndefined();
    });

    it('defines exactly 5 tabs in the exact specified order in ho-so.tsx', () => {
      const hoSoPath = path.resolve(process.cwd(), 'src/routes/ho-so.tsx');
      const content = fs.readFileSync(hoSoPath, 'utf8');

      const expectedOrder = ['orders', 'preorders', 'notifications', 'wishlist', 'info'];

      // Check TabsList trigger order
      const triggerMatches = [...content.matchAll(/<TabsTrigger[^>]*value="([^"]+)"/g)].map((m) => m[1]);
      expect(triggerMatches).toEqual(expectedOrder);

      // Check TabsContent order
      const contentMatches = [...content.matchAll(/<TabsContent[^>]*value="([^"]+)"/g)].map((m) => m[1]);
      expect(contentMatches).toEqual(expectedOrder);
    });
  });

  describe('2. Preorder Route Compatibility Redirect', () => {
    it('validates code search param on legacy /don-dat-truoc route', () => {
      const validateSearch = DonDatTruocRoute.options.validateSearch as (search: Record<string, unknown>) => { code?: string };

      expect(validateSearch({ code: 'PRE-999' })).toEqual({ code: 'PRE-999' });
      expect(validateSearch({ code: '' })).toEqual({ code: undefined });
    });

    it('performs client-side redirect and never calls apiGet in /don-dat-truoc.tsx', () => {
      const donDatTruocPath = path.resolve(process.cwd(), 'src/routes/don-dat-truoc.tsx');
      const content = fs.readFileSync(donDatTruocPath, 'utf8');

      expect(content).toContain("to: '/ho-so'");
      expect(content).toContain("tab: 'preorders'");
      expect(content).not.toContain('/api/preorders/mine');
      expect(content).not.toContain('apiGet');
    });
  });

  describe('3. Preorder Normalizer & Render-Safety Contract', () => {
    it('safely normalizes missing or non-array preorders without throwing', () => {
      expect(normalizeCustomerPreorders(null)).toEqual([]);
      expect(normalizeCustomerPreorders(undefined)).toEqual([]);
      expect(normalizeCustomerPreorders('not-an-array')).toEqual([]);
      expect(normalizeCustomerPreorders({})).toEqual([]);
      expect(normalizeCustomerPreorders([null, undefined, 42])).toEqual([]);
    });

    it('safely normalizes missing or malformed nested orders and items', () => {
      const raw = {
        id: 101,
        preorder_code: 'PRE-101',
        status: 'CONFIRMED',
        // orders is missing
      };
      const normalized = normalizeCustomerPreorder(raw);
      expect(normalized).not.toBeNull();
      expect(normalized?.orders).toEqual([]);

      // orders is an array but items is missing or not an array
      const rawWithOrders = {
        id: 102,
        preorder_code: 'PRE-102',
        status: 'CONFIRMED',
        orders: [
          { id: 201, order_code: 'ORD-201' /* items missing */ },
          { id: 202, order_code: 'ORD-202', items: 'invalid-items' },
        ],
      };
      const normalizedWithOrders = normalizeCustomerPreorder(rawWithOrders);
      expect(normalizedWithOrders?.orders.length).toBe(2);
      expect(normalizedWithOrders?.orders[0].items).toEqual([]);
      expect(normalizedWithOrders?.orders[1].items).toEqual([]);
    });

    it('safely formats schedule times and never throws or renders Invalid Date', () => {
      expect(formatSlot(null, null)).toBe('Chưa xác định thời gian');
      expect(formatSlot('', '')).toBe('Chưa xác định thời gian');
      expect(formatSlot('invalid-date', 'invalid-date')).toBe('Thời gian không hợp lệ');

      const formatted = formatSlot('2026-10-15T10:00:00.000Z', '2026-10-15T11:00:00.000Z');
      expect(formatted).not.toContain('Invalid Date');
      expect(formatted).toContain('17:00'); // UTC+7 for Asia/Ho_Chi_Minh
    });

    it('returns neutral fallback for unknown or missing status', () => {
      expect(getStatusPresentation(null).label).toBe('Đang cập nhật trạng thái');
      expect(getStatusPresentation(undefined).label).toBe('Đang cập nhật trạng thái');
      expect(getStatusPresentation('SOME_UNKNOWN_STATUS').label).toBe('Đang cập nhật trạng thái');
      expect(getStatusPresentation('CONFIRMED').label).toBe('Đã xác nhận · chờ check-in');
    });

    it('evaluates canCancel safely with valid start time in future and correct status', () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const pastTime = new Date(Date.now() - 3600000).toISOString();

      const preorderBase: any = {
        id: 1,
        preorder_code: 'PRE-1',
        store_name: 'Store 1',
        scheduled_end_at: futureTime,
        orders: [],
      };

      expect(canCancel({ ...preorderBase, status: 'CONFIRMED', scheduled_start_at: futureTime })).toBe(true);
      expect(canCancel({ ...preorderBase, status: 'PENDING_MANAGER_CONFIRMATION', scheduled_start_at: futureTime })).toBe(true);
      expect(canCancel({ ...preorderBase, status: 'AWAITING_PAYMENT', scheduled_start_at: futureTime })).toBe(true);

      // In past -> cannot cancel
      expect(canCancel({ ...preorderBase, status: 'CONFIRMED', scheduled_start_at: pastTime })).toBe(false);

      // Other status -> cannot cancel
      expect(canCancel({ ...preorderBase, status: 'COMPLETED', scheduled_start_at: futureTime })).toBe(false);
      expect(canCancel({ ...preorderBase, status: 'CHECKED_IN', scheduled_start_at: futureTime })).toBe(false);

      // Invalid start time -> cannot cancel
      expect(canCancel({ ...preorderBase, status: 'CONFIRMED', scheduled_start_at: 'bad-date' })).toBe(false);
    });
  });

  describe('4. Component Lifecycle & Isolation Behavior', () => {
    it('does not fetch preorders when user is guest (token null)', async () => {
      customerSession.current = null;

      await act(async () => {
        root?.render(<CustomerPreordersTab isActive={true} />);
      });

      expect(container?.textContent).toContain('Đơn đặt trước của tôi');
      expect(container?.textContent).toContain('Đăng nhập để theo dõi riêng lịch nhận món');
      expect(api.apiGet).not.toHaveBeenCalled();
    });

    it('does not fetch preorders when tab is inactive', async () => {
      customerSession.current = { userId: 1, token: 'mock-token' };

      await act(async () => {
        root?.render(<CustomerPreordersTab isActive={false} />);
      });

      expect(api.apiGet).not.toHaveBeenCalled();
    });

    it('fetches preorders when active and customer is authenticated', async () => {
      customerSession.current = { userId: 1, token: 'mock-token' };
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        preorders: [
          {
            id: 1,
            preorder_code: 'PRE-ABC-1',
            status: 'CONFIRMED',
            store_name: 'Chi nhánh Quận 1',
            scheduled_start_at: '2026-10-15T10:00:00.000Z',
            scheduled_end_at: '2026-10-15T11:00:00.000Z',
            orders: [
              {
                id: 10,
                order_code: 'ORD-10',
                current_status: 'Đã nhận',
                items: [
                  { id: 100, product_name: 'Trà Sữa Oolong', qty: 2, line_total: 60000 },
                ],
              },
            ],
          },
        ],
      });

      await act(async () => {
        root?.render(<CustomerPreordersTab isActive={true} />);
      });

      // Allow async load to settle
      await act(async () => {
        await Promise.resolve();
      });

      expect(api.apiGet).toHaveBeenCalledWith('/api/preorders/mine');
      expect(container?.textContent).toContain('PRE-ABC-1');
      expect(container?.textContent).toContain('Chi nhánh Quận 1');
      expect(container?.textContent).toContain('Đã xác nhận · chờ check-in');
      expect(container?.textContent).toContain('Món đã đặt (1)');
    });

    it('safely handles 200 responses with missing orders and items without crashing', async () => {
      customerSession.current = { userId: 1, token: 'mock-token' };
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        preorders: [
          {
            id: 2,
            preorder_code: 'PRE-DEF-2',
            status: 'AWAITING_PAYMENT',
            // Missing orders, table_name, etc.
          },
        ],
      });

      await act(async () => {
        root?.render(<CustomerPreordersTab isActive={true} />);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(api.apiGet).toHaveBeenCalled();
      expect(container?.textContent).toContain('PRE-DEF-2');
      expect(container?.textContent).toContain('Cửa hàng sẽ sắp xếp bàn');
      expect(container?.textContent).toContain('Món đã đặt (0)');
    });

    it('contains API error locally and provides retry button', async () => {
      customerSession.current = { userId: 1, token: 'mock-token' };
      vi.mocked(api.apiGet).mockRejectedValueOnce(new Error('Network failure'));

      await act(async () => {
        root?.render(<CustomerPreordersTab isActive={true} />);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(container?.textContent).toContain('Không thể tải đơn đặt trước. Vui lòng thử lại.');
      const buttons = container?.querySelectorAll('button') || [];
      const retryBtn = Array.from(buttons).find((b) => b.textContent?.includes('Thử lại'));
      expect(retryBtn).toBeDefined();

      // Click retry
      vi.mocked(api.apiGet).mockResolvedValueOnce({ preorders: [] });
      await act(async () => {
        retryBtn?.click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(api.apiGet).toHaveBeenCalledTimes(2);
      expect(container?.textContent).toContain('Chưa có đơn đặt trước');
    });

    it('clears customer A data across logout and ignores A response that settles after customer B signs in', async () => {
      let resolveA: ((value: any) => void) | undefined;
      vi.mocked(api.apiGet).mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
      customerSession.current = { userId: 1, token: 'token-a' };

      await act(async () => { root?.render(<CustomerPreordersTab isActive={true} />); });
      customerSession.current = null;
      await act(async () => { root?.render(<CustomerPreordersTab isActive={true} />); });

      await act(async () => { resolveA?.({ preorders: [{ id: 1, preorder_code: 'A-ONLY' }] }); });
      expect(container?.textContent).not.toContain('A-ONLY');
      expect(container?.textContent).toContain('Đăng nhập để theo dõi riêng');

      vi.mocked(api.apiGet).mockResolvedValueOnce({ preorders: [{ id: 2, preorder_code: 'B-ONLY' }] });
      customerSession.current = { userId: 2, token: 'token-b' };
      await act(async () => { root?.render(<CustomerPreordersTab isActive={true} />); });
      await act(async () => { await Promise.resolve(); });
      expect(container?.textContent).toContain('B-ONLY');
      expect(container?.textContent).not.toContain('A-ONLY');
    });
  });
});
