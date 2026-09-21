import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PackingStationPage } from '@/routes/admin.dong-goi';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
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

describe('Packing Station Preorder Preview Suite', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(api.getUser).mockReturnValue({
      id: 2,
      name: 'Packing Staff',
      role: 'packing',
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

  it('calls /admin/preorders/kitchen/confirmed with lane=packing and limit=6', async () => {
    let capturedUrl = '';
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/fulfillment/tasks')) {
        return { tasks: [] };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        capturedUrl = url;
        return [
          {
            id: 1,
            preorder_code: 'PRE-PACK-01',
            scheduled_start_at: '2026-09-22T14:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách hàng A',
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<PackingStationPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedUrl).toContain('/admin/preorders/kitchen/confirmed');
    expect(capturedUrl).toContain('lane=packing');
    expect(capturedUrl).toContain('limit=6');
    expect(container?.textContent).toContain('Preorder sắp tới (Đóng gói)');
    expect(container?.textContent).toContain('PRE-PACK-01');
  });

  it('renders preorder badge and scheduled time on task cards', async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/fulfillment/tasks')) {
        return {
          tasks: [
            {
              id: 101,
              order_id: 1,
              order_code: 'ORD-PACK-01',
              order_type: 'Take-away',
              branch_id: 1,
              store_name: 'Chi nhánh 1',
              lane: 'packing',
              status: 'pending',
              preorder_code: 'PRE-PACK-01',
              preorder_scheduled_start_at: '2026-09-22T15:00:00.000Z',
              items: [{ id: 1, task_id: 101, product_name: 'Túi vải Canvas', quantity: 1 }],
            },
          ],
        };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        return [
          {
            id: 1,
            preorder_code: 'PRE-PACK-01',
            scheduled_start_at: '2026-09-22T15:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách hàng A',
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<PackingStationPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container?.textContent).toContain('Preorder #PRE-PACK-01');
    expect(container?.textContent).toContain('Hẹn lấy:');
    expect(container?.textContent).toContain('Túi vải Canvas');
  });

  it('filters out preorders whose packing task is completed or ready', async () => {
    vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/fulfillment/tasks')) {
        return {
          tasks: [
            {
              id: 101,
              order_id: 1,
              order_code: 'ORD-DONE-01',
              order_type: 'Take-away',
              branch_id: 1,
              store_name: 'Chi nhánh 1',
              lane: 'packing',
              status: 'ready', // already ready!
              preorder_code: 'PRE-DONE-01',
              preorder_scheduled_start_at: '2026-09-22T15:00:00.000Z',
              items: [{ id: 1, task_id: 101, product_name: 'Áo thun', quantity: 1 }],
            },
          ],
        };
      }
      if (url.startsWith('/admin/preorders/kitchen/confirmed')) {
        return [
          {
            id: 1,
            preorder_code: 'PRE-DONE-01',
            scheduled_start_at: '2026-09-22T15:00:00.000Z',
            store_name: 'Chi nhánh 1',
            customer_name: 'Khách hàng B',
          },
        ];
      }
      return [];
    });

    await act(async () => {
      root?.render(<PackingStationPage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Should NOT show preview banner because the only preorder task is already ready
    expect(container?.textContent).not.toContain('Preorder sắp tới (Đóng gói)');
  });
});
