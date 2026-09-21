import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { KdsPage } from '@/routes/admin.bep';
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

describe('KDS Preorder Preview Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(api.getUser).mockReturnValue({
      id: 1,
      name: 'Kitchen Staff',
      role: 'kitchen',
      store_id: 1,
    } as any);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    vi.restoreAllMocks();
  });

  it('calls /admin/preorders/kitchen/confirmed with limit=6 query parameter', async () => {
    let capturedPreorderUrl = '';
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/kitchen/orders')) {
        return { items: [], pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 0 } };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        capturedPreorderUrl = url;
        return [
          {
            id: 1,
            preorder_code: 'PRE-KDS-1',
            scheduled_start_at: '2026-09-15T12:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Nguyễn Văn A',
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<KdsPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedPreorderUrl).toContain('/admin/preorders/kitchen/confirmed');
    expect(capturedPreorderUrl).toContain('limit=6');
  });

  it('renders confirmed preorder preview cards as returned by the backend authority', async () => {
    const sixPreorders = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      preorder_code: `PRE-KDS-${i + 1}`,
      scheduled_start_at: '2026-09-15T12:00:00.000Z',
      store_name: 'Chi nhánh 1',
      customer_name: `Khách hàng ${i + 1}`,
    }));

    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/kitchen/orders')) {
        return { items: [], pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 0 } };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        return sixPreorders;
      }
      return [];
    });

    await act(async () => {
      root?.render(<KdsPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Check preview section header
    expect(container?.textContent).toContain('Preorder sắp tới');

    // Count preview items rendered
    const previewCards = Array.from(container?.querySelectorAll('article') || []).filter(
      (article) => article.textContent?.includes('PRE-KDS-')
    );

    expect(previewCards).toHaveLength(6);
    expect(container?.textContent).toContain('PRE-KDS-1');
    expect(container?.textContent).toContain('PRE-KDS-6');
  });

  it('safely handles empty previews without crashing or showing preview section', async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/kitchen/orders')) {
        return { items: [], pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 0 } };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        return [];
      }
      return [];
    });

    await act(async () => {
      root?.render(<KdsPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container?.textContent).not.toContain('Preorder sắp tới');
  });

  it('filters out preorders whose linked orders are finished or cancelled', async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/kitchen/orders')) {
        return {
          items: [
            {
              id: 501,
              order_code: 'ORD-DONE-1',
              order_type: 'Take-away',
              preorder_id: 10,
              customer_name: 'Khách A',
              current_status: 'Hoàn thành',
              created_at: new Date().toISOString(),
              items: [],
            },
            {
              id: 502,
              order_code: 'ORD-CANCEL-1',
              order_type: 'Take-away',
              preorder_id: 20,
              customer_name: 'Khách B',
              current_status: 'Đã hủy',
              created_at: new Date().toISOString(),
              items: [],
            },
            {
              id: 503,
              order_code: 'ORD-PREP-1',
              order_type: 'Take-away',
              preorder_id: 30,
              customer_name: 'Khách C',
              current_status: 'Đang chuẩn bị',
              created_at: new Date().toISOString(),
              items: [],
            },
          ],
          pagination: { page: 1, limit: 10, totalPages: 1, totalItems: 3 },
        };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        return [
          {
            id: 10,
            preorder_code: 'PRE-DONE-10',
            scheduled_start_at: '2026-09-15T12:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách A',
          },
          {
            id: 20,
            preorder_code: 'PRE-CANCEL-20',
            scheduled_start_at: '2026-09-15T12:30:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách B',
          },
          {
            id: 30,
            preorder_code: 'PRE-ACTIVE-30',
            scheduled_start_at: '2026-09-15T13:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách C',
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<KdsPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container?.textContent).toContain('Preorder sắp tới');
    // Active preorder should be visible
    expect(container?.textContent).toContain('PRE-ACTIVE-30');
    // Completed and cancelled preorders should be filtered out
    expect(container?.textContent).not.toContain('PRE-DONE-10');
    expect(container?.textContent).not.toContain('PRE-CANCEL-20');
  });
});
