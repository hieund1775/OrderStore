import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PublicReviewHub } from '@/components/reviews/PublicReviewHub';
import { ReviewModerationPanel } from '@/components/admin/reviews/ReviewModerationPanel';
import * as apiModule from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ isServer: false }),
}));

describe('Public Review Hub & Admin Moderation Contract', () => {
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
    vi.restoreAllMocks();
  });

  it('renders PublicReviewHub with masked customer names (e.g. H*** N**) and official reply', async () => {
    vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce({
      summary: {
        averageRating: 4.8,
        totalReviewCount: 120,
        distribution: { 5: 100, 4: 15, 3: 5, 2: 0, 1: 0 },
      },
      reviews: [
        {
          id: 1,
          rating: 5,
          comment: 'Trà rất thơm và nhiều trái cây tươi!',
          createdAt: new Date().toISOString(),
          user: { fullname: 'H*** N**' }, // masked
          product: { name: 'Trà Dâu Tằm', slug: 'tra-dau-tam' },
          source: 'normal',
          reply: {
            body: 'Cảm ơn quý khách đã ủng hộ tiệm!',
            createdAt: new Date().toISOString(),
          },
        },
      ],
      cursor: null,
      hasMore: false,
    });

    await act(async () => {
      root?.render(<PublicReviewHub />);
    });

    expect(container?.textContent).toContain('H*** N**');
    expect(container?.textContent).toContain('Trà rất thơm và nhiều trái cây tươi!');
    expect(container?.textContent).toContain('Phản hồi từ Trà Trái Cây Tô');
    expect(container?.textContent).toContain('Cảm ơn quý khách đã ủng hộ tiệm!');
    expect(container?.textContent).not.toContain('order_code');
    expect(container?.textContent).not.toContain('user_id');
  });

  it('renders ReviewModerationPanel and autoloads 15 reviews on mount', async () => {
    const apiGetSpy = vi.spyOn(apiModule, 'apiGet').mockResolvedValueOnce({
      items: [
        {
          id: 10,
          userId: 5,
          userFullname: 'Hoàng Nam',
          productName: 'Trà Đào Cam Sả',
          productSlug: 'tra-dao-cam-sa',
          sizeLabel: 'L',
          rating: 5,
          comment: 'Rất ngon!',
          visibilityStatus: 'visible',
          purchaseVerifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          orderCode: 'TP2609150001',
          reply: {
            id: 1,
            body: 'Cảm ơn bạn nhiều!',
            createdAt: new Date().toISOString(),
          },
        },
      ],
      cursor: null,
      hasMore: false,
    });

    await act(async () => {
      root?.render(<ReviewModerationPanel />);
    });

    // Check that backend API was called with limit=15
    expect(apiGetSpy).toHaveBeenCalled();
    const calledUrl = String(apiGetSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/admin/reviews');
    expect(calledUrl).toContain('limit=15');

    // Autoloaded item rendered
    expect(container?.textContent).toContain('Hoàng Nam');
    expect(container?.textContent).toContain('Trà Đào Cam Sả');
    expect(container?.textContent).toContain('Phản hồi từ cửa hàng');
  });

  it('applies whitespace-nowrap and min-w-16 to rating distribution percentage labels', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hubPath = path.resolve(process.cwd(), 'src/components/reviews/PublicReviewHub.tsx');
    const content = fs.readFileSync(hubPath, 'utf8');

    expect(content).toContain('whitespace-nowrap');
    expect(content).toContain('min-w-16');
    expect(content).toContain('md:grid-cols-[260px_1fr]');
  });
});
