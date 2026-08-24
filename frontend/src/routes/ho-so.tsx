import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, QrCode, Star, LogIn, Bell, Trash2, CheckCheck, ShoppingBag, ShoppingCart, Tag, Loader2, RefreshCw, User as UserIcon } from "lucide-react";
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
import { useCart } from "@/lib/cart";
import { buildWishlistQuickCartItem, useWishlist } from "@/lib/wishlist";
import { apiGet } from "@/lib/api";
import { vnd } from "@/lib/data";
import { CustomerDateTime } from "@/components/time/CustomerDateTime";
import {
  isSafeInternalLink,
  useCustomerNotifications,
  type AppNotification,
} from "@/lib/notifications";

const PROFILE_TABS = new Set(["orders", "notifications", "wishlist", "info"]);

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
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" && PROFILE_TABS.has(search.tab) ? search.tab : undefined,
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
  const {
    user,
    token,
    data: notificationData,
    isLoading: notifsLoading,
    isError: notifsError,
    refetch: refetchNotifications,
    markRead,
    markAllRead,
    clearAll,
  } = useCustomerNotifications();
  const isLoggedIn = Boolean(token && user);

  const [activeTab, setActiveTab] = useState(search?.tab || "orders");
  const [userOrders, setUserOrders] = useState<{
    id: number;
    order_code: string;
    total: number;
    payment_status?: string;
    payment_provider?: string;
    current_status: string;
    created_at: string;
    store_name: string;
    items: { product_name: string; qty: number; size_label: string }[];
  }[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const notificationsList = notificationData?.notifications ?? [];

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    let cancelled = false;
    setOrdersLoading(true);
    apiGet<{
      id: number;
      order_code: string;
      total: number;
      payment_status?: string;
      payment_provider?: string;
      current_status: string;
      created_at: string;
      store_name: string;
      items: { product_name: string; qty: number; size_label: string }[];
    }[] | { orders: any[]; page_info: any }>(`/api/users/${user.id}/orders`)
      .then((resData) => {
        const rows = Array.isArray(resData) ? resData : (resData?.orders || []);
        if (!cancelled) setUserOrders(rows);
      })
      .catch(() => {
        if (!cancelled) setUserOrders([]);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    if (search?.tab) {
      setActiveTab(search.tab);
    }
  }, [search?.tab]);

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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid grid-cols-2 sm:grid-cols-4 h-auto p-1.5 gap-1.5 w-full bg-muted/80 rounded-2xl">
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
                      {o.payment_status === "unpaid" && o.payment_provider === "payos" && o.current_status !== "Đã hủy" ? (
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
                      <p key={idx} className="text-sm flex justify-between">
                        <span>
                          {item.qty}x {item.product_name} ({item.size_label})
                        </span>
                      </p>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
                    <span>Tổng thanh toán:</span>
                    <span className="text-primary font-bold text-base">{vnd(o.total)}</span>
                  </div>
                </div>
              ))
            )}
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
                          <CustomerDateTime value={n.created_at} className="text-[11px] text-muted-foreground" />
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
            <div className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Họ tên</Label>
                <Input id="p-name" defaultValue={userName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Số điện thoại</Label>
                <Input id="p-phone" defaultValue={user.phone || ""} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-email">Hạng hội viên</Label>
                <Input id="p-email" value={`Hạng ${userTier} · ${userPoints} điểm`} readOnly className="bg-muted" />
              </div>
              <Button
                variant="hero"
                className="sm:col-span-2"
                onClick={() => toast.success("Thông tin tài khoản đã được đồng bộ")}
              >
                Cập nhật thông tin
              </Button>
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
