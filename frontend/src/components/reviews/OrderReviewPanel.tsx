import { useEffect, useRef, useState, useCallback } from 'react';
import { Star, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';
import { apiGet, apiPost, getCustomerToken } from '@/lib/api';
import { toast } from 'sonner';

export interface ReviewableItem {
  orderItemId: number;
  productId: number;
  name: string;
}

export interface OrderReviewPanelProps {
  orderCode: string;
  items: ReviewableItem[];
  canReview?: boolean;
  onReviewSubmitted?: (orderItemId: number) => void;
  className?: string;
}

interface ItemState {
  loading: boolean;
  eligible: boolean;
  reason?: string;
  hasReviewed: boolean;
  rating?: number;
  error?: string;
}

export function OrderReviewPanel({
  orderCode,
  items,
  canReview = true,
  onReviewSubmitted,
  className = '',
}: OrderReviewPanelProps) {
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({});
  const inFlightRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    orderItemId: number;
    productId: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkItemEligibility = useCallback(
    async (orderItemId: number) => {
      if (inFlightRef.current.has(orderItemId)) return;
      inFlightRef.current.add(orderItemId);

      setItemStates((prev) => ({
        ...prev,
        [orderItemId]: {
          loading: true,
          eligible: false,
          hasReviewed: false,
        },
      }));

      try {
        const token = getCustomerToken();
        if (!token) {
          if (!isMountedRef.current) return;
          setItemStates((prev) => ({
            ...prev,
            [orderItemId]: {
              loading: false,
              eligible: false,
              hasReviewed: false,
              reason: 'Chưa đăng nhập',
            },
          }));
          return;
        }

        const res = await apiGet<{
          eligible: boolean;
          reason?: string;
          review?: { current_rating?: number; rating?: number };
        }>(`/api/orders/${encodeURIComponent(orderCode)}/items/${orderItemId}/review`);

        if (!isMountedRef.current) return;

        if (res && res.eligible) {
          setItemStates((prev) => ({
            ...prev,
            [orderItemId]: {
              loading: false,
              eligible: true,
              hasReviewed: false,
            },
          }));
        } else {
          const hasReviewed = Boolean(
            res?.review || (res?.reason && res.reason.includes('đã đánh giá')),
          );
          const rating = res?.review?.current_rating || res?.review?.rating;
          setItemStates((prev) => ({
            ...prev,
            [orderItemId]: {
              loading: false,
              eligible: false,
              hasReviewed,
              rating,
              reason: res?.reason,
            },
          }));
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setItemStates((prev) => ({
          ...prev,
          [orderItemId]: {
            loading: false,
            eligible: false,
            hasReviewed: false,
            error: err?.message || 'Lỗi kiểm tra đánh giá',
          },
        }));
      } finally {
        inFlightRef.current.delete(orderItemId);
      }
    },
    [orderCode],
  );

  useEffect(() => {
    if (!canReview) return;
    const token = getCustomerToken();
    if (!token) return;

    items.forEach((item) => {
      if (item.orderItemId && !itemStates[item.orderItemId]) {
        void checkItemEligibility(item.orderItemId);
      }
    });
  }, [canReview, items, checkItemEligibility, itemStates]);

  if (!canReview || items.length === 0) {
    return null;
  }

  return (
    <Card className={`overflow-hidden border-leaf/30 shadow-soft bg-leaf/5 ${className}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Star className="size-5 fill-amber-400 text-amber-500" />
          <h3 className="font-display font-bold text-base text-foreground">
            Đánh giá món đã đặt
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Chia sẻ trải nghiệm của bạn để quán nâng cao chất lượng món ăn và phục vụ.
        </p>

        <div className="space-y-3">
          {items.map((item) => {
            const state = itemStates[item.orderItemId];
            const isLoading = state?.loading;
            const hasReviewed = state?.hasReviewed;
            const isEligible = state?.eligible;

            return (
              <div
                key={item.orderItemId}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 p-3 text-sm shadow-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {hasReviewed && (
                    <p className="flex items-center gap-1 text-xs text-leaf font-medium">
                      <CheckCircle className="size-3.5" />
                      Đã đánh giá {state.rating ? `(${state.rating}★)` : ''}
                    </p>
                  )}
                  {state?.error && (
                    <p className="text-xs text-destructive">{state.error}</p>
                  )}
                </div>

                <div>
                  {isLoading ? (
                    <Button variant="ghost" size="sm" disabled className="h-8 px-2 text-xs">
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      Đang tải...
                    </Button>
                  ) : hasReviewed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="h-8 px-2.5 text-xs text-muted-foreground border-leaf/30 bg-leaf/10"
                    >
                      Đã đánh giá
                    </Button>
                  ) : isEligible ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs text-amber-600 border-amber-500/40 hover:bg-amber-500/10 font-semibold"
                      onClick={() =>
                        setDialogState({
                          open: true,
                          orderItemId: item.orderItemId,
                          productId: item.productId,
                          name: item.name,
                        })
                      }
                    >
                      <Star className="mr-1 size-3.5 fill-amber-400 text-amber-500" />
                      Đánh giá
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {dialogState && (
        <ReviewDialog
          open={dialogState.open}
          onOpenChange={(open) => {
            if (!open) setDialogState(null);
          }}
          mode="create"
          title={`Đánh giá: ${dialogState.name}`}
          orderCode={orderCode}
          orderItemId={dialogState.orderItemId}
          onSubmit={async ({ rating, comment, intentIds }) => {
            const token = getCustomerToken();
            if (!token) throw new Error('Vui lòng đăng nhập để đánh giá');

            await apiPost(
              `/api/orders/${encodeURIComponent(orderCode)}/items/${dialogState.orderItemId}/review`,
              {
                rating,
                comment,
                intent_ids: intentIds,
              },
            );

            toast.success('Cảm ơn bạn đã gửi đánh giá!');
            const submittedItemId = dialogState.orderItemId;
            setDialogState(null);

            // Refresh only the submitted item
            if (isMountedRef.current) {
              setItemStates((prev) => ({
                ...prev,
                [submittedItemId]: {
                  loading: false,
                  eligible: false,
                  hasReviewed: true,
                  rating,
                },
              }));
              onReviewSubmitted?.(submittedItemId);
            }
          }}
        />
      )}
    </Card>
  );
}
