import { useState, useEffect } from 'react';
import { Star, MessageSquare, Image, ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewTimeline } from './ReviewTimeline';

interface ReviewUser {
  fullname: string;
}

interface ReviewMedia {
  id: number;
  mediaType: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
}

interface ReviewReply {
  body: string;
  createdAt: string;
}

interface ReviewItem {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: ReviewUser;
  media: ReviewMedia[];
  reply: ReviewReply | null;
}

interface ReviewSummary {
  averageRating: number;
  totalReviewCount: number;
  distribution: Record<number, number>;
}

interface ProductReviewsProps {
  productId: number;
  apiGet: <T>(path: string) => Promise<T>;
}

export function ProductReviews({ productId, apiGet }: ProductReviewsProps) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<string>('newest');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadReviews(true);
  }, [productId, sort, ratingFilter]);

  async function loadReviews(reset = false) {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sort,
        limit: '10',
      });
      if (ratingFilter) params.set('rating', String(ratingFilter));
      if (!reset && cursor) params.set('cursor', cursor);

      const data = await apiGet<{
        summary: ReviewSummary;
        reviews: ReviewItem[];
        cursor: string | null;
        hasMore: boolean;
      }>(`/api/products/${productId}/reviews?${params}`);

      if (reset) {
        setSummary(data.summary);
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError('Không thể tải đánh giá');
    } finally {
      setLoading(false);
    }
  }

  function handleRatingFilter(rating: number | null) {
    setRatingFilter(rating);
    setCursor(null);
  }

  function handleSort(value: string) {
    setSort(value);
    setCursor(null);
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && summary.totalReviewCount > 0 && (
        <div className="rounded-lg border bg-white p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900">
                {summary.averageRating.toFixed(1)}
              </div>
              <div className="mt-1 flex justify-center">
                {renderStars(Math.round(summary.averageRating))}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {summary.totalReviewCount} đánh giá
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[star] || 0;
                const pct = summary.totalReviewCount > 0
                  ? (count / summary.totalReviewCount) * 100
                  : 0;
                return (
                  <button
                    key={star}
                    onClick={() => handleRatingFilter(ratingFilter === star ? null : star)}
                    className={`flex w-full items-center gap-2 text-sm transition-colors hover:opacity-80 ${
                      ratingFilter === star ? 'font-semibold text-amber-600' : 'text-gray-600'
                    }`}
                  >
                    <span className="w-8 text-right">{star}</span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-gray-400">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* No reviews yet */}
      {summary && summary.totalReviewCount === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-400">
          <MessageSquare className="mx-auto mb-2 h-8 w-8" />
          <p>Chưa có đánh giá nào cho sản phẩm này</p>
        </div>
      )}

      {/* Sort & Filter Controls */}
      {summary && summary.totalReviewCount > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[null, 5, 4, 3, 2, 1].map((star) => (
              <Button
                key={String(star)}
                variant={ratingFilter === star ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRatingFilter(star)}
                className="h-8 px-2 text-xs"
              >
                {star ? <><Star className="mr-0.5 h-3 w-3" />{star}</> : 'Tất cả'}
              </Button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => handleSort(e.target.value)}
            className="h-8 rounded-md border border-gray-200 px-2 text-xs"
          >
            <option value="newest">Mới nhất</option>
            <option value="rating_desc">Điểm cao nhất</option>
            <option value="rating_asc">Điểm thấp nhất</option>
          </select>
        </div>
      )}

      {/* Review List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {review.user.fullname}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Đã mua hàng
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {renderStars(review.rating)}
                  <span className="text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>

            {review.comment && (
              <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
            )}

            {review.media && review.media.length > 0 && (
              <div className="mt-2 flex gap-2">
                {review.media.map((m) => (
                  <div
                    key={m.id}
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-50"
                  >
                    {m.mediaType === 'image' ? (
                      <Image className="h-6 w-6 text-gray-400" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
                        Video
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {review.reply && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3">
                <div className="flex items-center gap-1 text-xs font-medium text-blue-700">
                  <MessageSquare className="h-3 w-3" />
                  Phản hồi từ cửa hàng
                </div>
                <p className="mt-1 text-sm text-blue-900">{review.reply.body}</p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-white p-4">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="mb-2 h-3 w-48" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => loadReviews(false)}
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            Xem thêm đánh giá
          </Button>
        </div>
      )}
    </div>
  );
}