import { useState, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Star, MessageSquare, ThumbsUp, ShoppingBag, Calendar, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';

export interface PublicReviewHubItem {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    fullname: string;
  };
  product: {
    name: string;
    slug: string;
  };
  source: 'normal' | 'preorder';
  media?: Array<{
    id?: number;
    url: string;
    type: 'image' | 'video';
  }>;
  reply?: {
    body: string;
    createdAt: string;
  } | null;
}

export interface PublicReviewHubSummary {
  averageRating: number;
  totalReviewCount: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface PublicReviewHubResponse {
  summary: PublicReviewHubSummary;
  reviews: PublicReviewHubItem[];
  cursor: string | null;
  hasMore: boolean;
}

type SourceTab = 'all' | 'normal' | 'preorder';

export function PublicReviewHub({
  initialSource = 'all',
  lockSource = false,
}: {
  initialSource?: SourceTab;
  lockSource?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<SourceTab>(initialSource);
  const [reviews, setReviews] = useState<PublicReviewHubItem[]>([]);
  const [summary, setSummary] = useState<PublicReviewHubSummary | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchReviews = async (tab: SourceTab, nextCursor: string | null = null, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingInitial(true);
      setError(null);
    }

    try {
      let url = `/api/reviews?source=${encodeURIComponent(tab)}&limit=15`;
      if (nextCursor) {
        url += `&cursor=${encodeURIComponent(nextCursor)}`;
      }

      const res = await apiGet<PublicReviewHubResponse>(url, {
        signal: abortControllerRef.current.signal,
      });

      if (append) {
        setReviews((prev) => [...prev, ...(res.reviews || [])]);
      } else {
        setReviews(res.reviews || []);
        setSummary(res.summary || null);
      }
      setCursor(res.cursor || null);
      setHasMore(Boolean(res.hasMore));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Không thể tải đánh giá lúc này.');
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setActiveTab(initialSource);
  }, [initialSource]);

  useEffect(() => {
    setReviews([]);
    setCursor(null);
    setHasMore(false);
    void fetchReviews(activeTab, null, false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeTab]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const totalReviews = summary?.totalReviewCount || 0;
  const avgRating = summary ? (summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '5.0') : '5.0';

  return (
    <div className="space-y-8">
      {/* Summary Header */}
      <div className="rounded-3xl border bg-card/80 backdrop-blur p-6 sm:p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10 items-center">
          {/* Left Column: Big rating number */}
          <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-border/60 pb-6 md:pb-0 md:pr-8">
            <span className="font-display text-5xl sm:text-6xl font-extrabold text-foreground tracking-tight">
              {avgRating}
            </span>
            <div className="flex items-center gap-1 mt-2 text-primary">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`size-4 sm:size-5 ${
                    summary && s <= Math.round(summary.averageRating)
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-xs mt-2">
              Dựa trên <span className="font-semibold text-foreground">{totalReviews.toLocaleString('vi-VN')}</span> đánh giá từ khách hàng đã mua
            </p>
          </div>

          {/* Right Column: Star distribution bars */}
          <div className="space-y-2 max-w-md">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary?.distribution?.[star as keyof typeof summary.distribution] || 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-10 shrink-0 font-medium">
                    <span>{star}</span>
                    <Star className="size-3 fill-primary text-primary" />
                  </div>
                  <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-muted-foreground font-mono text-[11px]">
                    {pct}% ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        {!lockSource ? <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-2xl border">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('normal')}
            className={`rounded-xl px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'normal'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đơn thường
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preorder')}
            className={`rounded-xl px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'preorder'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Đơn đặt trước
          </button>
        </div> : <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
          Đánh giá đơn đặt trước
        </Badge>}

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="size-4 text-leaf" />
          <span>100% đánh giá từ khách hàng đã nhận món</span>
        </div>
      </div>

      {/* Reviews List */}
      {loadingInitial ? (
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
              <div className="h-3 bg-muted rounded w-48" />
              <div className="h-12 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
          <AlertCircle className="size-8 text-destructive mx-auto" />
          <p className="text-sm text-foreground font-semibold">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchReviews(activeTab, null, false)}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw className="size-3.5" />
            <span>Thử lại</span>
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <MessageSquare className="size-10 text-muted-foreground/40 mx-auto" />
          <h3 className="font-display font-bold text-base text-foreground">
            Chưa có đánh giá nào cho bộ lọc này
          </h3>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto">
            Các đánh giá từ khách hàng sau khi hoàn tất đơn hàng sẽ được hiển thị công khai tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <article
              key={rev.id}
              className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4 transition-all hover:shadow-card-soft"
            >
              {/* Header: Customer name (masked) · Product name · Order type badge */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Tên */}
                    <span className="font-semibold text-sm text-foreground">
                      {rev.user?.fullname || 'Khách hàng'}
                    </span>

                    {/* 2. Tên sản phẩm */}
                    {rev.product && (
                      <>
                        <span className="text-muted-foreground/40 text-xs select-none">|</span>
                        <Link
                          to="/menu"
                          className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline max-w-[240px] truncate"
                          title={rev.product.name}
                        >
                          <ShoppingBag className="size-3 shrink-0 text-primary" />
                          <span className="truncate">{rev.product.name}</span>
                        </Link>
                      </>
                    )}

                    {/* 3. Loại đơn */}
                    <span className="text-muted-foreground/40 text-xs select-none">|</span>
                    {rev.source === 'preorder' ? (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] py-0 px-2 font-normal">
                        Đơn đặt trước
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] py-0 px-2 font-normal">
                        Đơn thường
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-0.5 text-primary">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`size-3.5 ${
                            s <= rev.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDate(rev.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comment Content */}
              {rev.comment && (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {rev.comment}
                </p>
              )}

              {/* Attached Media */}
              {Array.isArray(rev.media) && rev.media.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {rev.media.map((m, idx) => (
                    <div
                      key={idx}
                      className="size-20 rounded-xl overflow-hidden border bg-muted/30"
                    >
                      {m.type === 'video' ? (
                        <video src={m.url} controls className="size-full object-cover" />
                      ) : (
                        <img
                          src={m.url}
                          alt="Đánh giá từ khách"
                          loading="lazy"
                          className="size-full object-cover hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Official Admin Reply */}
              {rev.reply && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-primary">
                      <span className="size-2 rounded-full bg-primary" />
                      <span>Phản hồi từ Trà Trái Cây Tô</span>
                    </div>
                    {rev.reply.createdAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(rev.reply.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground leading-relaxed whitespace-pre-line">
                    {rev.reply.body}
                  </p>
                </div>
              )}
            </article>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center pt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void fetchReviews(activeTab, cursor, true)}
                className="rounded-2xl px-6 h-10 gap-2 border-border hover:bg-muted/40"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Đang tải thêm…</span>
                  </>
                ) : (
                  <span>Xem thêm đánh giá</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
