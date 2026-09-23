import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/api', () => ({
  fetchBranchOffers: vi.fn(),
  fetchCatalogCategories: vi.fn(),
  apiGet: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/components/admin/catalog/BranchOfferTable', () => ({
  BranchOfferTable: ({ offers }: { offers: Array<{ product_name: string }> }) => (
    <div data-testid="branch-offer-table">{offers.map((offer) => offer.product_name).join(', ')}</div>
  ),
}));

vi.mock('@/components/admin/AdminUI', () => ({
  AdminPagination: ({ totalItems }: { totalItems?: number }) => (
    <div data-testid="admin-pagination">Tổng {totalItems} SKU</div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

import { AdminHangDangBanPage } from '@/routes/admin.hang-dang-ban';
import * as api from '@/lib/api';

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe('Admin branch offers page', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    mockNavigate.mockClear();
    vi.clearAllMocks();

    vi.mocked(api.getUser).mockReturnValue({ role: 'super' } as any);
    vi.mocked(api.apiGet).mockResolvedValue([{ id: 1, name: 'Chi nhánh 1' }] as any);
    vi.mocked(api.fetchCatalogCategories).mockResolvedValue([] as any);
    vi.mocked(api.fetchBranchOffers).mockResolvedValue({
      items: [{ variant_id: 43, product_name: 'Cà Phê Sữa' }],
      pagination: { page: 1, limit: 20, totalItems: 21, totalPages: 2 },
    } as any);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
    reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('renders a non-empty API page and passes its total count to pagination without crashing', async () => {
    await act(async () => {
      root?.render(<AdminHangDangBanPage />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain('Cà Phê Sữa');
    expect(container.textContent).toContain('Tổng 21 SKU');
    expect(api.fetchBranchOffers).toHaveBeenCalledWith(expect.objectContaining({
      store_id: '1',
      page: 1,
      limit: 20,
    }));
  });
});
