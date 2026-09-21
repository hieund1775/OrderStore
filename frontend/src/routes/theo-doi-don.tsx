import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  Check,
  ClipboardCheck,
  CupSoda,
  Loader2,
  MapPin,
  PartyPopper,
  Search,
  Timer,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/site/PageHeader";
import { apiGet, apiPost } from "@/lib/api";
import { fmtDateTime, vnd, normalizeSugarLevel, normalizeIceLevel } from "@/lib/data";
import { CustomerDateTime } from "@/components/time/CustomerDateTime";
import { getOrderRequestHeaders, isPayOSLinkActive, isSafePayOSCheckoutUrl } from "@/lib/order-access";
import { resolveCheckoutPaymentRedirect } from "@/lib/payment-redirect";
import { OrderReviewPanel, type ReviewableItem } from "@/components/reviews/OrderReviewPanel";
import type { PaymentSummary } from "@/types/payment-summary";

export function mapDirectOrderItemsToReviewable(items?: Array<{ id?: number; order_item_id?: number; product_id: number; qty?: number; product_name: string; size_label?: string }>): ReviewableItem[] {
  return (items || []).map((it) => ({
    orderItemId: Number(it.order_item_id || it.id),
    productId: Number(it.product_id),
    name: `${it.qty ?? 1}× ${it.product_name}${it.size_label ? ` (${it.size_label})` : ""}`,
  }));
}

export function mapChildOrderItemsToReviewable(items?: Array<{ order_item_id?: number; product_id: number; quantity?: number; product_name: string }>): ReviewableItem[] {
  return (items || [])
    .filter((it) => Boolean(it.order_item_id))
    .map((it) => ({
      orderItemId: Number(it.order_item_id),
      productId: Number(it.product_id),
      name: `${it.quantity ?? 1}× ${it.product_name}`,
    }));
}

export const Route = createFileRoute("/theo-doi-don")({
  validateSearch: (search: Record<string, unknown>): { code?: string; order_code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
    order_code: typeof search.order_code === "string" ? search.order_code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Theo dõi đơn hàng real-time — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Xem trạng thái đơn trà theo thời gian thực: chờ xác nhận, đang pha chế, đang giao và hoàn tất.",
      },
      { property: "og:title", content: "Theo dõi đơn hàng — Trà Trái Cây Tô" },
      { property: "og:description", content: "Biết chính xác ly trà của bạn đang ở đâu." },
    ],
  }),
  component: Tracking,
});

type OrderStatus =
  | "Chờ xác nhận"
  | "Đã xác nhận"
  | "Đang chuẩn bị"
  | "Đang giao"
  | "Hoàn thành"
  | "Đã hủy";

const steps: { status: string; icon: typeof CupSoda; desc: string }[] = [
  { status: "Đang chuẩn bị", icon: CupSoda, desc: "Bếp đang pha chế & đóng gói món" },
  { status: "Đang giao", icon: Bike, desc: "Shipper đang giao / Đã mang ra bàn" },
  { status: "Hoàn thành", icon: PartyPopper, desc: "Đơn hàng hoàn tất" },
];

function getStepIndex(status: string): number {
  if (status === "Đang giao") return 1;
  if (status === "Hoàn thành") return 2;
  return 0; // "Chờ xác nhận", "Đã xác nhận", "Đang chuẩn bị"
}

type LookupItem = {
  id?: number;
  order_item_id?: number;
  product_id?: string | number;
  product_name: string;
  qty: number;
  size_label: string;
  base_tea: string;
  sugar_level: string;
  ice_level: string;
  note: string | null;
  unit_price: number;
  line_total: number;
  toppings: { name: string; price: number }[];
};

type LookupOrder = {
  id: number;
  order_code: string;
  store_name: string;
  location_name: string | null;
  order_type: string;
  payment_method: string;
  payment_status?: string;
  payment_provider?: string;
  paid_at?: string | null;
  payment_expires_at?: string | null;
  payment_checkout_url?: string | null;
  can_resume_payment?: boolean;
  can_review?: boolean;
  customer_name: string;
  delivery_addr: string | null;
  voucher_code: string | null;
  discount_amount: number;
  subtotal: number;
  total: number;
  shipping_driver_name?: string | null;
  shipping_driver_phone?: string | null;
  shipping_tracking_url?: string | null;
  root_category_id?: string | null;
  root_category_name?: string;
  payment_summary?: PaymentSummary;
  note: string | null;
  created_at: string;
  current_status: OrderStatus;
  items: LookupItem[];
  status_history: { status: OrderStatus; note: string | null; created_at: string }[];
};

type LookupGroupChildOrder = {
  order_id: string;
  order_code: string;
  root_category_id: string | null;
  root_category_name: string;
  allocated_subtotal: number;
  allocated_discount: number;
  allocated_shipping_fee: number;
  allocated_total: number;
  status: OrderStatus;
  payment_status: string;
  items: Array<{
    id?: number;
    order_item_id?: number;
    product_id: string | number;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

type LookupGroup = {
  group_code: string;
  payment_status: string;
  payment_provider: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  payment_checkout_url?: string | null;
  payment_qr_code?: string | null;
  payment_expires_at?: string | null;
  created_at: string;
  child_orders: LookupGroupChildOrder[];
  payment_summary: PaymentSummary;
};

function itemOptions(it: LookupItem) {
  return [
    it.size_label ? `Size ${it.size_label}` : null,
    it.base_tea ? it.base_tea : null,
    it.sugar_level ? normalizeSugarLevel(it.sugar_level) : null,
    it.ice_level ? normalizeIceLevel(it.ice_level) : null,
    it.toppings && it.toppings.length > 0 ? it.toppings.map((t) => t.name).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function openPaymentGateway(checkoutUrl: string | null | undefined, paymentProvider: string | null | undefined) {
  const redirect = resolveCheckoutPaymentRedirect(checkoutUrl, paymentProvider, window.location.origin);
  if (redirect.kind === "sandbox") {
    window.location.assign(`/thanh-toan/sandbox?token=${encodeURIComponent(redirect.token)}`);
    return true;
  }
  if (redirect.kind === "external" && isSafePayOSCheckoutUrl(redirect.url)) {
    window.location.assign(redirect.url);
    return true;
  }
  return false;
}

function Tracking() {
  const { code: searchCode, order_code: returnOrderCode } = Route.useSearch();
  const resolvedSearchCode = returnOrderCode || searchCode;
  const [input, setInput] = useState(resolvedSearchCode ?? "");
  const [order, setOrder] = useState<LookupOrder | null>(null);
  const [group, setGroup] = useState<LookupGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasTrackedResource, setHasTrackedResource] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [repaying, setRepaying] = useState(false);

  async function handleRepayPayment() {
    if (!order) return;
    if (
      order.payment_checkout_url
      && order.payment_status === "unpaid"
      && (order.payment_provider === "sandbox" || isPayOSLinkActive(order))
      && openPaymentGateway(order.payment_checkout_url, order.payment_provider)
    ) {
      return;
    }
    setRepaying(true);
    try {
      const res = await apiPost<{ ok: boolean; order: { checkout_url: string } }>(
        "/api/payments/regenerate",
        { order_code: order.order_code },
        { headers: getOrderRequestHeaders(order.order_code) }
      );
      if (res.order?.checkout_url && openPaymentGateway(res.order.checkout_url, order.payment_provider)) {
      } else {
        toast.error("Không thể mở lại trang thanh toán lúc này");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi kết nối cổng thanh toán");
    } finally {
      setRepaying(false);
    }
  }

  async function handleRepayGroupPayment() {
    if (!group) return;
    if (
      group.payment_checkout_url
      && group.payment_status === "unpaid"
      && openPaymentGateway(group.payment_checkout_url, group.payment_provider)
    ) {
      return;
    }
    setRepaying(true);
    try {
      const res = await apiPost<{ ok: boolean; group?: { payment_checkout_url: string }; order?: { checkout_url: string } }>(
        "/api/payments/regenerate",
        { group_code: group.group_code, order_code: group.group_code },
        { headers: getOrderRequestHeaders(group.group_code) }
      );
      const targetUrl = res.group?.payment_checkout_url || res.order?.checkout_url;
      if (targetUrl && openPaymentGateway(targetUrl, group.payment_provider)) {
      } else {
        toast.error("Không thể mở lại trang thanh toán lúc này");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi kết nối cổng thanh toán");
    } finally {
      setRepaying(false);
    }
  }

  const inFlightLoadRef = useRef<Map<string, Promise<{ ok: boolean; status?: number }>>>(new Map());
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const orderRef = useRef<LookupOrder | null>(order);
  orderRef.current = order;
  const groupRef = useRef<LookupGroup | null>(group);
  groupRef.current = group;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  const load = useCallback(
    async (c: string, silent = false): Promise<{ ok: boolean; status?: number }> => {
      const codeKey = c.trim().toUpperCase();
      if (!codeKey) return { ok: false };

      // Single-flight deduplication: return existing active request if in progress for the same code
      const existing = inFlightLoadRef.current.get(codeKey);
      if (existing) {
        return existing;
      }

      // Abort any prior in-flight request for a different code
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      if (!silent && isMountedRef.current) {
        setLoading(true);
        setError("");
      }

      const fetchPromise = (async () => {
        try {
          const res = await apiGet<{ order?: LookupOrder; group?: LookupGroup }>(
            `/api/orders/lookup?code=${encodeURIComponent(codeKey)}`,
            {
              headers: getOrderRequestHeaders(codeKey),
              signal: controller.signal,
            }
          );
          if (!isMountedRef.current || controller.signal.aborted) return { ok: false };

          if (res.group) {
            setGroup(res.group);
            setOrder(null);
            setHasTrackedResource(true);
            setError("");
            try {
              const rawPending = sessionStorage.getItem("teaplus_pending_payment");
              if (rawPending) {
                const p = JSON.parse(rawPending);
                if (p?.payment_code === codeKey || p?.order_code === codeKey) {
                  sessionStorage.removeItem("teaplus_pending_payment");
                }
              }
            } catch {}
            return { ok: true };
          }
          if (res.order) {
            setOrder(res.order);
            setGroup(null);
            setHasTrackedResource(true);
            setError("");
            try {
              const rawPending = sessionStorage.getItem("teaplus_pending_payment");
              if (rawPending) {
                const p = JSON.parse(rawPending);
                if (p?.payment_code === codeKey || p?.payment_code === res.order.order_code || p?.order_code === res.order.order_code) {
                  sessionStorage.removeItem("teaplus_pending_payment");
                }
              }
            } catch {}
            return { ok: true };
          }
          throw new Error("Không tìm thấy đơn hàng");
        } catch (err: unknown) {
          if (!isMountedRef.current || controller.signal.aborted) return { ok: false };
          const isAbort = err instanceof DOMException && err.name === "AbortError";
          if (isAbort) return { ok: false };

          setError(err instanceof Error ? err.message : "Không tìm thấy đơn hàng");
          if (!silent) {
            setOrder(null);
            setGroup(null);
            setHasTrackedResource(false);
          }
          const status = typeof err === "object" && err !== null && "status" in err
            ? Number((err as { status?: unknown }).status)
            : undefined;
          return { ok: false, status };
        } finally {
          inFlightLoadRef.current.delete(codeKey);
          if (!silent && isMountedRef.current && !controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();

      inFlightLoadRef.current.set(codeKey, fetchPromise);
      return fetchPromise;
    },
    [],
  );

  useEffect(() => {
    if (resolvedSearchCode) load(resolvedSearchCode);
  }, [resolvedSearchCode, load]);

  // Smart Chained Timeout Polling real-time (mỗi 5 giây, dừng khi terminal state)
  const currentTrackingCode = (group?.group_code || order?.order_code || (hasTrackedResource ? resolvedSearchCode : "")).trim().toUpperCase();

  useEffect(() => {
    if (!currentTrackingCode) return;

    let isEffectActive = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = 5000;
    let isPollInFlight = false;
    let shouldStop = false;

    const checkIsTerminal = () => {
      const currentOrder = orderRef.current;
      const currentGroup = groupRef.current;
      const isOrderTerminal = currentOrder ? (currentOrder.current_status === "Hoàn thành" || currentOrder.current_status === "Đã hủy") : false;
      const isGroupTerminal = currentGroup ? (currentGroup.payment_status === "paid" && currentGroup.child_orders.every(co => co.status === "Hoàn thành" || co.status === "Đã hủy")) : false;
      return isOrderTerminal || isGroupTerminal;
    };

    if (checkIsTerminal()) return;

    const poll = async () => {
      if (!isEffectActive || isPollInFlight) return;
      if (document.visibilityState === "hidden") return;
      if (checkIsTerminal()) return;

      isPollInFlight = true;
      try {
        const result = await load(currentTrackingCode, true);
        if (!result.ok && (result.status === 403 || result.status === 404)) {
          shouldStop = true;
        } else if (!result.ok) {
          // Exponential backoff on 429/5xx/network errors (capped at 20s)
          currentDelay = Math.min(currentDelay * 1.5, 20000);
        } else {
          currentDelay = 5000;
        }
      } finally {
        isPollInFlight = false;
        if (isEffectActive && !shouldStop && !checkIsTerminal()) {
          timerId = setTimeout(poll, currentDelay);
        }
      }
    };

    timerId = setTimeout(poll, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isEffectActive && !shouldStop && !checkIsTerminal()) {
        if (timerId) clearTimeout(timerId);
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isEffectActive = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentTrackingCode, load]);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      const cancelToken =
        sessionStorage.getItem(`cancel_token_${order.order_code}`) ||
        localStorage.getItem(`cancel_token_${order.order_code}`) ||
        "";
      await apiPost(`/api/orders/cancel`, {
        order_code: order.order_code,
        reason: cancelReason.trim() || null,
        cancel_token: cancelToken || undefined,
      });
      try {
        sessionStorage.removeItem(`cancel_token_${order.order_code}`);
        localStorage.removeItem(`cancel_token_${order.order_code}`);
      } catch {}
      toast.success("Đã hủy đơn hàng");
      setCancelOpen(false);
      await load(order.order_code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hủy đơn thất bại");
    } finally {
      setCancelling(false);
    }
  }

  if (loading && !order && !group) {
    return (
      <>
        <PageHeader eyebrow="Tracking" title="Theo dõi đơn hàng" desc="Đang tải thông tin đơn…" />
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </>
    );
  }

  if (!order && !group) {
    return (
      <>
        <PageHeader eyebrow="Tracking" title="Theo dõi đơn hàng" desc="Nhập mã đơn để xem trạng thái" />
        <div className="container-page py-10">
          <Card className="mx-auto max-w-md">
            <CardContent className="space-y-4 p-6">
              <p className="text-muted-foreground text-sm">
                {error || "Quét mã QR trên hóa đơn hoặc nhập mã đơn (VD: TP2608051234) hoặc mã gộp để theo dõi."}
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  load(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập mã đơn hoặc mã gộp"
                  className="uppercase"
                />
                <Button type="submit" variant="hero">
                  <Search className="mr-1 size-4" /> Tra cứu
                </Button>
              </form>
              <Button asChild variant="soft" className="w-full">
                <Link to="/menu">Đặt món mới</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (group) {
    const isGroupPaid = group.payment_status === "paid";
    return (
      <>
        <PageHeader
          eyebrow="Tracking"
          title={`Đơn thanh toán gộp ${group.group_code}`}
          desc={`Bao gồm ${group.child_orders.length} ngành hàng · Cập nhật mỗi 5 giây`}
        />

        <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
          <section className="bg-card rounded-2xl border p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Mã thanh toán chung</p>
                <p className="font-display text-xl font-extrabold">{group.group_code}</p>
              </div>
              {isGroupPaid ? (
                <Badge className="bg-leaf/15 text-leaf font-semibold">Đã thanh toán gộp</Badge>
              ) : group.payment_status === "expired" ? (
                <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 font-semibold">
                  Thanh toán gộp đã hết hạn
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold animate-pulse">
                  Chờ thanh toán gộp
                </Badge>
              )}
            </div>

            {/* Payment Banner if Unpaid or Expired */}
            {!isGroupPaid && (
              <div className={`${group.payment_status === "expired" ? "bg-slate-500/10 border-slate-500/30 text-slate-800 dark:text-slate-300" : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"} rounded-xl border p-4`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Timer className="size-5 text-amber-600 animate-spin" /> {group.payment_status === "expired" ? `Phiên thanh toán đã hết hạn (${vnd(group.total_amount)})` : `⏳ Đang chờ xác nhận thanh toán (${vnd(group.total_amount)})`}
                </div>
                <p className="mt-1 text-xs opacity-90">
                  {group.payment_status === "expired"
                    ? "Phiên thanh toán cũ đã hết hạn hoặc bị hủy. Bạn có thể tạo phiên thanh toán mới."
                    : "Thanh toán một lần để kích hoạt toàn bộ các đơn con thuộc các ngành hàng."}
                </p>
                <Button variant="hero" size="sm" className="mt-3 font-semibold" disabled={repaying} onClick={handleRepayGroupPayment}>
                  {repaying ? <Loader2 className="animate-spin size-4 mr-1.5" /> : null}
                  {group.payment_status === "expired" ? "Tạo mã thanh toán mới" : (group.payment_checkout_url ? "Mở trang thanh toán ↗" : "🔄 Tạo phiên thanh toán mới")}
                </Button>
              </div>
            )}

            {/* List Child Orders by Industry */}
            <div className="space-y-4 pt-2">
              <h3 className="font-display text-base font-bold text-foreground">
                Danh sách đơn con theo từng ngành hàng ({group.child_orders.length})
              </h3>

              {group.child_orders.map((co) => (
                <div key={co.order_code} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{co.order_code}</span>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {co.root_category_name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={co.status === "Hoàn thành" ? "bg-leaf/15 text-leaf" : co.status === "Đã hủy" ? "bg-berry/15 text-berry" : "bg-primary/15 text-primary"}>
                        {co.status}
                      </Badge>
                      <Badge variant="outline" className={co.payment_status === "paid" ? "border-leaf text-leaf text-[11px]" : "border-amber-500/40 text-amber-700 dark:text-amber-400 text-[11px]"}>
                        {co.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                      </Badge>
                    </div>
                  </div>

                  {/* Child order items */}
                  {Array.isArray(co.items) && co.items.length > 0 && (
                    <div className="space-y-2 text-xs">
                      {co.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-muted-foreground">
                          <span>{it.quantity}× {it.product_name}</span>
                          <span className="font-medium text-foreground">{vnd(it.line_total)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Financial breakdown for child order */}
                  <div className="bg-background/80 rounded-lg p-2.5 text-xs space-y-1 border border-border/40">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tạm tính ngành:</span>
                      <span className="font-medium text-foreground">{vnd(co.allocated_subtotal)}</span>
                    </div>
                    {co.allocated_discount > 0 && (
                      <div className="flex justify-between text-leaf font-medium">
                        <span>Giảm giá phân bổ:</span>
                        <span>− {vnd(co.allocated_discount)}</span>
                      </div>
                    )}
                    {co.allocated_shipping_fee > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Phí giao hàng:</span>
                        <span className="font-medium text-foreground">{vnd(co.allocated_shipping_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground border-t pt-1">
                      <span>Thành tiền đơn con:</span>
                      <span className="text-primary font-bold">{vnd(co.allocated_total)}</span>
                    </div>
                  </div>

                  {/* Review Panel for completed child order */}
                  {Boolean(co.can_review) && Array.isArray(co.items) && co.items.some((it) => it.order_item_id) && (
                    <OrderReviewPanel
                      orderCode={co.order_code}
                      items={mapChildOrderItemsToReviewable(co.items)}
                      canReview={Boolean(co.can_review)}
                      className="mt-3"
                    />
                  )}

                  {/* Link to single tracking */}
                  <div className="pt-1 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => load(co.order_code)}
                    >
                      Theo dõi chi tiết đơn này ↗
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <Card className="shadow-soft">
              <CardContent className="p-5 space-y-3">
                <p className="font-display text-lg font-bold">Tổng kết thanh toán gộp</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {group.child_orders.map((co) => (
                    <div key={co.order_code} className="flex justify-between">
                      <span className="truncate pr-2">{co.root_category_name} ({co.order_code})</span>
                      <span className="font-semibold text-foreground shrink-0">{vnd(co.allocated_total)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tạm tính chung</span>
                    <span className="font-medium text-foreground">{vnd(group.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Giảm giá chung</span>
                    <span className={group.discount_amount ? "text-leaf font-medium" : ""}>
                      {group.discount_amount ? `− ${vnd(group.discount_amount)}` : "0₫"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Phí giao hàng</span>
                    <span>{group.shipping_fee ? vnd(group.shipping_fee) : "0₫"}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2 text-base">
                    <span>Tổng thanh toán</span>
                    <span className="text-primary font-extrabold">{vnd(group.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-display text-base font-bold">Thông tin giao dịch gộp</p>
                <p className="text-muted-foreground flex gap-2">
                  <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                  Giao dịch thanh toán trực tuyến tập trung
                </p>
                <p className="text-muted-foreground text-xs">
                  {group.group_code} · {group.payment_provider.toUpperCase()} ·{" "}
                  <CustomerDateTime value={group.created_at} />
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </>
    );
  }

  const cancelled = order.current_status === "Đã hủy";
  const currentStep = getStepIndex(order.current_status);
  const completed = order.current_status === "Hoàn thành";
  const canResumePayment = Boolean(
    order.can_resume_payment
    && (order.payment_status === "unpaid" || order.payment_status === "expired")
    && ["payos", "sandbox"].includes(order.payment_provider || "")
    && !cancelled
    && !completed
  );
  const hasActivePaymentLink = Boolean(
    canResumePayment
    && order.payment_status !== "expired"
    && order.payment_checkout_url
    && isPayOSLinkActive(order)
    && (order.payment_provider === "sandbox" || isSafePayOSCheckoutUrl(order.payment_checkout_url))
  );

  return (
    <>
      <PageHeader
        eyebrow="Tracking"
        title={`Đơn ${order.order_code}`}
        desc={`${order.store_name}${order.location_name ? ` · ${order.location_name}` : ""} · cập nhật mỗi 5 giây`}
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <section className="bg-card rounded-2xl border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-xs">Mã đơn</p>
                <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                  {order.root_category_name || order.payment_summary?.industries?.[0]?.root_category_name || "Chưa phân loại"}
                </Badge>
              </div>
              <p className="font-display text-xl font-extrabold">{order.order_code}</p>
            </div>
            {cancelled ? (
              <Badge className="bg-berry/15 text-berry">Đã hủy</Badge>
            ) : order.payment_status === "expired" && ["payos", "sandbox"].includes(order.payment_provider || "") ? (
              <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 font-semibold">Thanh toán đã hết hạn</Badge>
            ) : order.payment_status === "unpaid" && ["payos", "sandbox"].includes(order.payment_provider || "") ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">Chờ chuyển khoản</Badge>
            ) : completed ? (
              <Badge className="bg-leaf/15 text-leaf">Hoàn thành</Badge>
            ) : (
              <Badge className="bg-primary/15 text-primary animate-pulse">{order.current_status}</Badge>
            )}
          </div>

          {/* Payment Status Banner - Chỉ hiện khi đơn chưa thanh toán hoặc hết hạn */}
          {canResumePayment && (
            <div className={`${order.payment_status === "expired" ? "bg-slate-500/10 border-slate-500/30 text-slate-800 dark:text-slate-300" : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"} mt-4 rounded-xl border p-4`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <Timer className="size-5 text-amber-600 animate-spin" /> {order.payment_status === "expired" ? `Phiên thanh toán đã hết hạn (${vnd(order.total)})` : `⏳ Đang chờ xác nhận thanh toán (${vnd(order.total)})`}
              </div>
              <p className="mt-1 text-xs opacity-90">
                {order.payment_status === "expired"
                  ? "Phiên thanh toán cũ đã hết hạn hoặc bị hủy. Bạn có thể bấm để tạo lại phiên thanh toán mới."
                  : "Đơn hàng chuyển khoản sẽ tự động chuyển về bếp pha chế ngay khi nhận tiền thành công."}
              </p>
              <Button variant="hero" size="sm" className="mt-3 font-semibold" disabled={repaying} onClick={handleRepayPayment}>
                {repaying ? <Loader2 className="animate-spin size-4 mr-1.5" /> : null}
                {order.payment_status === "expired" ? "Tạo mã thanh toán mới" : (hasActivePaymentLink ? "Mở trang thanh toán ↗" : "🔄 Tạo phiên thanh toán mới")}
              </Button>
            </div>
          )}

          {/* Timeline 3 bước */}
          {!canResumePayment && (
            <ol className="mt-8 space-y-0">
              {steps.map((s, i) => {
                const done = !cancelled && (currentStep > i || completed);
                const active = !cancelled && currentStep === i && !completed;
                return (
                  <li key={s.status} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < steps.length - 1 && (
                      <span
                        className={`absolute top-10 left-5 h-full w-0.5 ${
                          cancelled ? "bg-berry/20" : done ? "bg-leaf" : "bg-border"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${
                        cancelled
                          ? i === 0
                            ? "bg-berry/15 border-berry/40 text-berry"
                            : "bg-card border-border text-muted-foreground opacity-50"
                          : done
                            ? "bg-leaf border-leaf text-leaf-foreground"
                            : active
                              ? "gradient-warm border-primary text-primary-foreground animate-pulse"
                              : "bg-card border-border text-muted-foreground"
                      }`}
                    >
                      {cancelled ? (
                        i === 0 ? (
                          <XCircle className="size-5" />
                        ) : (
                          <Check className="size-5" />
                        )
                      ) : done ? (
                        <Check className="size-5" />
                      ) : (
                        <s.icon className="size-5" />
                      )}
                    </span>
                    <div className="pt-1.5">
                      <p
                        className={`text-sm font-bold ${
                          active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.status}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {cancelled && i === 0
                          ? order.status_history?.find((h) => h.status === "Đã hủy")?.note || "Đã hủy"
                          : s.desc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Shipper & Live Tracking link when order is Đang giao */}
          {order.current_status === "Đang giao" && (
            <div className="bg-primary/5 border-primary/20 mt-6 rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Bike className="size-5" /> Thông tin giao hàng / Tài xế
              </div>
              <div className="space-y-1 text-sm text-foreground">
                <p>
                  <span className="font-semibold">Tài xế:</span> {order.shipping_driver_name || "Đang cập nhật"}
                </p>
                {order.shipping_driver_phone && (
                  <p className="flex items-center gap-2">
                    <span className="font-semibold">Số điện thoại:</span>
                    {order.shipping_driver_phone.includes("*") ? (
                      <span className="text-muted-foreground">{order.shipping_driver_phone}</span>
                    ) : (
                      <a
                        href={`tel:${order.shipping_driver_phone}`}
                        className="text-primary font-bold underline hover:text-primary/80"
                      >
                        {order.shipping_driver_phone} (Bấm để gọi)
                      </a>
                    )}
                  </p>
                )}
              </div>
              {order.shipping_tracking_url ? (
                <Button asChild className="w-full mt-2" variant="hero">
                  <a href={order.shipping_tracking_url} target="_blank" rel="noopener noreferrer">
                    <Bike className="mr-2 size-4" /> Xem hành trình tài xế (Grab / Ahamove)
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Tài xế đang trên đường giao đơn hàng tới bạn.</p>
              )}
            </div>
          )}

          {/* Canonical Reviews Panel when order is completed and customer has capability */}
          {completed && Boolean(order.can_review) && (
            <OrderReviewPanel
              orderCode={order.order_code}
              items={mapDirectOrderItemsToReviewable(order.items)}
              canReview={true}
              className="mt-6"
            />
          )}

          {!cancelled && !completed && currentStep === 0 && (
            <Button variant="outline" className="text-berry mt-6 w-full" onClick={() => setCancelOpen(true)}>
              <XCircle className="size-4 mr-1" /> Hủy đơn hàng
            </Button>
          )}
        </section>

        <aside className="space-y-4">
          <Card className="shadow-soft">
            <CardContent className="p-5">
              <p className="font-display mb-3 text-lg font-bold">Chi tiết đơn</p>
              <ul className="text-muted-foreground space-y-3 text-sm">
                {order.items.map((it, idx) => (
                  <li key={idx}>
                    <p className="text-foreground font-semibold">
                      {it.qty}× {it.product_name}
                    </p>
                    <p>{itemOptions(it)}</p>
                    <p className="text-primary mt-0.5 font-semibold">{vnd(it.line_total)}</p>
                  </li>
                ))}
              </ul>
              {order.note && (
                <p className="bg-muted/60 text-muted-foreground mt-3 rounded-lg p-2 text-xs">
                  Ghi chú: {order.note}
                </p>
              )}
              <div className="mt-4 flex justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Tiền món</span>
                <span>{vnd(order.subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Giảm giá</span>
                <span>{order.discount_amount ? `− ${vnd(order.discount_amount)}` : "0₫"}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-3 font-semibold">
                <span>Tổng thanh toán</span>
                <span className="text-primary">{vnd(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-display text-base font-bold">Thông tin nhận hàng</p>
              <p className="text-muted-foreground flex gap-2">
                <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                {order.location_name
                  ? `${order.location_name} · ${order.store_name}`
                  : order.delivery_addr || `${order.store_name} (Take-away)`}
              </p>
              <p className="text-muted-foreground text-xs">
                {order.customer_name} · {order.payment_method} ·{" "}
                <CustomerDateTime value={order.created_at} />
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy đơn {order.order_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn chỉ hủy được khi đang ở trạng thái "Đang chuẩn bị". Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Lý do hủy (không bắt buộc)"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ đơn</AlertDialogCancel>
            <AlertDialogAction
              className="bg-berry hover:bg-berry/90"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
            >
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Xác nhận hủy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
