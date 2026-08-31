import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CategoryMenu } from '../CategoryMenu';
import { MegaMenu } from '../MegaMenu';
import { MegaMenuGroup } from '../MegaMenuGroup';
import { SimpleCategoryDropdown } from '../SimpleCategoryDropdown';
import { MobileCategoryMenu } from '../MobileCategoryMenu';
import type { PublicCategoryNode } from '@/lib/api';

// Mock tanstack router Link
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
    search?: (prev: Record<string, unknown>) => Record<string, unknown>;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
  }) => {
    const computedSearch = typeof search === 'function' ? search({}) : search;
    const searchParam = computedSearch?.category ? `?category=${computedSearch.category}` : '';
    return (
      <a
        href={`${to}${searchParam}`}
        onClick={onClick}
        className={className}
        data-testid="router-link"
        {...props}
      >
        {children}
      </a>
    );
  },
  useRouterState: () => ({ location: { pathname: '/menu', search: {} } }),
}));

describe('Category Navigation Components & Adaptive Mega Menu Suite', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const smallDataset: PublicCategoryNode[] = [
    {
      id: 1,
      name: 'Nước Giải Khát',
      slug: 'nuoc-giai-khat',
      parent_id: null,
      depth: 0,
      sort_order: 1,
      children: [
        { id: 11, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
      ],
    },
    {
      id: 2,
      name: 'Trái Cây Tô',
      slug: 'trai-cay-to',
      parent_id: null,
      depth: 0,
      sort_order: 2,
      children: [],
    },
  ];

  const richDataset: PublicCategoryNode[] = [
    {
      id: 1,
      name: 'Nước Uống',
      slug: 'nuoc-uong',
      parent_id: null,
      depth: 0,
      sort_order: 1,
      children: [
        { id: 11, name: 'Trà sữa', slug: 'tra-sua', parent_id: 1, depth: 1, sort_order: 1 },
        { id: 12, name: 'Cà phê', slug: 'ca-phe', parent_id: 1, depth: 1, sort_order: 2 },
        { id: 13, name: 'Nước ép', slug: 'nuoc-ep', parent_id: 1, depth: 1, sort_order: 3 },
      ],
    },
    {
      id: 2,
      name: 'Đồ Ăn',
      slug: 'do-an',
      parent_id: null,
      depth: 0,
      sort_order: 2,
      children: [
        { id: 21, name: 'Trái cây tô', slug: 'trai-cay-to', parent_id: 2, depth: 1, sort_order: 1 },
        { id: 22, name: 'Ăn vặt', slug: 'an-vat', parent_id: 2, depth: 1, sort_order: 2 },
        { id: 23, name: 'Bánh', slug: 'banh', parent_id: 2, depth: 1, sort_order: 3 },
      ],
    },
    {
      id: 3,
      name: 'Thời Trang',
      slug: 'thoi-trang',
      parent_id: null,
      depth: 0,
      sort_order: 3,
      children: [
        { id: 31, name: 'Áo', slug: 'ao', parent_id: 3, depth: 1, sort_order: 1 },
        { id: 32, name: 'Quần', slug: 'quan', parent_id: 3, depth: 1, sort_order: 2 },
        { id: 33, name: 'Phụ kiện', slug: 'phu-kien', parent_id: 3, depth: 1, sort_order: 3 },
      ],
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe('Desktop CategoryMenu Adaptive Layout', () => {
    it('renders SimpleCategoryDropdown when dataset is small (< 3 roots)', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={smallDataset} />);
      });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-expanded')).toBe('false');

      // Click to open
      act(() => {
        button?.click();
      });

      expect(button?.getAttribute('aria-expanded')).toBe('true');
      const menu = container.querySelector('#category-desktop-menu');
      expect(menu).not.toBeNull();

      // Simple dropdown should render "Tất cả sản phẩm" and the 2 roots, but NO subcategory links
      expect(container.textContent).toContain('Tất cả sản phẩm');
      expect(container.textContent).toContain('Nước Giải Khát');
      expect(container.textContent).toContain('Trái Cây Tô');
      expect(container.textContent).not.toContain('Trà sữa'); // subcategory not shown in simple dropdown
    });

    it('renders MegaMenu when dataset is rich (>= 3 roots with children)', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={richDataset} />);
      });

      const button = container.querySelector('button');
      act(() => {
        button?.click();
      });

      const megaRegion = container.querySelector('[role="region"][aria-label="Mega menu danh mục sản phẩm"]');
      expect(megaRegion).not.toBeNull();

      // Mega menu renders all root headings AND their subcategories
      expect(container.textContent).toContain('Nước Uống');
      expect(container.textContent).toContain('Trà sữa');
      expect(container.textContent).toContain('Cà phê');
      expect(container.textContent).toContain('Đồ Ăn');
      expect(container.textContent).toContain('Trái cây tô');
      expect(container.textContent).toContain('Thời Trang');
      expect(container.textContent).toContain('Áo');
    });

    it('does NOT contain folder icons, emoji icons, or bullet points in MegaMenu', () => {
      act(() => {
        root.render(<MegaMenu categoryTree={richDataset} />);
      });

      const text = container.textContent || '';
      expect(text).not.toContain('📁');
      expect(text).not.toContain('🌐');
      expect(text).not.toContain('•');
    });
  });

  describe('Desktop Hover and Interaction State', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens menu on mouseEnter and delays close on mouseLeave', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={richDataset} />);
      });

      const menuWrapper = container.firstElementChild as HTMLElement;

      // Mouse enter opens immediately
      act(() => {
        menuWrapper.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        menuWrapper.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        menuWrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
      });
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      // Mouse leave starts close delay timer
      act(() => {
        menuWrapper.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        menuWrapper.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        menuWrapper.dispatchEvent(new Event('pointerleave', { bubbles: true }));
      });
      // Still open immediately after mouseleave before timeout
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      // Advance by 100ms: still open
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      // Advance past 180ms: now closed
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelector('#category-desktop-menu')).toBeNull();
    });

    it('cancels close timer when mouse re-enters before timeout expires', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={richDataset} />);
      });

      const menuWrapper = container.firstElementChild as HTMLElement;

      act(() => {
        menuWrapper.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        menuWrapper.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        menuWrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
      });
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      act(() => {
        menuWrapper.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        menuWrapper.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        menuWrapper.dispatchEvent(new Event('pointerleave', { bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Mouse re-enters before 180ms
      act(() => {
        menuWrapper.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        menuWrapper.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        menuWrapper.dispatchEvent(new Event('pointerenter', { bubbles: true }));
      });

      // Advance past the original timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });
      // Menu should stay open because close was cancelled
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();
    });

    it('closes menu when Escape key is pressed', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={richDataset} />);
      });

      const button = container.querySelector('button');
      act(() => {
        button?.click();
      });
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      // Press Escape
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(container.querySelector('#category-desktop-menu')).toBeNull();
    });

    it('closes menu when clicking outside', () => {
      act(() => {
        root.render(<CategoryMenu categoryTree={richDataset} />);
      });

      const button = container.querySelector('button');
      act(() => {
        button?.click();
      });
      expect(container.querySelector('#category-desktop-menu')).not.toBeNull();

      // Click outside
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(container.querySelector('#category-desktop-menu')).toBeNull();
    });
  });

  describe('MobileCategoryMenu Accordion & Interaction', () => {
    it('renders "Tất cả sản phẩm" at the top without icons', () => {
      act(() => {
        root.render(<MobileCategoryMenu categoryTree={richDataset} />);
      });

      const firstLink = container.querySelector('a');
      expect(firstLink?.textContent).toContain('Tất cả sản phẩm');
      expect(firstLink?.textContent).not.toContain('🌐');
    });

    it('splits root row into title navigation and separate accordion chevron toggle', () => {
      const handleNavigate = vi.fn();
      act(() => {
        root.render(
          <MobileCategoryMenu
            categoryTree={richDataset}
            onNavigate={handleNavigate}
          />
        );
      });

      // Find root category with children (e.g. Nước Uống)
      const rootLink = Array.from(container.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Nước Uống'
      );
      expect(rootLink).toBeDefined();

      // Clicking root link navigates
      act(() => {
        rootLink?.click();
      });
      expect(handleNavigate).toHaveBeenCalledTimes(1);

      // Find accordion toggle button
      const chevronButton = container.querySelector(
        'button[aria-label="Mở rộng danh mục Nước Uống"]'
      ) as HTMLButtonElement;
      expect(chevronButton).not.toBeNull();
      expect(chevronButton.getAttribute('aria-expanded')).toBe('false');

      // Clicking chevron toggle does NOT trigger navigate, but expands subcategories
      handleNavigate.mockClear();
      act(() => {
        chevronButton.click();
      });
      expect(handleNavigate).not.toHaveBeenCalled();
      expect(chevronButton.getAttribute('aria-expanded')).toBe('true');
      expect(container.textContent).toContain('Trà sữa');
      expect(container.textContent).toContain('Cà phê');
    });

    it('does NOT render a chevron button for root categories without children', () => {
      const datasetWithEmptyRoot: PublicCategoryNode[] = [
        {
          id: 99,
          name: 'Danh Mục Trống',
          slug: 'danh-muc-trong',
          parent_id: null,
          depth: 0,
          sort_order: 1,
          children: [],
        },
      ];

      act(() => {
        root.render(<MobileCategoryMenu categoryTree={datasetWithEmptyRoot} />);
      });

      const chevronButton = container.querySelector('button[aria-label^="Mở rộng danh mục"]');
      expect(chevronButton).toBeNull();
    });
  });

  describe('Active Category State Synchronization', () => {
    it('highlights "Tất cả sản phẩm" when no currentCategorySlug is active', () => {
      act(() => {
        root.render(<SimpleCategoryDropdown categoryTree={smallDataset} currentCategorySlug={undefined} />);
      });

      const allProductsLink = container.querySelector('a');
      expect(allProductsLink?.className).toContain('text-primary');
    });

    it('highlights active root category and active subcategory properly in MegaMenuGroup', () => {
      const rootNode = richDataset[0];
      act(() => {
        root.render(
          <MegaMenuGroup
            root={rootNode}
            subcategories={rootNode.children || []}
            currentCategorySlug="tra-sua"
          />
        );
      });

      // Root heading is highlighted because its child "tra-sua" is active
      const rootLink = container.querySelector('a');
      expect(rootLink?.className).toContain('text-primary');

      // Active subcategory "tra-sua" is specifically highlighted
      const links = Array.from(container.querySelectorAll('a'));
      const activeChild = links.find((l) => l.textContent?.trim() === 'Trà sữa');
      const inactiveChild = links.find((l) => l.textContent?.trim() === 'Cà phê');

      expect(activeChild?.className).toContain('bg-primary/10');
      expect(inactiveChild?.className).not.toContain('bg-primary/10');
    });
  });
});
