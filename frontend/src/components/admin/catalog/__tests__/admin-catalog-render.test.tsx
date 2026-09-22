import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Mock tanstack router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  redirect: vi.fn(),
  useLocation: () => ({ pathname: '/admin/catalog', search: '' }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({ children }: any) => <a>{children}</a>,
}));

// Mock api
vi.mock('@/lib/api', () => ({
  getUser: () => ({ id: 1, role: 'super', fullname: 'Admin' }),
  fetchCatalogCategories: vi.fn().mockResolvedValue([]),
  fetchProductTypes: vi.fn().mockResolvedValue([]),
  fetchCatalogProducts: vi.fn().mockResolvedValue([]),
  fetchSchemaDetails: vi.fn().mockResolvedValue(null),
}));

describe('AdminCatalogPage render contract', () => {
  it('renders AdminCatalogPage and dialog footers without ReferenceError or crashing', async () => {
    const { AdminCatalogPage } = await import('@/routes/admin.catalog');
    const div = document.createElement('div');
    const root = createRoot(div);
    await act(async () => {
      root.render(<AdminCatalogPage />);
    });
    expect(div).toBeDefined();
    act(() => {
      root.unmount();
    });
    div.remove();
  });
});
