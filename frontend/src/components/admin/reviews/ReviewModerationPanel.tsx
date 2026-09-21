import { useState, useEffect, useRef } from 'react';
import { Star, Eye, EyeOff, MessageSquare, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost, apiPatch } from '@/lib/api';
import { fmtDateTime } from '@/lib/data';

interface ReviewItem {
  id: number;
  userId: number;
  userFullname: string;
  productName: string;
  productSlug: string;
  sizeLabel?: string | null;
  rating: number;
  comment: string | null;
  visibilityStatus: string;
  purchaseVerifiedAt: string | null;
  createdAt: string;
  orderCode?: string | null;
  reply: { id: number; body: string; createdAt?: string; created_at?: string } | null;
}

export interface ReviewModerationPanelProps {
  initialVisibility?: string;
  initialStoreId?: string;
  initialQuery?: string;
  onFilterChange?: (filters: { visibility: string; store_id: string; q: string }) => void;
}

export function ReviewModerationPanel({
  initialVisibility = 'all',
  initialStoreId = '',
  initialQuery = '',
  onFilterChange,
}: ReviewModerationPanelProps = {}) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState<string>(initialStoreId);
  const [visibilityFilter, setVisibilityFilter] = useState<string>(initialVisibility);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showHideDialog, setShowHideDialog] = useState<{ id: number; current: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isFilterFirstMount = useRef(true);
  useEffect(() => {
    if (isFilterFirstMount.current) {
      isFilterFirstMount.current = false;
      return;
    }
    onFilterChange?.({
      visibility: visibilityFilter,
      store_id: storeFilter,
      q: debouncedQuery,
    });
  }, [debouncedQuery, visibilityFilter, storeFilter, onFilterChange]);

  // Load reviews automatically on mount and whenever filters change
  useEffect(() => {
    void loadReviews(true);
  }, [debouncedQuery, visibilityFilter, storeFilter]);

  async function loadReviews(reset = false) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '15' });
      if (storeFilter) params.set('store_id', storeFilter);
      if (visibilityFilter !== 'all') params.set('visibility', visibilityFilter);
      if (debouncedQuery) params.set('query', debouncedQuery);
      if (!reset && cursor) params.set('cursor', cursor);

      const data = await apiGet<{
        items: ReviewItem[];
        cursor: string | null;
        hasMore: boolean;
      }>(`/admin/reviews?${params}`);

      if (reset) {
        setReviews(data.items || []);
      } else {
        setReviews((prev) => [...prev, ...(data.items || [])]);
      }
      setCursor(data.cursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      toast.error('Không thể tải danh sách đánh giá');
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(reviewId: number) {
    if (!replyText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi');
      return;
    }

    setSubmittingReply(true);
    try {
      await apiPost(`/admin/reviews/${reviewId}/reply`, { body: replyText.trim() });
      toast.success('Đã gửi phản hồi chính thức');
      setReplyText('');
      setShowDetail(false);
      void loadReviews(true);
    } catch (err) {
      toast.error('Không thể gửi phản hồi (có thể đã có phản hồi trước đó)');
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleToggleVisibility(reviewId: number, newVisibility: string) {
    try {
      await apiPatch(`/admin/reviews/${reviewId}/visibility`, {
        visibility: newVisibility,
        hidden_reason: newVisibility === 'hidden' ? hideReason : undefined,
      });
      toast.success(newVisibility === 'hidden' ? 'Đã ẩn đánh giá' : 'Đã hiện đánh giá');
      setShowHideDialog(null);
      setHideReason('');
      void loadReviews(true);
    } catch (err) {
      toast.error('Không thể thay đổi trạng thái hiển thị');
    }
  }

  async function handlePermanentDelete(reviewId: number) {
    try {
      await apiDelete(`/admin/reviews/${reviewId}`);
      toast.success('Đã xóa vĩnh viễn đánh giá và phản hồi liên quan');
      if (selectedReview?.id === reviewId) {
        setSelectedReview(null);
        setShowDetail(false);
      }
      setShowDeleteDialog(null);
      void loadReviews(true);
    } catch {
      toast.error('Không thể xóa vĩnh viễn đánh giá');
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã đơn (TP/PO/GRP), tên món, size, tên khách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="visible">Đang hiện</SelectItem>
            <SelectItem value="hidden">Đã ẩn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Review List */}
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{review.userFullname}</span>
                  <Badge variant="secondary" className="text-xs">
                    {review.productName}
                    {review.sizeLabel ? ` (Size ${review.sizeLabel})` : ''}
                  </Badge>
                  {review.orderCode && (
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      {review.orderCode}
                    </Badge>
                  )}
                  {review.visibilityStatus === 'hidden' && (
                    <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 text-[10px]">
                      <EyeOff className="mr-0.5 h-3 w-3 inline" />
                      Đã ẩn
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {review.comment && (
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {review.comment}
                  </p>
                )}

                {/* Reply display directly on card */}
                {review.reply && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1 mt-2">
                    <div className="flex items-center gap-1.5 font-bold text-primary">
                      <MessageSquare className="size-3.5" />
                      <span>Phản hồi từ cửa hàng</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({fmtDateTime(review.reply.createdAt || review.reply.created_at)})
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed whitespace-pre-line">
                      {review.reply.body}
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Xem chi tiết & Phản hồi"
                  onClick={() => {
                    setSelectedReview(review);
                    setReplyText('');
                    setShowDetail(true);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title={review.visibilityStatus === 'hidden' ? 'Hiện đánh giá' : 'Ẩn đánh giá'}
                  onClick={() => setShowHideDialog({ id: review.id, current: review.visibilityStatus })}
                >
                  {review.visibilityStatus === 'hidden' ? (
                    <Eye className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-rose-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Xóa vĩnh viễn đánh giá"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(review.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">Đang tải đánh giá...</div>
        )}

        {!loading && reviews.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Không tìm thấy đánh giá nào phù hợp.
          </div>
        )}
      </div>

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={() => void loadReviews(false)}>
            Xem thêm đánh giá cũ hơn
          </Button>
        </div>
      )}

      {/* Detail & Reply Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết đánh giá & Phản hồi</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{selectedReview.userFullname}</span>
                <Badge variant="secondary">{selectedReview.productName}</Badge>
                {selectedReview.sizeLabel && (
                  <Badge variant="outline">Size {selectedReview.sizeLabel}</Badge>
                )}
              </div>
              {renderStars(selectedReview.rating)}
              {selectedReview.comment && (
                <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg leading-relaxed whitespace-pre-line">
                  {selectedReview.comment}
                </p>
              )}

              {/* Reply section */}
              {selectedReview.reply ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Đã gửi phản hồi chính thức</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {selectedReview.reply.body}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-sm font-semibold">Phản hồi chính thức tới khách hàng</label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập nội dung phản hồi từ cửa hàng..."
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleReply(selectedReview.id)}
                    disabled={submittingReply}
                    className="rounded-xl"
                  >
                    {submittingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hide/Unhide Confirmation Dialog */}
      <AlertDialog open={!!showHideDialog} onOpenChange={() => setShowHideDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showHideDialog?.current === 'hidden' ? 'Hiện đánh giá' : 'Ẩn đánh giá'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showHideDialog?.current === 'hidden'
                ? 'Đánh giá này sẽ được hiển thị công khai trở lại trên Review Hub.'
                : 'Đánh giá sẽ bị ẩn khỏi trang Review Hub công khai. Bạn có thể hiện lại bất cứ lúc nào.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {showHideDialog?.current !== 'hidden' && (
            <div className="py-2">
              <label className="mb-1 block text-sm font-medium">Lý do ẩn (không bắt buộc)</label>
              <Input
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                placeholder="VD: Spam, từ ngữ không phù hợp..."
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                showHideDialog &&
                handleToggleVisibility(
                  showHideDialog.id,
                  showHideDialog.current === 'hidden' ? 'visible' : 'hidden',
                )
              }
            >
              {showHideDialog?.current === 'hidden' ? 'Xác nhận hiện' : 'Xác nhận ẩn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa vĩnh viễn đánh giá?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này không thể hoàn tác. Nội dung đánh giá, phản hồi của cửa hàng,
              lịch sử chỉnh sửa và media đính kèm sẽ bị xóa; điểm sao và số lượt đánh giá
              của đúng sản phẩm cũng được tính lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => showDeleteDialog !== null && handlePermanentDelete(showDeleteDialog)}
            >
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
