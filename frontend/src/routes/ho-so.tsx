import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, QrCode, Star, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/lib/cart";
import { apiGet, getCustomerToken, getCustomerUser } from "@/lib/api";
import { fmtDateTime, notifications, products, vnd } from "@/lib/data";

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
  const { wishlist, toggleWishlist } = useCart();
  const saved = products.filter((p) => wishlist.includes(p.id));
  const user = getCustomerUser();
  const isLoggedIn = !!getCustomerToken();

  const [userOrders, setUserOrders] = useState<{
    id: number;
    order_code: string;
    total: number;
    current_status: string;
    created_at: string;
    store_name: string;
    items: { product_name: string; qty: number; size_label: string }[];
  }[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    let cancelled = false;
    setOrdersLoading(true);
    apiGet<{
      id: number;
      order_code: string;
      total: number;
      current_status: string;
      created_at: string;
      store_name: string;
      items: { product_name: string; qty: number; size_label: string }[];
    }[]>(`/api/users/${user.id}/orders`)
      .then((rows) => {
        if (!cancelled) setUserOrders(Array.isArray(rows) ? rows : []);
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

          <div className="bg-card rounded-2xl border p-5">
            <p className="mb-3 text-sm font-semibold">Thông báo</p>
            {notifications.map((n) => (
              <div key={n.id} className="border-b py-2 last:border-0">
                <p className="text-sm">{n.title}</p>
                <p className="text-muted-foreground text-xs">{n.time}</p>
              </div>
            ))}
          </div>
        </aside>

        <Tabs defaultValue="orders">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="orders">Lịch sử đơn hàng ({userOrders.length})</TabsTrigger>
            <TabsTrigger value="wishlist">Yêu thích</TabsTrigger>
            <TabsTrigger value="review">Đánh giá</TabsTrigger>
            <TabsTrigger value="info">Thông tin</TabsTrigger>
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
                        {fmtDateTime(o.created_at)} · {o.store_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                        {o.current_status || "Đang xử lý"}
                      </Badge>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link to="/theo-doi-don" search={{ code: o.order_code }}>
                          Theo dõi
                        </Link>
                      </Button>
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

          <TabsContent value="wishlist">
            <div className="grid gap-4 sm:grid-cols-2">
              {saved.length === 0 && (
                <p className="text-muted-foreground text-sm">Chưa có món yêu thích nào.</p>
              )}
              {saved.map((p) => (
                <div key={p.id} className="bg-card flex items-center gap-3 rounded-2xl border p-4">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="size-16 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.base}</p>
                    <p className="text-primary font-bold">{vnd(p.price)}</p>
                  </div>
                  <button onClick={() => toggleWishlist(p.id)} aria-label="Bỏ yêu thích">
                    <Heart className="fill-berry text-berry size-5" />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="review">
            <div className="bg-card space-y-4 rounded-2xl border p-5">
              <p className="font-display text-lg font-bold">Đánh giá đơn VX240712</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="fill-primary text-primary size-6" />
                ))}
              </div>
              <Textarea rows={3} placeholder="Chia sẻ cảm nhận của bạn về ly trà…" />
              <label className="hover:border-primary text-muted-foreground flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm">
                Tải ảnh ly trà thực tế
              </label>
              <Button variant="hero" onClick={() => toast.success("Cảm ơn bạn đã đánh giá!")}>
                Gửi đánh giá
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="info">
            <div className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Họ tên</Label>
                <Input id="p-name" defaultValue={userName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Số điện thoại</Label>
                <Input id="p-phone" defaultValue={user.phone} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" defaultValue="minhtrang@email.com" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Địa chỉ đã lưu</Label>
                <div className="text-muted-foreground space-y-2 text-sm">
                  <p className="rounded-xl border p-3">🏠 Nhà · 125 Nguyễn Huệ, Quận 1</p>
                  <p className="rounded-xl border p-3">🏢 Công ty · 88 Võ Văn Tần, Quận 3</p>
                </div>
              </div>
              <Button
                variant="hero"
                className="sm:col-span-2"
                onClick={() => toast.success("Đã lưu thay đổi")}
              >
                Lưu thay đổi
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
