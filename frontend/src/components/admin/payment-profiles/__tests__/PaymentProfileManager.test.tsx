import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentProfileManager } from '../PaymentProfileManager';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  fetchPaymentProfiles: vi.fn(),
  fetchPublicCategoryTree: vi.fn(),
  createPaymentProfile: vi.fn(),
  updatePaymentProfile: vi.fn(),
  assignPaymentProfileToRoot: vi.fn(),
  unassignPaymentProfileFromRoot: vi.fn(),
}));

describe('PaymentProfileManager Super Admin Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const sampleProfiles: api.PaymentProfile[] = [
    {
      id: 1,
      code: 'NUOC_HIEU',
      display_name: 'Nước Uống - Hiếu',
      bank_name: 'MB Bank',
      bank_bin: '970422',
      account_number_masked: '******4321',
      account_holder: 'NGUYEN VAN HIEU',
      env_prefix: 'PAYOS_PROFILE_NUOC_HIEU',
      env_keys: {
        client_id: 'PAYOS_PROFILE_NUOC_HIEU_CLIENT_ID',
        api_key: 'PAYOS_PROFILE_NUOC_HIEU_API_KEY',
        checksum_key: 'PAYOS_PROFILE_NUOC_HIEU_CHECKSUM_KEY',
      },
      is_env_configured: false,
      status: 'pending',
      version: 1,
      assigned_categories: [{ category_id: 1, category_name: 'Nước Uống', category_slug: 'nuoc-uong' }],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 2,
      code: 'LONG_GROUPED_CHECKOUT',
      display_name: 'Long - Grouped Checkout & Hệ Thống Chung',
      bank_name: 'Vietcombank',
      bank_bin: '970436',
      account_number_masked: '******8888',
      account_holder: 'NGUYEN VAN LONG',
      env_prefix: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT',
      env_keys: {
        client_id: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT_CLIENT_ID',
        api_key: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT_API_KEY',
        checksum_key: 'PAYOS_PROFILE_LONG_GROUPED_CHECKOUT_CHECKSUM_KEY',
      },
      is_env_configured: true,
      status: 'active',
      version: 1,
      assigned_categories: [],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ];

  it('renders payment profile list with masked accounts, versions, and no raw secrets', async () => {
    vi.mocked(api.fetchPaymentProfiles).mockResolvedValue({ profiles: sampleProfiles });
    vi.mocked(api.fetchPublicCategoryTree).mockResolvedValue([
      { id: 1, name: 'Nước Uống', slug: 'nuoc-uong', depth: 0, parent_id: null, sort_order: 1, children: [] },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PaymentProfileManager />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain('Nước Uống - Hiếu');
    expect(container.textContent).toContain('NUOC_HIEU');
    expect(container.textContent).toContain('MB Bank • ******4321');
    expect(container.textContent).toContain('v1');
    expect(container.textContent).toContain('PAYOS_PROFILE_NUOC_HIEU_CLIENT_ID');
    expect(container.textContent).toContain('PAYOS_PROFILE_NUOC_HIEU_API_KEY');
    expect(container.textContent).toContain('PAYOS_PROFILE_NUOC_HIEU_CHECKSUM_KEY');
    expect(container.textContent).toContain('Long - Grouped Checkout');

    // Confirm that secret input fields are not rendered
    const inputs = container.querySelectorAll('input');
    for (const input of inputs) {
      expect(input.placeholder).not.toMatch(/API Key/i);
      expect(input.placeholder).not.toMatch(/Checksum/i);
    }
  });
});
