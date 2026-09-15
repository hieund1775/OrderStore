import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AdminPreordersPage } from '@/routes/admin.dat-truoc';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (opts: any) => opts,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

describe('Admin Preorder Single Controller Fetch Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(api.getUser).mockReturnValue({
      id: 1,
      name: 'Manager User',
      role: 'manager',
      store_id: 1,
    } as any);

    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/preorders/settings')) {
        return { stores: [] };
      }
      if (url.startsWith('/admin/branches')) {
        return [];
      }
      if (url.startsWith('/admin/preorders')) {
        const parsedUrl = new URL(`http://localhost${url}`);
        const p = Number(parsedUrl.searchParams.get('page') || '1');
        return {
          items: [
            {
              id: p,
              preorder_code: `PRE-${p}`,
              status: 'PENDING_MANAGER_CONFIRMATION',
              scheduled_start_at: '2026-09-15T12:00:00.000Z',
              reschedule_count: 0,
              orders: [],
            },
          ],
          pagination: { page: p, limit: 6, totalItems: 12, totalPages: 2 },
        };
      }
      return [];
    });
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('issues exactly ONE initial request on mount (no duplicate fetch)', async () => {
    await act(async () => {
      root?.render(<AdminPreordersPage />);
    });

    // Let any resolved promises flush
    await act(async () => {
      await Promise.resolve();
    });

    const preorderCalls = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );

    expect(preorderCalls).toHaveLength(1);
    expect(preorderCalls[0][0]).toContain('view=pending');
    expect(preorderCalls[0][0]).toContain('page=1');
    expect(preorderCalls[0][0]).toContain('limit=6');
  });

  it('issues exactly ONE request when changing view filter (no duplicate fetch)', async () => {
    await act(async () => {
      root?.render(<AdminPreordersPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const initialCalls = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );
    expect(initialCalls).toHaveLength(1);

    // Find and click the 'today' tab button
    const buttons = Array.from(container?.querySelectorAll('button') || []);
    const todayBtn = buttons.find((btn) => btn.textContent?.includes('Hôm nay'));
    expect(todayBtn).toBeDefined();

    await act(async () => {
      todayBtn?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const callsAfterFilter = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );

    // Initial call (view=pending) + exactly ONE call for view=today = 2 calls total
    expect(callsAfterFilter).toHaveLength(2);
    expect(callsAfterFilter[1][0]).toContain('view=today');
    expect(callsAfterFilter[1][0]).toContain('page=1');
    expect(callsAfterFilter[1][0]).toContain('limit=6');
  });

  it('polls at regular interval with exactly ONE background request per interval', async () => {
    await act(async () => {
      root?.render(<AdminPreordersPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const initialCalls = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );
    expect(initialCalls).toHaveLength(1);

    // Advance 10s for the first poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const callsAfterPoll = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );
    expect(callsAfterPoll).toHaveLength(2);

    // Advance another 10s for the second poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const callsAfterSecondPoll = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );
    expect(callsAfterSecondPoll).toHaveLength(3);
  });

  it('issues exactly ONE request when changing page (no duplicate fetch)', async () => {
    await act(async () => {
      root?.render(<AdminPreordersPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const initialCalls = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );
    expect(initialCalls).toHaveLength(1);
    expect(initialCalls[0][0]).toContain('page=1');

    // Find and click the 'Trang sau' button
    const buttons = Array.from(container?.querySelectorAll('button') || []);
    const nextPageBtn = buttons.find((btn) => btn.textContent?.includes('Trang sau'));
    expect(nextPageBtn).toBeDefined();

    await act(async () => {
      nextPageBtn?.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const callsAfterPageChange = vi.mocked(api.apiGet).mock.calls.filter(([url]) =>
      url.startsWith('/admin/preorders?')
    );

    // Initial fetch (page=1) + exactly ONE fetch for page=2 = 2 calls total
    expect(callsAfterPageChange).toHaveLength(2);
    expect(callsAfterPageChange[1][0]).toContain('page=2');
  });
});
