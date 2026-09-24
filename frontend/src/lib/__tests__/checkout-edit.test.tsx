import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DynamicProductConfigurator } from '@/components/catalog/DynamicProductConfigurator';
import type { CartItem } from '@/lib/cart';

describe('Checkout Item Editing & Dynamic Configurator Contract', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
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
  });

  const mockInitialItem: CartItem = {
    key: 'item-tra-dau-1',
    productId: '1',
    productSlug: 'tra-dau-tam-pha-le',
    name: 'Trà Dâu Tằm Pha Lê',
    image: '/images/tra-dau.jpg',
    unitPrice: 45000,
    qty: 2,
    size: 'L',
    appliedModifiers: [
      {
        attribute_code: 'sugar',
        attribute_name: 'Mức Đường',
        value_code: '70_sugar',
        value_label: '70% Đường',
        price_adjustment: 0,
      },
      {
        attribute_code: 'ice',
        attribute_name: 'Mức Đá',
        value_code: 'da_rieng',
        value_label: 'Đá riêng',
        price_adjustment: 0,
      },
      {
        attribute_code: 'topping',
        attribute_name: 'Topping Thêm',
        value_code: 'nha_dam',
        value_label: 'Thạch nha đam',
        price_adjustment: 8000,
      },
    ],
  };

  it('renders edit mode with initialItem data without crashing', async () => {
    await act(async () => {
      root?.render(
        <DynamicProductConfigurator
          open={true}
          onOpenChange={vi.fn()}
          productSlug="tra-dau-tam-pha-le"
          mode="edit"
          initialItem={mockInitialItem}
          onUpdate={vi.fn()}
        />
      );
    });

    expect(container).toBeDefined();
  });

  it('renders buy mode correctly', async () => {
    await act(async () => {
      root?.render(
        <DynamicProductConfigurator
          open={true}
          onOpenChange={vi.fn()}
          productSlug="tra-dau-tam-pha-le"
          mode="buy"
          onBuyNow={vi.fn()}
        />
      );
    });

    expect(container).toBeDefined();
  });

  it('renders add mode as default', async () => {
    await act(async () => {
      root?.render(
        <DynamicProductConfigurator
          open={true}
          onOpenChange={vi.fn()}
          productSlug="tra-dau-tam-pha-le"
          onAddToCart={vi.fn()}
        />
      );
    });

    expect(container).toBeDefined();
  });

  describe('Option String Concatenation & Duplicate Prevention Contract', () => {
    it('verifies thanh-toan.tsx uses normalizers and avoids duplicate "Đường đường" or "Đá đá"', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const thanhToanPath = path.resolve(process.cwd(), 'src/routes/thanh-toan.tsx');
      const content = fs.readFileSync(thanhToanPath, 'utf8');

      // Ensure normalizers are imported
      expect(content).toContain('normalizeSugarLevel');
      expect(content).toContain('normalizeIceLevel');

      // Ensure bug pattern is completely eliminated
      expect(content).not.toContain('{i.sugar} đường');
      expect(content).not.toContain('{i.ice} đá');
      expect(content).not.toContain('{item.sugar} đường');
      expect(content).not.toContain('{item.ice} đá');
    });

    it('normalizes sugar and ice levels correctly without repeating words', async () => {
      const { normalizeSugarLevel, normalizeIceLevel } = await import('@/lib/data');

      expect(normalizeSugarLevel('100% Đường')).toBe('100% Đường');
      expect(normalizeSugarLevel('100% đường')).toBe('100% Đường');
      expect(normalizeSugarLevel('100%')).toBe('100% Đường');
      expect(normalizeSugarLevel('Không đường')).toBe('Không Đường');
      expect(normalizeSugarLevel('đường')).toBe('');
      expect(normalizeSugarLevel('')).toBe('');
      expect(normalizeSugarLevel(null)).toBe('');

      expect(normalizeIceLevel('100% Đá')).toBe('100% Đá');
      expect(normalizeIceLevel('100% đá')).toBe('100% Đá');
      expect(normalizeIceLevel('100%')).toBe('100% Đá');
      expect(normalizeIceLevel('Nóng')).toBe('Nóng');
      expect(normalizeIceLevel('Đá riêng')).toBe('Đá Riêng');
      expect(normalizeIceLevel('đá')).toBe('');
      expect(normalizeIceLevel('')).toBe('');
      expect(normalizeIceLevel(null)).toBe('');
    });
  });
});
