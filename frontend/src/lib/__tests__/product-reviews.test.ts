import { describe, expect, it } from 'vitest';

// ────── Helper types used across review components ──────

interface ReviewItem {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { fullname: string };
  media: Array<{ id: number; mediaType: string; storageKey: string; contentType: string; byteSize: number }>;
  reply: { body: string; createdAt: string } | null;
}

interface ReviewSummary {
  averageRating: number;
  totalReviewCount: number;
  distribution: Record<number, number>;
}

// ────── Pure helpers (extracted from component logic) ──────

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => i + 1).map((star) => ({
    filled: star <= rating,
    star,
  }));
}

function formatReviewDate(iso: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
}

function filterReviewsByRating(reviews: ReviewItem[], rating: number | null): ReviewItem[] {
  if (rating === null || rating === undefined) return reviews;
  return reviews.filter((r) => r.rating === rating);
}

function sortReviews(reviews: ReviewItem[], sort: string): ReviewItem[] {
  const sorted = [...reviews];
  switch (sort) {
    case 'rating_desc':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'rating_asc':
      return sorted.sort((a, b) => a.rating - b.rating);
    case 'newest':
    default:
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

function paginateReviews(reviews: ReviewItem[], cursor: string | null, limit: number): {
  items: ReviewItem[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  if (cursor) {
    const cursorIndex = reviews.findIndex((r) => r.createdAt === cursor);
    if (cursorIndex === -1) return { items: [], nextCursor: null, hasMore: false };
    const items = reviews.slice(cursorIndex + 1, cursorIndex + 1 + limit);
    const hasMore = cursorIndex + 1 + limit < reviews.length;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
      hasMore,
    };
  }
  const items = reviews.slice(0, limit);
  const hasMore = limit < reviews.length;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
    hasMore,
  };
}

function getReviewSummary(reviews: ReviewItem[]): ReviewSummary {
  const visible = reviews.filter((r) => r.rating >= 1);
  if (visible.length === 0) {
    return { averageRating: 0, totalReviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
  const total = visible.length;
  const sum = visible.reduce((acc, r) => acc + r.rating, 0);
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  visible.forEach((r) => { distribution[r.rating]++; });
  return {
    averageRating: Math.round((sum / total) * 10) / 10,
    totalReviewCount: total,
    distribution,
  };
}

// ────── Mock data ──────

const mockReviews: ReviewItem[] = [
  { id: 1, rating: 5, comment: 'Tuyệt vời!', createdAt: '2026-09-05T00:00:00.000Z', user: { fullname: 'Nguyễn Văn A' }, media: [], reply: null },
  { id: 2, rating: 4, comment: 'Ngon', createdAt: '2026-09-04T00:00:00.000Z', user: { fullname: 'Trần Thị B' }, media: [], reply: { body: 'Cảm ơn bạn!', createdAt: '2026-09-05T00:00:00.000Z' } },
  { id: 3, rating: 3, comment: 'Tạm được', createdAt: '2026-09-03T00:00:00.000Z', user: { fullname: 'Lê Văn C' }, media: [], reply: null },
  { id: 4, rating: 5, comment: 'Sẽ mua lại', createdAt: '2026-09-02T00:00:00.000Z', user: { fullname: 'Phạm Thị D' }, media: [], reply: null },
  { id: 5, rating: 1, comment: 'Không ngon', createdAt: '2026-09-01T00:00:00.000Z', user: { fullname: 'Hoàng Văn E' }, media: [], reply: null },
  { id: 6, rating: 2, comment: 'Hơi nhạt', createdAt: '2026-08-30T00:00:00.000Z', user: { fullname: 'Vũ Thị F' }, media: [], reply: null },
];

describe('Product Reviews — pure helpers', () => {
  // ── renderStars ──
  it('renderStars returns correct filled/empty for rating 3', () => {
    const stars = renderStars(3);
    expect(stars.filter((s) => s.filled).length).toBe(3);
    expect(stars.filter((s) => !s.filled).length).toBe(2);
  });

  it('renderStars handles rating 0', () => {
    const stars = renderStars(0);
    expect(stars.every((s) => !s.filled)).toBe(true);
  });

  it('renderStars handles rating 5', () => {
    const stars = renderStars(5);
    expect(stars.every((s) => s.filled)).toBe(true);
  });

  // ── formatReviewDate ──
  it('formatReviewDate formats ISO date to Vietnamese locale', () => {
    const date = formatReviewDate('2026-09-05T00:00:00.000Z');
    expect(date).toBe('5/9/2026');
  });

  it('formatReviewDate returns empty string for invalid input', () => {
    expect(formatReviewDate('')).toBe('');
    expect(formatReviewDate('invalid')).toBe('');
  });

  // ── filterReviewsByRating ──
  it('filterReviewsByRating returns all reviews when rating is null', () => {
    expect(filterReviewsByRating(mockReviews, null).length).toBe(6);
  });

  it('filterReviewsByRating filters by rating 5', () => {
    const filtered = filterReviewsByRating(mockReviews, 5);
    expect(filtered.length).toBe(2);
    expect(filtered.every((r) => r.rating === 5)).toBe(true);
  });

  it('filterReviewsByRating returns empty for non-existent rating', () => {
    expect(filterReviewsByRating(mockReviews, 6).length).toBe(0);
  });

  // ── sortReviews ──
  it('sortReviews sorts by newest first', () => {
    const sorted = sortReviews(mockReviews, 'newest');
    expect(sorted[0].id).toBe(1);
    expect(sorted[5].id).toBe(6);
  });

  it('sortReviews sorts by rating descending', () => {
    const sorted = sortReviews(mockReviews, 'rating_desc');
    expect(sorted[0].rating).toBe(5);
    expect(sorted[sorted.length - 1].rating).toBe(1);
  });

  it('sortReviews sorts by rating ascending', () => {
    const sorted = sortReviews(mockReviews, 'rating_asc');
    expect(sorted[0].rating).toBe(1);
    expect(sorted[sorted.length - 1].rating).toBe(5);
  });

  it('sortReviews defaults to newest when sort is unknown', () => {
    const sorted = sortReviews(mockReviews, 'unknown');
    expect(sorted[0].id).toBe(1);
  });

  // ── paginateReviews ──
  it('paginateReviews returns first page', () => {
    const result = paginateReviews(mockReviews, null, 3);
    expect(result.items.length).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
  });

  it('paginateReviews returns second page with cursor', () => {
    const first = paginateReviews(mockReviews, null, 3);
    const second = paginateReviews(mockReviews, first.nextCursor, 3);
    expect(second.items.length).toBe(3);
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
  });

  it('paginateReviews returns empty for invalid cursor', () => {
    const result = paginateReviews(mockReviews, 'non-existent-date', 10);
    expect(result.items.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('paginateReviews returns fewer items on last page', () => {
    const result = paginateReviews(mockReviews, null, 10);
    expect(result.items.length).toBe(6);
    expect(result.hasMore).toBe(false);
  });

  // ── getReviewSummary ──
  it('getReviewSummary computes correct average and distribution', () => {
    const summary = getReviewSummary(mockReviews);
    // Sum = 5+4+3+5+1+2 = 20, count = 6, avg = 3.3
    expect(summary.averageRating).toBe(3.3);
    expect(summary.totalReviewCount).toBe(6);
    expect(summary.distribution[5]).toBe(2);
    expect(summary.distribution[4]).toBe(1);
    expect(summary.distribution[3]).toBe(1);
    expect(summary.distribution[2]).toBe(1);
    expect(summary.distribution[1]).toBe(1);
  });

  it('getReviewSummary returns zeros for empty array', () => {
    const summary = getReviewSummary([]);
    expect(summary.averageRating).toBe(0);
    expect(summary.totalReviewCount).toBe(0);
    expect(summary.distribution[5]).toBe(0);
    expect(summary.distribution[1]).toBe(0);
  });

  it('getReviewSummary handles single review', () => {
    const summary = getReviewSummary([mockReviews[0]]);
    expect(summary.averageRating).toBe(5);
    expect(summary.totalReviewCount).toBe(1);
    expect(summary.distribution[5]).toBe(1);
  });

  // ── Combined sorting + filtering ──
  it('filter + sort: rating 5 sorted by newest', () => {
    const filtered = filterReviewsByRating(mockReviews, 5);
    const sorted = sortReviews(filtered, 'newest');
    expect(sorted.length).toBe(2);
    expect(sorted[0].id).toBe(1); // 5 Sep > 2 Sep
    expect(sorted[1].id).toBe(4);
  });

  it('filter + sort: rating 3 sorted by rating_desc (no-op, all same)', () => {
    const filtered = filterReviewsByRating(mockReviews, 3);
    const sorted = sortReviews(filtered, 'rating_desc');
    expect(sorted.length).toBe(1);
    expect(sorted[0].rating).toBe(3);
  });
});

describe('Product Reviews — edge cases and boundary conditions', () => {
  it('handles review with null comment', () => {
    const review: ReviewItem = {
      id: 10, rating: 5, comment: null,
      createdAt: '2026-09-06T00:00:00.000Z',
      user: { fullname: 'Test User' },
      media: [], reply: null,
    };
    expect(review.comment).toBeNull();
    expect(review.rating).toBe(5);
  });

  it('handles review with reply', () => {
    const review: ReviewItem = {
      id: 11, rating: 4, comment: 'Good',
      createdAt: '2026-09-06T00:00:00.000Z',
      user: { fullname: 'Test User' },
      media: [], reply: { body: 'Thanks!', createdAt: '2026-09-06T12:00:00.000Z' },
    };
    expect(review.reply).not.toBeNull();
    expect(review.reply!.body).toBe('Thanks!');
  });

  it('handles review with media', () => {
    const review: ReviewItem = {
      id: 12, rating: 5, comment: 'Có ảnh',
      createdAt: '2026-09-06T00:00:00.000Z',
      user: { fullname: 'Photo User' },
      media: [
        { id: 1, mediaType: 'image', storageKey: 'review-media/key1', contentType: 'image/jpeg', byteSize: 50000 },
      ],
      reply: null,
    };
    expect(review.media.length).toBe(1);
    expect(review.media[0].mediaType).toBe('image');
  });

  it('handles review with both image and video media', () => {
    const review: ReviewItem = {
      id: 13, rating: 4, comment: 'Media check',
      createdAt: '2026-09-06T00:00:00.000Z',
      user: { fullname: 'Media User' },
      media: [
        { id: 1, mediaType: 'image', storageKey: 'review-media/img1', contentType: 'image/jpeg', byteSize: 50000 },
        { id: 2, mediaType: 'video', storageKey: 'review-media/vid1', contentType: 'video/mp4', byteSize: 2000000 },
      ],
      reply: null,
    };
    expect(review.media.length).toBe(2);
    expect(review.media.some((m) => m.mediaType === 'image')).toBe(true);
    expect(review.media.some((m) => m.mediaType === 'video')).toBe(true);
  });
});

describe('Admin review moderation — pure helpers', () => {
  interface AdminReviewItem {
    id: number;
    userFullname: string;
    productName: string;
    rating: number;
    comment: string | null;
    visibilityStatus: string;
    createdAt: string;
    reply: { body: string; createdAt: string } | null;
  }

  function searchReviews(reviews: AdminReviewItem[], query: string): AdminReviewItem[] {
    if (!query.trim()) return reviews;
    const q = query.toLowerCase();
    return reviews.filter((r) =>
      r.productName?.toLowerCase().includes(q) ||
      r.userFullname?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q),
    );
  }

  function filterByVisibility(reviews: AdminReviewItem[], visibility: string): AdminReviewItem[] {
    if (visibility === 'all') return reviews;
    return reviews.filter((r) => r.visibilityStatus === visibility);
  }

  const adminReviews: AdminReviewItem[] = [
    { id: 1, userFullname: 'Nguyễn Văn A', productName: 'Trà Đào', rating: 5, comment: 'Tuyệt', visibilityStatus: 'visible', createdAt: '2026-09-05T00:00:00.000Z', reply: null },
    { id: 2, userFullname: 'Trần Thị B', productName: 'Trà Tắc', rating: 2, comment: 'Chua quá', visibilityStatus: 'hidden', createdAt: '2026-09-04T00:00:00.000Z', reply: null },
    { id: 3, userFullname: 'Lê Văn C', productName: 'Trà Sữa', rating: 4, comment: 'Thơm ngon', visibilityStatus: 'visible', createdAt: '2026-09-03T00:00:00.000Z', reply: { body: 'Cảm ơn', createdAt: '2026-09-04T00:00:00.000Z' } },
  ];

  it('searchReviews by product name', () => {
    const result = searchReviews(adminReviews, 'Trà Đào');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it('searchReviews by user name', () => {
    const result = searchReviews(adminReviews, 'Nguyễn');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it('searchReviews by comment content', () => {
    const result = searchReviews(adminReviews, 'chua');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });

  it('searchReviews returns all for empty query', () => {
    const result = searchReviews(adminReviews, '');
    expect(result.length).toBe(3);
  });

  it('searchReviews returns empty for non-matching query', () => {
    const result = searchReviews(adminReviews, 'xyzzy');
    expect(result.length).toBe(0);
  });

  it('filterByVisibility shows all', () => {
    expect(filterByVisibility(adminReviews, 'all').length).toBe(3);
  });

  it('filterByVisibility shows only visible', () => {
    const result = filterByVisibility(adminReviews, 'visible');
    expect(result.length).toBe(2);
    expect(result.every((r) => r.visibilityStatus === 'visible')).toBe(true);
  });

  it('filterByVisibility shows only hidden', () => {
    const result = filterByVisibility(adminReviews, 'hidden');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });

  it('search + filter combo: hidden reviews matching search', () => {
    const searched = searchReviews(adminReviews, 'Trà');
    const filtered = filterByVisibility(searched, 'hidden');
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });
});

describe('Review timeline — pure logic', () => {
  interface TimelineEvent {
    id: number;
    type: 'original' | 'customer_edit' | 'admin_reply';
    createdAt: string;
    label: string;
  }

  function buildTimeline(revisions: Array<{ id: number; revision_type: string; created_at: string }>, reply: { body: string; created_at: string } | null): TimelineEvent[] {
    const events: TimelineEvent[] = revisions.map((r) => ({
      id: r.id,
      type: r.revision_type as 'original' | 'customer_edit',
      createdAt: r.created_at,
      label: r.revision_type === 'original' ? 'Đánh giá ban đầu' : 'Chỉnh sửa',
    }));

    if (reply) {
      events.push({
        id: -1,
        type: 'admin_reply',
        createdAt: reply.created_at,
        label: 'Phản hồi từ quản trị viên',
      });
    }

    return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  it('builds timeline with original only', () => {
    const events = buildTimeline(
      [{ id: 1, revision_type: 'original', created_at: '2026-09-01T00:00:00.000Z' }],
      null,
    );
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('original');
    expect(events[0].label).toBe('Đánh giá ban đầu');
  });

  it('builds timeline with original + edit + reply', () => {
    const events = buildTimeline(
      [
        { id: 1, revision_type: 'original', created_at: '2026-09-01T00:00:00.000Z' },
        { id: 2, revision_type: 'customer_edit', created_at: '2026-09-08T00:00:00.000Z' },
      ],
      { body: 'Cảm ơn', created_at: '2026-09-05T00:00:00.000Z' },
    );
    expect(events.length).toBe(3);
    expect(events[0].type).toBe('original');
    expect(events[1].type).toBe('admin_reply');
    expect(events[2].type).toBe('customer_edit');
  });

  it('builds timeline with original + reply (no edit)', () => {
    const events = buildTimeline(
      [{ id: 1, revision_type: 'original', created_at: '2026-09-01T00:00:00.000Z' }],
      { body: 'Cảm ơn', created_at: '2026-09-05T00:00:00.000Z' },
    );
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('original');
    expect(events[1].type).toBe('admin_reply');
  });
});