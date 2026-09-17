import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, QrCode, Star, LogIn, Bell, Trash2, CheckCheck, ShoppingBag, ShoppingCart, Tag, Loader2, RefreshCw, User as UserIcon, Edit3, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { CustomerPreordersTab } from "@/components/profile/CustomerPreordersTab";
import { CustomerDateTime } from "@/components/time/CustomerDateTime";
import { useCart } from "@/lib/cart";
import { buildWishlistQuickCartItem, useWishlist } from "@/lib/wishlist";
import { apiGet, apiPost, setCustomerUser, getCustomerToken } from "@/lib/api";
import { vnd } from "@/lib/data";
import { OrderReviewPanel } from "@/components/reviews/OrderReviewPanel";
import {
  isSafeInternalLink,
  useCustomerNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { PollingController } from "@/lib/polling-controller";

const PROFILE_TABS = new Set(["orders", "preorders", "notifications", "wishlist", "info"]);

type ProfileOrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  size_label: string;
};

type ProfileOrder = {
  id: number;
  order_code: string;
  total: number;
  payment_status?: string;
  payment_provider?: string;
  current_status: string;
  created_at: string;
  store_name: string;
  items: ProfileOrderItem[];
};

export function normalizeProfileOrders(value: unknown): ProfileOrder[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
    .map((raw, orderIndex) => ({
      id: Number(raw.id) || orderIndex + 1,
      order_code: String(raw.order_code || 'Chưa có mã đơn').trim(),
      total: Number(raw.total) || 0,
      payment_status: raw.payment_status ? String(raw.payment_status) : undefined,
      payment_provider: raw.payment_provider ? String(raw.payment_provider) : undefined,
      current_status: String(raw.current_status || 'Đang cập nhật').trim(),
      created_at: String(raw.created_at || ''),
      store_name: String(raw.store_name || 'TeaPlus').trim(),
      items: Array.isArray(raw.items)
        ? raw.items
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          .map((item, itemIndex) => ({
            id: Number(item.id) || itemIndex + 1,
            product_id: Number(item.product_id) || 0,
            product_name: String(item.product_name || 'Sản phẩm').trim(),
            qty: Number(item.qty) > 0 ? Number(item.qty) : 1,
            size_label: item.size_label ? String(item.size_label).trim() : '',
          }))
        : [],
    }));
}

const tiers = [
  { name: "Đồng", min: 0, color: "from-stone-400 to-stone-500" },
  { name: "Bạc", min: 500, color: "from-slate-300 to-slate-400" },
  { name: "Vàng", min: 1500, color: "from-amber-400 to-amber-500" },
  { name: "Kim Cương", min: 3000, color: "from-cyan-400 to-blue-500" },
];

function getNextTier(points: number) {
  for (const t of tiers) {
    if (points < t.min) return t;
  }
  return null;
}

export const Route = createFileRoute("/ho-so")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; code?: string } => ({
    tab: typeof search.tab === "string" && PROFILE_TABS.has(search.tab) ? search.tab : undefined,
    code: typeof search.code === "string" && search.code.trim() ? search.code.trim() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Hồ sơ cá nhân & lịch sử đơn hàng — Trà Trái Cây Tô" },
      {
        name: "description",
        content:
          "Quản lý thông tin cá nhân, thẻ hội viên điện tử, mã QR tích điểm, lịch sử đơn hàng và danh sách yêu thích.",
      },
      { property: "og:title", content: "Hồ sơ cá nhân — Trà Trái Cây Tô" },
      { property: "og:description", content: "Đặt lại đơn cũ chỉ với 1 chạm." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { addItem } = useCart();
  const {
    items: wishlistItems,
    count: wishlistCount,
    isLoading: wishlistLoading,
    isError: wishlistError,
    refetch: refetchWishlist,
    removeFavorite,
    isPending: isWishlistPending,
  } = useWishlist();
  const [notifsPage, setNotifsPage] = useState(1);
  const {
    user,
    token,
    notifications: notificationsList,
    pagination: notifsPagination,
    isLoading: notifsLoading,
    isError: notifsError,
    refetch: refetchNotifications,
    markRead,
    markAllRead,
    clearAll,
  } = useCustomerNotifications({ page: notifsPage, limit: 10 });
  const isLoggedIn = Boolean(token && user);

  const [activeTab, setActiveTab] = useState(search?.tab || "orders");
  const [userOrders, setUserOrders] = useState<ProfileOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);

  const handleSendEmailOtp = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; demo_otp?: string }>(
        '/api/auth/profile/send-email-otp',
        { email: newEmail.trim() }
      );
      toast.success(res.message);
      if (res.demo_otp) {
        toast.info(`[Demo / Staging] Mã OTP của bạn là: ${res.demo_otp}`);
      }
      setEmailStep('otp');
      setEmailCountdown(60);
      const timer = setInterval(() => {
        setEmailCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi mã xác thực email');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailOtp.trim()) {
      toast.error('Vui lòng nhập mã OTP 6 số');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; user: any }>(
        '/api/auth/profile/verify-email',
        { email: newEmail.trim(), code: emailOtp.trim() }
      );
      toast.success(res.message);
      setCustomerUser(res.user);
      setEmailEditing(false);
      setEmailStep('input');
      setEmailOtp('');
    } catch (err: any) {
      toast.error(err?.message || 'Mã OTP không chính xác');
    } finally {
      setEmailLoading(false);
    }
  };

  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const ordersInFlightRef = useRef(false);

  useEffect(() => {
    setPageIndex(0);
    setCursorStack([null]);
    setNextCursor(null);
    setHasMore(false);
    setUserOrders([]);
  }, [isLoggedIn, user?.id]);

  const fetchUserOrders = useCallback(async (isBackground = false) => {
    if (!isLoggedIn || !user?.id) {
      setUserOrders([]);
      return;
    }
    if (ordersInFlightRef.current) return;
    ordersInFlightRef.current = true;
    if (!isBackground) setOrdersLoading(true);

    try {
      const currentCursor = cursorStack[pageIndex];
      const params = new URLSearchParams({ limit: '5' });
      if (currentCursor) params.set('cursor', currentCursor);

      const resData = await apiGet<{ orders?: unknown[]; page_info?: { next_cursor?: string | null; has_more?: boolean }; next_cursor?: string | null; has_more?: boolean } | unknown[]>(
        `/api/users/${user.id}/orders?${params.toString()}`
      );

      let rows: unknown[] = [];
      let resNextCursor: string | null = null;
      let resHasMore = false;

      if (Array.isArray(resData)) {
        rows = resData;
      } else if (resData && typeof resData === 'object') {
        if (Array.isArray((resData as any).orders)) {
          rows = (resData as any).orders;
        }
        const pageInfo = (resData as any).page_info;
        resNextCursor = pageInfo?.next_cursor ?? (resData as any).next_cursor ?? null;
        resHasMore = Boolean(pageInfo?.has_more ?? (resData as any).has_more);
      }

      const normalized = normalizeProfileOrders(rows);
      setUserOrders(normalized);
      setNextCursor(resNextCursor);
      setHasMore(resHasMore);

      if (pageIndex > 0 && normalized.length === 0) {
        setPageIndex((p) => Math.max(0, p - 1));
      }
    } catch (err) {
      // Retain old userOrders on background polling failure, rethrow to PollingController so backoff triggers
      if (isBackground) throw err;
    } finally {
      ordersInFlightRef.current = false;
      if (!isBackground) setOrdersLoading(false);
    }
  }, [cursorStack, isLoggedIn, pageIndex, user?.id]);

  useEffect(() => {
    if (isLoggedIn && user?.id && activeTab === 'orders') {
      void fetchUserOrders();
    }
  }, [activeTab, fetchUserOrders, isLoggedIn, user?.id]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || activeTab !== 'orders') return;

    const controller = new PollingController({
      fetchFn: async () => {
        await fetchUserOrders(true);
      },
      visibleIntervalMs: 5_000,
      hiddenIntervalMs: 60_000,
      backoffEnabled: true,
    });
    controller.start();

    return () => {
      controller.stop();
    };
  }, [activeTab, fetchUserOrders, isLoggedIn, user?.id]);

  const handleNextPage = () => {
    if (!hasMore || !nextCursor) return;
    const nextIndex = pageIndex + 1;
    setCursorStack((prev) => {
      const next = [...prev];
      next[nextIndex] = nextCursor;
      return next;
    });
    setPageIndex(nextIndex);
  };

  const handlePrevPage = () => {
    if (pageIndex <= 0) return;
    setPageIndex((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    if (search?.tab && PROFILE_TABS.has(search.tab)) {
      setActiveTab(search.tab);
    } else if (!search?.tab) {
      setActiveTab('orders');
    }
  }, [search?.tab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    void navigate({
      to: "/ho-so",
      search: (prev) => ({
        ...prev,
        tab: val === "orders" ? undefined : val,
        code: val === "preorders" ? prev.code : undefined,
      }),
      replace: true,
    });
  };

  if (!isLoggedIn || !user) {
    return (
      <>
        <PageHeader
          eyebrow="Tài khoản"
          title="Hồ sơ cá nhân"
          desc="Đăng nhập để xem thông tin tài khoản"
        />
        <div className="container-page flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4 text-sm">Bạn chưa đăng nhập</p>
          <p className="text-muted-foreground text-xs">
            Nhấn vào icon <LogIn className="inline size-3" /> ở góc phải trên để đăng nhập.
          </p>
        </div>
      </>
    );
  }

  const userName = user.fullname || "Khách";
  const userTier = user.tier || "Đồng";
  const userPoints = user.points || 0;
  const nextTier = getNextTier(userPoints);
  const currentTierIdx = tiers.findIndex((t) => t.name === userTier);
  const currentTierMin = currentTierIdx >= 0 ? tiers[currentTierIdx].min : 0;
  const nextTierMin = nextTier ? nextTier.min : userPoints;
  const progressPct = nextTier ? Math.min(100, Math.round(((userPoints - currentTierMin) / (nextTierMin - currentTierMin)) * 100)) : 100;

  async function handleNotificationClick(n: AppNotification) {
    if (user?.id && !n.is_read) {
      await markRead(n.id).catch(() => undefined);
    }
    if (isSafeInternalLink(n.link)) {
      navigate({ to: n.link as any });
    }
  }

  async function handleReadAllNotifications() {
    if (!user?.id) return;
    try {
      await markAllRead();
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
    } catch {
      toast.error("Không thể cập nhật trạng thái");
    }
  }

  async function handleClearAllNotifications() {
    if (!user?.id) return;
    try {
      await clearAll();
      setClearDialogOpen(false);
      toast.success("Đã xóa tất cả thông báo");
    } catch {
      toast.error("Không thể xóa thông báo");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Tài khoản"
        title="Hồ sơ cá nhân"
        desc={`${userName} · Hội viên hạng ${userTier}`}
      />

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <div className="gradient-warm text-primary-foreground rounded-2xl p-5 shadow-glow">
            <p className="text-xs tracking-widest uppercase opacity-80">Thẻ hội viên điện tử</p>
            <p className="font-display my-2 text-xl font-bold">{userName}</p>
            <div className="flex items-center justify-between text-sm opacity-90">
              <span>Hạng: {userTier}</span>
              <span>Tích điểm: {userPoints} điểm</span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs opacity-80">
                <span>Tiến trình nâng hạng</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="bg-white/30 h-2" />
            </div>
          </div>
        </aside>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 grid grid-cols-2 sm:grid-cols-5 h-auto p-1.5 gap-1.5 w-full bg-muted/80 rounded-2xl [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <TabsTrigger
              value="orders"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-medium rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <ShoppingCart className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <span className="truncate">
                <span className="sm:hidden">Đơn hàng ({userOrders.length})</span>
                <span className="hidden sm:inline">Lịch sử đơn ({userOrders.length})</span>
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="preorders"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-medium rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <CalendarClock className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <span className="truncate">
                <span className="sm:hidden">Đặt trước</span>
                <span className="hidden sm:inline">Đơn đặt trước</span>
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="notifications"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-medium rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <Bell className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <span className="truncate">
                Thông báo ({notificationsList.length})
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="wishlist"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-medium rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <Heart className="size-3.5 sm:size-4 shrink-0 text-berry" />
              <span className="truncate">
                Yêu thích ({wishlistCount})
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="info"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-medium rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <UserIcon className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <span className="truncate">
                <span className="sm:hidden">Thông tin</span>
                <span className="hidden sm:inline">Thông tin cá nhân</span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {ordersLoading ? (
              <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground text-sm">
                Đang tải lịch sử đơn hàng…
              </div>
            ) : userOrders.length === 0 ? (
              <div className="bg-card rounded-2xl border p-8 text-center">
                <p className="text-muted-foreground text-sm">Chưa có đơn hàng nào.</p>
                <Button asChild variant="hero" size="sm" className="mt-3">
                  <Link to="/menu">Đặt món ngay</Link>
                </Button>
              </div>
            ) : (
              userOrders.map((o) => (
                <div key={o.id} className="bg-card rounded-2xl border p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div>
                      <p className="font-display font-bold text-base">Đơn hàng #{o.order_code}</p>
                      <p className="text-muted-foreground text-xs">
                        <CustomerDateTime value={o.created_at} /> · {o.store_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.payment_status === "unpaid" && ["payos", "sandbox"].includes(o.payment_provider || "") && o.current_status !== "Đã hủy" ? (
                        <>
                          <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                            ⏳ Chờ thanh toán
                          </Badge>
                          <Button asChild variant="hero" size="sm" className="h-7 text-xs">
                            <Link to="/theo-doi-don" search={{ code: o.order_code }}>
                              Thanh toán ngay
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                            {o.current_status || "Đang xử lý"}
                          </Badge>
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                            <Link to="/theo-doi-don" search={{ code: o.order_code }}>
                              Theo dõi
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {o.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <p className="text-sm">
                          {item.qty}x {item.product_name} ({item.size_label})
                        </p>
                      </div>
                    ))}
                  </div>

                  {o.current_status === "Hoàn thành" && (
                    <OrderReviewPanel
                      orderCode={o.order_code}
                      items={(o.items || []).map((item) => ({
                        orderItemId: Number(item.id),
                        productId: Number(item.product_id),
                        name: `${item.qty}x ${item.product_name}${item.size_label ? ` (${item.size_label})` : ''}`,
                      }))}
                      canReview={true}
                      className="mt-3"
                    />
                  )}

                  <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
                    <span>Tổng thanh toán:</span>
                    <span className="text-primary font-bold text-base">{vnd(o.total)}</span>
                  </div>
                </div>
              ))
            )}

            {userOrders.length > 0 && (
              <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                <span>Trang {pageIndex + 1}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={pageIndex <= 0 || ordersLoading}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasMore || ordersLoading}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preorders" className="space-y-4">
            <CustomerPreordersTab
              isActive={activeTab === 'preorders'}
              highlightedCode={search?.code}
            />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-bold">
                Tất cả thông báo ({notificationsList.length})
              </p>
              {notificationsList.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={handleReadAllNotifications}
                  >
                    <CheckCheck className="size-3.5 mr-1" /> Đọc tất cả
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setClearDialogOpen(true)}
                  >
                    <Trash2 className="size-3.5 mr-1" /> Xóa tất cả
                  </Button>
                </div>
              )}
            </div>

            {notifsLoading ? (
              <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground text-sm">
                Đang tải thông báo…
              </div>
            ) : notifsError ? (
              <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground text-sm">
                <p>Không tải được thông báo.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchNotifications()}>
                  Thử lại
                </Button>
              </div>
            ) : notificationsList.length === 0 ? (
              <div className="bg-card rounded-2xl border p-12 text-center">
                <Bell className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">Bạn chưa có thông báo nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notificationsList.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`bg-card rounded-2xl border p-4 transition-colors cursor-pointer ${
                      !n.is_read ? "border-primary/40 bg-primary/[0.02]" : "hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {n.type === "order" ? <ShoppingBag className="size-3.5" /> : <Tag className="size-3.5" />}
                        </span>
                        <div>
                          <p className={`text-sm ${!n.is_read ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                            {n.title}
                          </p>
                          <CustomerDateTime value={n.created_at} showStoreTime={false} className="text-[11px] text-muted-foreground" />
                        </div>
                      </div>
                      {!n.is_read && (
                        <Badge variant="default" className="text-[10px] h-4">
                          Mới
                        </Badge>
                      )}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-2 pl-9">{n.body}</p>}
                  </div>
                ))}

                {notifsPagination && notifsPagination.total_pages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <span>
                      Trang {notifsPagination.page} / {notifsPagination.total_pages} ({notifsPagination.total_items} thông báo)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNotifsPage((p) => Math.max(1, p - 1))}
                        disabled={!notifsPagination.has_prev || notifsLoading}
                      >
                        Trang trước
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNotifsPage((p) => Math.min(notifsPagination.total_pages, p + 1))}
                        disabled={!notifsPagination.has_next || notifsLoading}
                      >
                        Trang sau
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="wishlist">
            {wishlistLoading && (
              <div className="bg-card flex flex-col items-center justify-center rounded-2xl border p-12 text-muted-foreground gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm">Đang tải danh sách yêu thích...</p>
              </div>
            )}

            {!wishlistLoading && wishlistError && (
              <div className="bg-card flex flex-col items-center justify-center rounded-2xl border p-12 text-center gap-2">
                <p className="text-destructive text-sm">Không thể tải danh sách yêu thích.</p>
                <Button variant="outline" size="sm" onClick={() => refetchWishlist()}>
                  <RefreshCw className="mr-1.5 size-3.5" /> Thử lại
                </Button>
              </div>
            )}

            {!wishlistLoading && !wishlistError && wishlistItems.length === 0 && (
              <div className="bg-card flex flex-col items-center justify-center rounded-2xl border p-12 text-center text-muted-foreground">
                <Heart className="mb-2 size-10 stroke-1 text-muted-foreground/40" />
                <p className="text-sm font-medium">Chưa có món yêu thích nào.</p>
                <p className="text-xs text-muted-foreground/80 mt-1">Hãy bấm thả tim các món bạn yêu thích trên thực đơn nhé!</p>
                <Button asChild variant="hero" size="sm" className="mt-4">
                  <Link to="/menu">Khám phá thực đơn</Link>
                </Button>
              </div>
            )}

            {!wishlistLoading && !wishlistError && wishlistItems.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {wishlistItems.map((p) => {
                  const pending = isWishlistPending(p.product_id);
                  return (
                    <div key={p.id} className="bg-card flex items-center justify-between rounded-2xl border p-4 shadow-sm gap-3">
                      <img
                        src={p.image_url || "/placeholder.png"}
                        alt={p.product_name || "Món"}
                        loading="lazy"
                        className="size-16 rounded-xl object-cover bg-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.product_name}</p>
                        <p className="text-xs text-muted-foreground">{p.base_tea || "Thiếu dữ liệu cốt trà"}</p>
                        <p className="text-primary font-bold text-sm mt-1">{vnd(p.price)}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button
                          variant="soft"
                          size="sm"
                          className="text-xs h-7 px-2.5"
                          onClick={() => {
                            const cartItem = buildWishlistQuickCartItem(p);
                            if (!cartItem) {
                              toast.error("Thông tin món chưa đầy đủ, vui lòng chọn lại từ thực đơn");
                              return;
                            }
                            const added = addItem(cartItem);
                            if (added) {
                              toast.success(`Đã thêm "${p.product_name}" vào giỏ hàng`);
                            }
                          }}
                        >
                          + Giỏ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFavorite(p.product_id)}
                          aria-label={`Xóa ${p.product_name} khỏi yêu thích`}
                        >
                          <Trash2 className="size-3.5 mr-1" /> Xóa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info">
            <div className="space-y-6">
              {/* Account Basic Info */}
              <div className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 shadow-sm">
                <div className="space-y-1.5 sm:col-span-2 border-b pb-3">
                  <h3 className="font-display font-bold text-base">Thông tin cá nhân</h3>
                  <p className="text-xs text-muted-foreground">Thông tin định danh và tích điểm của bạn</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Họ tên</Label>
                  <Input id="p-name" defaultValue={userName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">Số điện thoại</Label>
                  <Input id="p-phone" defaultValue={user.phone || ""} readOnly className="bg-muted font-mono" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="p-tier">Hạng hội viên & Điểm tích lũy</Label>
                  <Input id="p-tier" value={`Hạng ${userTier} · ${userPoints} điểm`} readOnly className="bg-muted" />
                </div>
              </div>

              {/* Email & Security Section */}
              <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-display font-bold text-base flex items-center gap-2">
                      <span>Email & Khôi Phục Mật Khẩu</span>
                      {user.email ? (
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[11px] font-bold">
                          ✓ Đã xác thực
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[11px] font-bold">
                          Chưa liên kết
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dùng để nhận hóa đơn điện tử, thông báo ưu đãi độc quyền và lấy lại mật khẩu khi quên.
                    </p>
                  </div>
                  {!emailEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailEditing(true);
                        setNewEmail(user.email || '');
                        setEmailStep('input');
                      }}
                      className="text-xs font-semibold"
                    >
                      {user.email ? 'Đổi Email' : 'Liên kết Email'}
                    </Button>
                  )}
                </div>

                {!emailEditing ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary font-bold">
                        @
                      </div>
                      <div>
                        <p className="text-sm font-mono font-semibold text-foreground">
                          {user.email || 'Chưa có địa chỉ email nào được liên kết'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {user.email
                            ? 'Email này được bảo vệ và dùng để nhận mã OTP khôi phục mật khẩu.'
                            : 'Hãy liên kết email để bảo vệ tài khoản của bạn.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    {emailStep === 'input' ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="new-email">Địa chỉ Email mới</Label>
                          <Input
                            id="new-email"
                            type="email"
                            placeholder="example@email.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEmailEditing(false)}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            variant="hero"
                            size="sm"
                            onClick={handleSendEmailOtp}
                            disabled={emailLoading}
                          >
                            {emailLoading ? 'Đang gửi…' : 'Gửi mã xác thực OTP'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="email-otp">Mã OTP (6 số gửi tới {newEmail})</Label>
                            <button
                              type="button"
                              onClick={handleSendEmailOtp}
                              disabled={emailCountdown > 0 || emailLoading}
                              className="text-xs text-primary hover:underline disabled:text-muted-foreground"
                            >
                              {emailCountdown > 0 ? `Gửi lại sau ${emailCountdown}s` : 'Gửi lại mã'}
                            </button>
                          </div>
                          <Input
                            id="email-otp"
                            placeholder="123456"
                            maxLength={6}
                            className="font-mono tracking-widest text-center text-lg font-bold"
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEmailStep('input')}
                          >
                            Đổi lại Email
                          </Button>
                          <Button
                            type="button"
                            variant="hero"
                            size="sm"
                            onClick={handleVerifyEmail}
                            disabled={emailLoading}
                          >
                            {emailLoading ? 'Đang xác thực…' : 'Xác nhận & Cập nhật Email'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tất cả thông báo?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ thông báo trong tài khoản của bạn sẽ bị xóa và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllNotifications}>Xóa tất cả</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
