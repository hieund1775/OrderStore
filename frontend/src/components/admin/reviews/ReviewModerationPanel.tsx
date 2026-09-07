import { useState } from 'react';
import { Star, Eye, EyeOff, MessageSquare, Reply, Search, Filter as FilterIcon } from 'lucide-react';
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
  DialogFooter,
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
import { apiGet, apiPost, apiPatch } from '@/lib/api';

interface ReviewItem {
  id: number;
  userId: number;
  userFullname: string;
  productName: string;
  productSlug: string;
  rating: number;
  comment: string | null;
  visibilityStatus: string;
  purchaseVerifiedAt: string | null;
  createdAt: string;
  reply: { id: number; body: string; createdAt: string } | null;
}

export function ReviewModerationPanel() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showHideDialog, setShowHideDialog] = useState<{ id: number; current: string } | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadReviews(reset = false) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '20' });
      if (storeFilter) params.set('store_id', storeFilter);
      if (visibilityFilter !== 'all') params.set('visibility', visibilityFilter);
      if (!reset && cursor) params.set('cursor', cursor);

      const data = await apiGet<{
        items: ReviewItem[];
        cursor: string | null;
        hasMore: boolean;
      }>(`/admin/reviews?${params}`);

      if (reset) {
        setReviews(data.items);
      } else {
        setReviews((prev) => [...prev, ...data.items]);
      }
      setCursor(data.cursor);
      setHasMore(data.hasMore);
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
      toast.success('Đã gửi phản hồi');
      setReplyText('');
      loadReviews(true);
    } catch (err) {
      toast.error('Không thể gửi phản hồi');
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
      loadReviews(true);
    } catch (err) {
      toast.error('Không thể thay đổi trạng thái');
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Tìm theo tên sản phẩm..."
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
        <Button variant="outline" size="sm" onClick={() => loadReviews(true)}>
          <FilterIcon className="mr-1 h-4 w-4" />
          Lọc
        </Button>
      </div>

      {/* Review List */}
      <div className="space-y-3">
        {reviews
          .filter((r) => !searchQuery || r.productName?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((review) => (
            <div
              key={review.id}
              className="rounded-lg border bg-white p-4 transition-colors hover:border-gray-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{review.userFullname}</span>
                    <Badge variant="secondary" className="text-xs">
                      {review.productName}
                    </Badge>
                    {review.visibilityStatus === 'hidden' && (
                      <Badge variant="outline" className="border-red-200 text-red-600">
                        <EyeOff className="mr-0.5 h-3 w-3" />
                        Đã ẩn
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {renderStars(review.rating)}
                    <span className="text-xs text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedReview(review);
                      setShowDetail(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHideDialog({ id: review.id, current: review.visibilityStatus })}
                  >
                    {review.visibilityStatus === 'hidden' ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}

        {loading && (
          <div className="py-8 text-center text-sm text-gray-400">Đang tải...</div>
        )}

        {!loading && reviews.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">Chưa có đánh giá nào</div>
        )}
      </div>

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => loadReviews(false)}>
            Xem thêm
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết đánh giá</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedReview.userFullname}</span>
                <Badge variant="secondary">{selectedReview.productName}</Badge>
              </div>
              {renderStars(selectedReview.rating)}
              {selectedReview.comment && (
                <p className="text-sm text-gray-700">{selectedReview.comment}</p>
              )}

              {/* Reply section */}
              {selectedReview.reply ? (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-blue-700">
                    <MessageSquare className="h-3 w-3" />
                    Đã phản hồi
                  </div>
                  <p className="mt-1 text-sm text-blue-900">{selectedReview.reply.body}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phản hồi</label>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập nội dung phản hồi..."
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleReply(selectedReview.id)}
                    disabled={submittingReply}
                  >
                    {submittingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hide/Unhide Dialog */}
      <AlertDialog open={!!showHideDialog} onOpenChange={() => setShowHideDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showHideDialog?.current === 'hidden' ? 'Hiện đánh giá' : 'Ẩn đánh giá'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showHideDialog?.current === 'hidden'
                ? 'Đánh giá sẽ hiển thị lại công khai.'
                : 'Đánh giá sẽ bị ẩn khỏi trang sản phẩm. Bạn có thể hiện lại sau.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {showHideDialog?.current !== 'hidden' && (
            <div className="py-2">
              <label className="mb-1 block text-sm font-medium">Lý do ẩn (không bắt buộc)</label>
              <Input
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                placeholder="VD: Spam, nội dung không phù hợp..."
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
              {showHideDialog?.current === 'hidden' ? 'Hiện' : 'Ẩn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}